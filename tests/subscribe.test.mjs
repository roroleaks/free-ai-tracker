import 'dotenv/config';
import { kv } from './src/utils/kv.js';

let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const BASE = 'https://free-ai-tracker.vercel.app';
const TEST_EMAIL = `e2e.smoke.${Date.now()}@test.dev`;

async function post(data) {
  return fetch(`${BASE}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
}

console.log('=== Method validation ===');
try {
  const r = await fetch(`${BASE}/api/subscribe`, { method: 'GET', cache: 'no-store' });
  const b = await r.json();
  check('GET => 405', r.status === 405, `status=${r.status}`);
  check('GET => success=false', b.success === false);
} catch (e) { failures++; console.log('FAIL  GET threw:', e.message); }

console.log('\n=== Email regex validation ===');
const badCases = [
  ['', 'empty string'],
  ['not-an-email', 'no @ or domain'],
  ['a@b', 'no TLD'],
  ['foo bar@x.com', 'space in email'],
  ['x@y..com', 'double dot'],
];
for (const [email, label] of badCases) {
  const r = await post({ email });
  const b = await r.json();
  check(`${label} "${email}" => 400`, r.status === 400 && b.success === false, `status=${r.status}${b.error ? ` err=${b.error}` : ''}`);
}

console.log('\n=== Valid new subscription (welcome email fires) ===');
let r1 = await post({ email: TEST_EMAIL });
let b1 = await r1.json();
check('valid email => 200', r1.status === 200, `status=${r1.status}`);
check('success=true', b1.success === true);
check('confirmation message', /subscribed/i.test(b1.message || ''), b1.message);
check('returns email (lowercased)', b1.email === TEST_EMAIL.toLowerCase(), b1.email);
check('subscriberCount is number', typeof b1.subscriberCount === 'number', b1.subscriberCount);

console.log('\n=== Duplicate detection ===');
const r2 = await post({ email: TEST_EMAIL });
const b2 = await r2.json();
check('duplicate => 200', r2.status === 200, `status=${r2.status}`);
check('duplicate message "already subscribed"', /already subscribed/i.test(b2.message || ''), b2.message);
check('subscriberCount unchanged by dup', b2.subscriberCount === b1.subscriberCount, `${b1.subscriberCount}->${b2.subscriberCount}`);

console.log('\n=== Case-insensitivity (uppercase re-subscribe = dup) ===');
const r3 = await post({ email: TEST_EMAIL.toUpperCase() });
const b3 = await r3.json();
check('UPPERCASE same email => already subscribed', /already subscribed/i.test(b3.message || ''), b3.message);

console.log('\n=== Persisted in Upstash ===');
const members = await kv.smembers('subscribers');
check(`test email present in subscribers (total ${members.length})`, members.includes(TEST_EMAIL), members.join(', '));

console.log('\n=== Invalid JSON body ===');
const r4 = await fetch(`${BASE}/api/subscribe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{not valid json',
  cache: 'no-store',
});
const b4 = await r4.json();
check('malformed JSON => 400', r4.status === 400 && b4.success === false, `status=${r4.status}`);

console.log('\n=== Missing email field ===');
const r5 = await post({ name: 'No email' });
const b5 = await r5.json();
check('missing email => 400', r5.status === 400 && b5.success === false, `status=${r5.status}`);

// Cleanup
await kv.srem('subscribers', TEST_EMAIL);
const afterCleanup = await kv.smembers('subscribers');
check('cleanup: test email removed', !afterCleanup.includes(TEST_EMAIL));
console.log(`  subscribers after cleanup (${afterCleanup.length}): ${afterCleanup.join(', ')}`);

console.log(`\n=== SUBSCRIBE TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);