import 'dotenv/config';
import { signEmail } from '../src/utils/unsubscribe.js';

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

console.log('=== Seed: subscribe a test email ===');
const sub = await fetch(`${BASE}/api/subscribe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL }),
  cache: 'no-store',
});
const subBody = await sub.json();
check('seed subscribe => 200', sub.status === 200, `status=${sub.status} ${subBody.message || ''}`);

console.log('\n=== Token signing consistency ===');
const token = signEmail(TEST_EMAIL);
check('signed token is 64 hex chars', /^[0-9a-f]{64}$/.test(token), token);
check('signing is deterministic', token === signEmail(TEST_EMAIL));
check('different email => different token', token !== signEmail('other@test.dev'));

console.log('\n=== Unsubscribe with invalid token rejected ===');
const bad = await getJson(`/api/unsubscribe?email=${encodeURIComponent(TEST_EMAIL)}&token=deadbeef`);
const badBody = await bad.json();
check('invalid token => 400', bad.status === 400 && badBody.success === false, `status=${bad.status}`);

console.log('\n=== HTML landing page (default = HTML) with valid token ===');
const html = await get(`/api/unsubscribe?email=${encodeURIComponent(TEST_EMAIL)}&token=${token}`);
const htmlText = await html.text();
check('valid link => 200', html.status === 200, `status=${html.status}`);
check('HTML page rendered', /<!DOCTYPE html>/i.test(htmlText));

console.log('\n=== Unsubscribe removes member ===');
const okUrl = `/api/unsubscribe?email=${encodeURIComponent(TEST_EMAIL)}&token=${token}`;
const ok = await getJson(okUrl);
const okBody = await ok.json();
check('unsubscribe => 200', ok.status === 200, `status=${ok.status}`);
check('unsubscribe success=true', okBody.success === true, JSON.stringify(okBody));

console.log('\n=== Idempotent / already gone ===');
const again = await getJson(okUrl);
const againBody = await again.json();
check('repeat unsubscribe still succeeds', again.status === 200 && againBody.success === true, JSON.stringify(againBody));

console.log('\n=== Cleanup ===');
import { kv } from '../src/utils/kv.js';
await kv.srem('subscribers', TEST_EMAIL);

console.log(`\n=== UNSUBSCRIBE TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);