import 'dotenv/config';
import { createUnsubscribeToken, parseUnsubscribeToken, maskEmail, buildUnsubscribeUrl } from '../src/utils/unsubscribe.js';

let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const BASE = 'https://free-ai-tracker.vercel.app';
const TEST_EMAIL = `unsub.e2e.${Date.now()}@test.dev`;

async function get(path) {
  return fetch(`${BASE}${path}`, { method: 'GET', cache: 'no-store' });
}

async function getJson(path) {
  return fetch(`${BASE}${path}`, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' });
}

console.log('=== Token unit behaviour (no network) ===');
const token = createUnsubscribeToken(TEST_EMAIL);
check('token is dot-separated signature', token.split('.').length === 2, token);
check('URL contains NO raw email', !buildUnsubscribeUrl(TEST_EMAIL).includes(encodeURIComponent(TEST_EMAIL)) && !buildUnsubscribeUrl(TEST_EMAIL).includes(TEST_EMAIL.split('@')[0]));
check('URL has token param only', /unsubscribe\?token=[^&]+$/.test(buildUnsubscribeUrl(TEST_EMAIL)), buildUnsubscribeUrl(TEST_EMAIL));
const parsed = parseUnsubscribeToken(token);
check('valid token parsed to original email (lowercased)', parsed.status === 'valid' && parsed.email === TEST_EMAIL, JSON.stringify(parsed));

const otherToken = createUnsubscribeToken('other@test.dev');
check('email-bound token (different email differs)', parseUnsubscribeToken(otherToken).email === 'other@test.dev');

const tampered = token.slice(0, -3) + (token.slice(-1) === 'A' ? 'B' : 'A');
check('tampered token => invalid', parseUnsubscribeToken(tampered).status === 'invalid');

const expired = createUnsubscribeToken(TEST_EMAIL, Date.now() - 1000);
check('expired token => expired', parseUnsubscribeToken(expired).status === 'expired');

check('malformed token => invalid', parseUnsubscribeToken('not.a.token').status === 'invalid');
check('empty token => invalid', parseUnsubscribeToken('').status === 'invalid');
check('masked email hides local part', maskEmail('john.doe@gmail.com') === 'jo******@gmail.com', maskEmail('john.doe@gmail.com'));

import { kv } from '../src/utils/kv.js';

console.log('\n=== Invalid / tampered / expired (must not reveal existence) ===');
for (const [label, tkn] of [['none', ''], ['garbage', 'garbage'], ['tampered', tampered], ['expired', expired]]) {
  const r = await getJson(`/api/unsubscribe?token=${encodeURIComponent(tkn)}`);
  const b = await r.json();
  check(`${label} token => 400 generic`, r.status === 400 && b.success === false, `status=${r.status} ${JSON.stringify(b)}`);
  check(`${label} response leaks no email`, b.email === undefined && !(b.error || '').includes(TEST_EMAIL.split('@')[0]), JSON.stringify(b));
}

console.log('\n=== Invalid token HTML page (browser) ===');
const badPage = await get(`/api/unsubscribe?token=deadbeef`);
const badHtml = await badPage.text();
check('invalid token page => 400', badPage.status === 400, `status=${badPage.status}`);
check('invalid page is HTML', /<!DOCTYPE html>/i.test(badHtml));
check('invalid page does not reveal email', !badHtml.includes(TEST_EMAIL.split('@')[0]), badHtml);
check('invalid page has actionable feedback', /Invalid or Expired|still subscribed/.test(badHtml));

console.log('\n=== Expired token HTML page ===');
const expiredPage = await getJson(`/api/unsubscribe?token=${encodeURIComponent(expired)}`).then(async r => ({ r, b: await r.json() }));
check('expired token => 400 generic JSON', expiredPage.r.status === 400 && expiredPage.b.success === false);

console.log('\n=== Seed: subscribe a test address ===');
const sub = await fetch(`${BASE}/api/subscribe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL }),
  cache: 'no-store',
});
const subBody = await sub.json();
check('seed subscribe => 200', sub.status === 200, `status=${sub.status} ${subBody.message || ''}`);
check('seed present in KV', (await kv.sismember('subscribers', TEST_EMAIL)) === 1);

console.log('\n=== One-click unsubscribe with valid token ===');
const okUrl = `/api/unsubscribe?token=${encodeURIComponent(token)}`;
const ok = await getJson(okUrl);
const okBody = await ok.json();
check('unsubscribe => 200', ok.status === 200, `status=${ok.status}`);
check('unsubscribe success=true', okBody.success === true, JSON.stringify(okBody));
check('email returned in success JSON', okBody.email === TEST_EMAIL);
check('subscriber now inactive', (await kv.sismember('subscribers', TEST_EMAIL)) === 0);

console.log('\n=== Idempotent repeat (already inactive) ===');
const again = await getJson(okUrl);
const againBody = await again.json();
check('repeat unsubscribe still succeeds', again.status === 200 && againBody.success === true, JSON.stringify(againBody));

console.log('\n=== HTML success page ===');
const okPage = await get(okUrl);
const okHtml = await okPage.text();
check('success page => 200', okPage.status === 200, `status=${okPage.status}`);
check('success page shows masked email', okHtml.includes(maskEmail(TEST_EMAIL)), okHtml);
check('success page does NOT show raw email', !okHtml.includes(TEST_EMAIL), okHtml);
check('success page has resubscribe link', okHtml.includes('resubscribe'), okHtml);

console.log('\n=== Cleanup ===');
await kv.srem('subscribers', TEST_EMAIL);

console.log(`\n=== UNSUBSCRIBE TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);