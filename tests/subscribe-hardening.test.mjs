import 'dotenv/config';
import { createServer } from 'node:http';
import { kv } from '../src/utils/kv.js';

let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

// ---- Console capture for redaction assertions (pass-through to real console) ----
const orig = { log: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) };
const capturedLogs = [];
let capturing = false;
console.log = (...a) => { orig.log(...a); if (capturing) capturedLogs.push(a.map(String).join(' ')); };
console.warn = (...a) => { orig.warn(...a); if (capturing) capturedLogs.push(a.map(String).join(' ')); };
console.error = (...a) => { orig.error(...a); if (capturing) capturedLogs.push(a.map(String).join(' ')); };

const mailCalls = [];
const mailState = { mode: 'ok', hangMs: 800 };
let handlerRefs;

function makeMockRes() {
  const res = { _status: 200, _headers: {}, _body: null };
  res.status = (s) => { res._status = s; return res; };
  res.setHeader = (k, v) => { res._headers[k] = v; return res; };
  res.send = (b) => { res._body = b; };
  res.json = (d) => { res._body = d; };
  return res;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => raw += c);
    req.on('end', () => resolve(raw));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  req.on('error', () => {});
  res.on('error', () => {});

  if (url.pathname === '/api/subscribe') {
    const method = req.method || 'POST';
    const body = await parseBody(req);
    const mockReq = { method, body, url: req.url };
    const mockRes = makeMockRes();
    await handlerRefs.subscribe(mockReq, mockRes);
    res.statusCode = mockRes._status;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(mockRes._body));
  }

  // Mock Brevo SMTP endpoint, fail/hang modes toggleable via mailState.
  const body = await parseBody(req);
  let payload = {};
  try { payload = JSON.parse(body || '{}'); } catch { payload = { raw: body }; }
  mailCalls.push(payload);

  if (mailState.mode === 'fail') {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ message: 'mock provider failure' }));
  }

  if (mailState.mode === 'hang') {
    await new Promise((r) => setTimeout(r, mailState.hangMs));
    if (res.destroyed || req.destroyed || res.writableEnded) return;
  }

  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ messageId: 'mocked-' + Date.now() }));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const LOCAL = `http://127.0.0.1:${server.address().port}`;

process.env.BREVO_API_URL = `${LOCAL}/mail`;
process.env.BREVO_API_KEY = 'mock-key';
process.env.EMAIL_FROM = 'Free AI Tracker <mock@example.com>';
process.env.SITE_URL = LOCAL;
process.env.EMAIL_TIMEOUT_MS = '10000';

const [{ default: subscribeHandler }] = await Promise.all([import('../api/subscribe.js')]);
handlerRefs = { subscribe: subscribeHandler };

const emailNow = (prefix) => `${prefix}.${Date.now()}@test.dev`;

async function post(email) {
  const res = await fetch(`${LOCAL}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return { status: res.status, body: await res.json() };
}

function welcomeCount(recipient) {
  return mailCalls.filter((m) => m.subject && m.subject.includes('Welcome') && m.to && m.to[0].email === recipient).length;
}
function isSubscribed(email) { return kv.sismember('subscribers', email); }
function isPending(email) { return kv.sismember('subscribers:pending', email); }

console.log('=== 1. Concurrent identical requests (3 at once) ===');
const concur = emailNow('harden.cur');
const results = await Promise.all([post(concur), post(concur), post(concur)]);
check('all three return 200', results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.status)));
check('exactly ONE "subscribed" response', results.filter((r) => /^You are subscribed to Free AI Tracker alerts/.test(r.body.message || '')).length === 1,
  JSON.stringify(results.map((r) => r.body.message)));
check('others say "already subscribed"', results.filter((r) => /already subscribed/i.test(r.body.message || '')).length === 2,
  JSON.stringify(results.map((r) => r.body.message)));
check('responses expose only the normalized email', results.every((r) => r.body.email === concur));
check('subscriber stored exactly once', (await isSubscribed(concur)) === 1);
check('exactly ONE welcome email to the address', welcomeCount(concur) === 1, `calls=${welcomeCount(concur)}`);
check('welcome-pending cleared after success', (await isPending(concur)) === 0);

console.log('\n=== 2. Case-insensitive duplicates ===');
const caseEmail = emailNow('harden.case');
const c1 = await post(caseEmail);
const c2 = await post(caseEmail.toUpperCase());
check('new subscription 200 success', c1.status === 200 && c1.body.success === true);
check('uppercase variant => already subscribed', /already subscribed/i.test(c2.body.message || ''), c2.body.message);
check('uppercase variant returns normalized email', c2.body.email === caseEmail);
check('no second welcome email', welcomeCount(caseEmail) === 1, `calls=${welcomeCount(caseEmail)}`);
check('single subscriber record', (await isSubscribed(caseEmail)) === 1);

console.log('\n=== 3. Whitespace normalization ===');
const wsEmail = emailNow('harden.ws');
const w1 = await post(wsEmail);
const w2 = await post(`   ${wsEmail.toUpperCase()}   `);
check('whitespace+padded uppercase => already subscribed', /already subscribed/i.test(w2.body.message || ''), w2.body.message);
check('padded variant returns trimmed lowercased email', w2.body.email === wsEmail);
check('no second welcome email', welcomeCount(wsEmail) === 1);
check('single subscriber record', (await isSubscribed(wsEmail)) === 1);

console.log('\n=== 4. Provider failure (HTTP 500) ===');
const failEmail = emailNow('harden.fail');
mailState.mode = 'fail';
const f1 = await post(failEmail);
check('subscribe still succeeds (200 success)', f1.status === 200 && f1.body.success === true, `${f1.status} ${JSON.stringify(f1.body)}`);
check('subscriber stored despite provider failure', (await isSubscribed(failEmail)) === 1);
check('one welcome attempt recorded', welcomeCount(failEmail) === 1);
check('welcome-pending flagged (unconfirmed)', (await isPending(failEmail)) === 1);
// Provider recovers: a retry must NOT fire another email.
mailState.mode = 'ok';
const f2 = await post(failEmail);
check('retry => already subscribed (no duplicate mail)', /already subscribed/i.test(f2.body.message || ''), f2.body.message);
check('retry does NOT resend welcome', welcomeCount(failEmail) === 1, `calls=${welcomeCount(failEmail)}`);
check('pending stays flagged across provider outage', (await isPending(failEmail)) === 1);

console.log('\n=== 5. Provider timeout (provider hangs; client aborts) ===');
const timeEmail = emailNow('harden.time');
process.env.EMAIL_TIMEOUT_MS = '200';
mailState.mode = 'hang';
const started = Date.now();
const t1 = await post(timeEmail);
const elapsed = Date.now() - started;
check('handler returns 200 despite provider hang', t1.status === 200 && t1.body.success === true, `${t1.status} ${JSON.stringify(t1.body)}`);
check('handler returns promptly (timeout enforced)', elapsed < 1500, `elapsed=${elapsed}ms`);
check('subscriber stored despite timeout', (await isSubscribed(timeEmail)) === 1);
check('one welcome attempt reached provider', welcomeCount(timeEmail) === 1);
check('welcome-pending flagged (unconfirmed)', (await isPending(timeEmail)) === 1);
// Provider healthy again: a retry must NOT create more mail.
process.env.EMAIL_TIMEOUT_MS = '10000';
mailState.mode = 'ok';
const t2 = await post(timeEmail);
check('retry after timeout => already subscribed', /already subscribed/i.test(t2.body.message || ''), t2.body.message);
check('retry after timeout does NOT resend welcome', welcomeCount(timeEmail) === 1, `calls=${welcomeCount(timeEmail)}`);

console.log('\n=== 6. Already-active subscribers ===');
const actEmail = emailNow('harden.act');
const a1 = await post(actEmail);
const a2 = await post(actEmail);
check('first subscribe 200 + welcome', a1.status === 200 && welcomeCount(actEmail) === 1);
check('second identical subscribe => already subscribed', /already subscribed/i.test(a2.body.message || ''), a2.body.message);
check('subscriberCount unchanged by duplicate', Number(a2.body.subscriberCount) === Number(a1.body.subscriberCount), `${a1.body.subscriberCount} -> ${a2.body.subscriberCount}`);
check('single welcome total', welcomeCount(actEmail) === 1);

console.log('\n=== 7. Structured logs: request ID + no raw email/token ===');
const redactEmail = emailNow('harden.redact');
capturedLogs.length = 0;
capturing = true;
await post(redactEmail);
capturing = false;
const logs = capturedLogs.slice();
check('logs contain requestId', logs.some((l) => l.includes('requestId')), JSON.stringify(logs));
check('logs contain structured event tags', logs.some((l) => /welcome_sent|already_subscribed|welcome_failed/.test(l)), JSON.stringify(logs));
const maskedLines = logs.filter((l) => l.includes('emailMasked') && l.includes('@test.dev'));
check('user identifier in logs is masked (stars, never raw local part)', maskedLines.length > 0 && maskedLines.every((l) => l.includes('*')), JSON.stringify(maskedLines));
check('no log line contains the raw email address', logs.every((l) => !l.includes(redactEmail)), JSON.stringify(logs));
check('no log line contains an unsubscribe token', logs.every((l) => !l.includes('token=') && !l.includes('sig=')), JSON.stringify(logs));
const redactLocal = redactEmail.split('@')[0];
check('no log line contains the raw local part', logs.every((l) => !l.includes(redactLocal)), JSON.stringify(logs));

console.log('\n=== 8. HTTP/JSON contract preserved ===');
const get = await fetch(`${LOCAL}/api/subscribe`, { method: 'GET' });
const getBody = await get.json();
check('GET => 405 success=false', get.status === 405 && getBody.success === false, `status=${get.status}`);
const bad = await post('not-an-email');
check('invalid email => 400 success=false', bad.status === 400 && bad.body.success === false, `${bad.status} ${JSON.stringify(bad.body)}`);
const junk = await fetch(`${LOCAL}/api/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
const junkBody = await junk.json();
check('malformed JSON => 400 success=false', junk.status === 400 && junkBody.success === false, `${junk.status} ${JSON.stringify(junkBody)}`);

console.log('\n=== Cleanup ===');
await Promise.all([concur, caseEmail, wsEmail, failEmail, timeEmail, actEmail, redactEmail].map((e) =>
  Promise.all([kv.srem('subscribers', e), kv.srem('subscribers:pending', e)])
));
const cleaned = await kv.smembers('subscribers');
check('all test emails removed', [concur, caseEmail, wsEmail, failEmail, timeEmail, actEmail, redactEmail].every((e) => !cleaned.includes(e)));
await new Promise((resolve) => server.close(resolve));

console.log(`\n=== SUBSCRIBE-HARDENING TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);