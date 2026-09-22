import 'dotenv/config';
import { kv } from '../src/utils/kv.js';

let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const BASE = 'https://free-ai-tracker.vercel.app';
const BASE_EMAIL = `idem.${Date.now()}@test.dev`;

async function post(email) {
  return fetch(`${BASE}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  });
}

function countSubscribed(responses) {
  return responses.filter(r => /^You are subscribed to Free AI Tracker alerts/.test(r.message || '')).length;
}

console.log('=== Baseline: current subscriber count ===');
const before = await kv.smembers('subscribers');
check('read baseline count', Array.isArray(before));
const baselineCount = before.length;
console.log(`  baseline subscribers = ${baselineCount}`);

console.log('\n=== 1. Rapid double submit (same email, concurrent) ===');
const r1p = post(BASE_EMAIL);
const r2p = post(BASE_EMAIL);
const [r1, r2] = await Promise.all([r1p, r2p]);
const b1 = await r1.json();
const b2 = await r2.json();
const msgs = [b1, b2];
check('both concurrent requests return 200', r1.status === 200 && r2.status === 200, `${r1.status}/${r2.status}`);
check('exactly ONE subscribed side effect', countSubscribed(msgs) === 1, JSON.stringify(msgs.map(m => m.message)));
check('other response says "already subscribed"', msgs.some(m => /already subscribed/i.test(m.message || '')), JSON.stringify(msgs.map(m => m.message)));
check('normalized email returned', msgs.every(m => m.email === BASE_EMAIL.toLowerCase()), JSON.stringify(msgs.map(m => m.email)));

console.log('\n=== Persisted exactly once (atomic unique constraint) ===');
const after = await kv.smembers('subscribers');
const occurrences = after.filter(e => e === BASE_EMAIL).length;
check('email appears exactly once in set', occurrences === 1, `occurrences=${occurrences}`);
check('subscriberCount incremented by exactly 1', after.length === baselineCount + 1, `${baselineCount} -> ${after.length}`);

console.log('\n=== 2. Case-insensitivity: UPPERCASE = same subscriber ===');
const up = await post(BASE_EMAIL.toUpperCase());
const upB = await up.json();
check('uppercase => already subscribed', /already subscribed/i.test(upB.message || ''), upB.message);
check('uppercase returns lowercased email', upB.email === BASE_EMAIL.toLowerCase(), upB.email);

console.log('\n=== 3. Whitespace tolerance: "  email  " = same subscriber ===');
const ws = await post(`  ${BASE_EMAIL.toUpperCase()}  `);
const wsB = await ws.json();
check('whitespace + case => already subscribed', /already subscribed/i.test(wsB.message || ''), wsB.message);
check('whitespace trimmed + lowercased in response', wsB.email === BASE_EMAIL.toLowerCase(), wsB.email);

console.log('\n=== 4. Duplicate email: no double welcome / no re-add ===');
const dup = await post(BASE_EMAIL);
const dupB = await dup.json();
check('duplicate => already subscribed', /already subscribed/i.test(dupB.message || ''), dupB.message);
check('subscriberCount unchanged by duplicate', dupB.subscriberCount === after.length, `${after.length} -> ${dupB.subscriberCount}`);

console.log('\n=== 5. Local KV atomicity: concurrent sadd returns exactly one 1 ===');
const atomicEmail = `atomic.${Date.now()}@test.dev`;
const results = await Promise.all(Array.from({ length: 8 }, () => kv.sadd('subscribers', atomicEmail)));
const ones = results.filter(r => r === 1).length;
check('8 concurrent sadds => exactly one 1', ones === 1, JSON.stringify(results));
check('7 concurrent sadds return 0', results.filter(r => r === 0).length === 7, JSON.stringify(results));
await kv.srem('subscribers', atomicEmail);

console.log('\n=== 6. Method enforcement preserved ===');
const get = await fetch(`${BASE}/api/subscribe`, { method: 'GET', cache: 'no-store' });
const getB = await get.json();
check('GET => 405 success=false', get.status === 405 && getB.success === false, `status=${get.status}`);

console.log('\n=== Cleanup ===');
await kv.srem('subscribers', BASE_EMAIL);
const cleaned = await kv.smembers('subscribers');
check('test emails removed from prod', !cleaned.includes(BASE_EMAIL) && !cleaned.includes(`atomic.${Date.now()}@test.dev`));

console.log(`\n=== SUBSCRIBE-IDEMPOTENCY TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);