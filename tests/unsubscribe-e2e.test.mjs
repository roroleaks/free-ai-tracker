import 'dotenv/config';
import { createServer } from 'node:http';
import { kv } from '../src/utils/kv.js';

let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const captured = [];
let handlerRefs;

function makeMockRes() {
  const res = { _status: 200, _headers: {}, _body: null };
  res.status = (s) => { res._status = s; return res; };
  res.setHeader = (k, v) => { res._headers[k] = v; return res; };
  res.send = (b) => { res._body = b; };
  res.json = (d) => { res._body = d; };
  res.end = res.json;
  return res;
}

function runHandler(fn, req, res) {
  return Promise.resolve(fn(req, res));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const routes = {
    '/api/subscribe': async () => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const mockReq = { method: 'POST', body: raw, url: req.url };
      const mockRes = makeMockRes();
      await runHandler(handlerRefs.subscribe, mockReq, mockRes);
      res.statusCode = mockRes._status;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(mockRes._body));
    },
    '/api/unsubscribe': async () => {
      const mockReq = {
        method: 'GET',
        url: req.url,
        query: Object.fromEntries(url.searchParams),
        headers: { accept: req.headers.accept || 'text/html' },
      };
      const mockRes = makeMockRes();
      await runHandler(handlerRefs.unsubscribe, mockReq, mockRes);
      res.statusCode = mockRes._status;
      for (const [k, v] of Object.entries(mockRes._headers)) res.setHeader(k, v);
      if (typeof mockRes._body === 'string') {
        res.setHeader('Content-Type', 'text/html');
        return res.end(mockRes._body);
      }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(mockRes._body));
    },
  };

  if (routes[url.pathname]) return routes[url.pathname]().catch((e) => { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); });

  // Mock Brevo SMTP endpoint: capture the payload, reply like Brevo.
  let raw = '';
  req.on('data', (c) => raw += c);
  req.on('end', () => {
    try { captured.push(JSON.parse(raw || '{}')); } catch { captured.push({ raw }); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ messageId: 'mocked-' + Date.now() }));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const PORT = server.address().port;
const LOCAL = `http://127.0.0.1:${PORT}`;

process.env.BREVO_API_URL = `${LOCAL}/mail`;
process.env.BREVO_API_KEY = 'mock-key';
process.env.EMAIL_FROM = 'Free AI Tracker <mock@example.com>';
process.env.SITE_URL = LOCAL;

const [{ default: subscribeHandler }, { default: unsubscribeHandler }, unsubUtils] = await Promise.all([
  import('../api/subscribe.js'),
  import('../api/unsubscribe.js'),
  import('../src/utils/unsubscribe.js'),
]);
const { parseUnsubscribeToken, maskEmail } = unsubUtils;
handlerRefs = { subscribe: subscribeHandler, unsubscribe: unsubscribeHandler };

const TEST_EMAIL = `e2e.mocked.${Date.now()}@test.dev`;

console.log('=== 1. Subscribe through mocked mail provider ===');
const subRes = await fetch(`${LOCAL}/api/subscribe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL }),
});
const subBody = await subRes.json();
check('subscribe HTTP 200', subRes.status === 200, `status=${subRes.status}`);
check('subscribe success=true', subBody.success === true, JSON.stringify(subBody));
check('welcome email captured by mocked provider', captured.some((m) => m.subject && m.subject.includes('Welcome')), JSON.stringify(captured.length));
check('subscriber stored in KV', (await kv.sismember('subscribers', TEST_EMAIL)) === 1);

console.log('\n=== 2. All outbound emails contain the unsubscribe URL ===');
const welcome = captured.find((m) => m.subject && m.subject.includes('Welcome'));
const welcomeHtml = welcome.htmlContent;
check('welcome email HTML present', typeof welcomeHtml === 'string' && welcomeHtml.length > 100);
const urls = [...welcomeHtml.matchAll(/\/api\/unsubscribe\?token=[^"']+/g)].map((m) => m[0]);
check('welcome email contains token unsubscribe URL', urls.length >= 1, urls.join(', '));
check('URL does not expose raw email', urls.every((u) => !u.includes(TEST_EMAIL.split('@')[0]) && !u.includes('email=')), urls.join(', '));
const token = urls[0].split('token=')[1];
const parsed = parseUnsubscribeToken(token);
check('extracted token valid + matches address', parsed.status === 'valid' && parsed.email === TEST_EMAIL, JSON.stringify(parsed));

console.log('\n=== 3. Open the link (GET) ===');
const openRes = await fetch(`${LOCAL}/api/unsubscribe?token=${encodeURIComponent(token)}`, { headers: { Accept: 'text/html' } });
const openHtml = await openRes.text();
check('open link HTTP 200', openRes.status === 200, `status=${openRes.status}`);
check('success page rendered', openHtml.includes('Unsubscribed'));
check('subscriber now inactive in KV', (await kv.sismember('subscribers', TEST_EMAIL)) === 0);

console.log('\n=== 4. Repeated unsubscribe stays idempotent ===');
const repeatRes = await fetch(`${LOCAL}/api/unsubscribe?token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
const repeatBody = await repeatRes.json();
check('repeat open => 200 success', repeatRes.status === 200 && repeatBody.success === true, JSON.stringify(repeatBody));
check('still inactive', (await kv.sismember('subscribers', TEST_EMAIL)) === 0);

console.log('\n=== 5. Tampered / expired rejected safely ===');
const tamperedRes = await fetch(`${LOCAL}/api/unsubscribe?token=${encodeURIComponent(token.slice(0, -3))}x`, { headers: { Accept: 'application/json' } });
const tamperedBody = await tamperedRes.json();
check('tampered => 400 generic', tamperedRes.status === 400 && tamperedBody.success === false, JSON.stringify(tamperedBody));
check('tampered leaks no email', !(tamperedBody.error || '').includes(TEST_EMAIL.split('@')[0]), JSON.stringify(tamperedBody));

console.log('\n=== Cleanup ===');
await kv.srem('subscribers', TEST_EMAIL);
await new Promise((resolve) => server.close(resolve));

console.log(`\n=== UNSUBSCRIBE E2E (MOCKED MAIL) TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);