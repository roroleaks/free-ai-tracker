import 'dotenv/config';

import { kv } from '../src/utils/kv.js';

let passes = 0;
let failures = 0;

function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const TS_KEY = '_test_offers';
const SUB_KEY = '_test_subscribers';

console.log('=== KV set/get round-trip ===');
const payload = { timestamp: new Date().toISOString(), totalFindings: 3, relevantFindings: 2, findings: [{ title: 'Test', score: 0.7 }] };
await kv.set(TS_KEY, payload);
const back = await kv.get(TS_KEY);
check('set then get returns object', back && back.totalFindings === 3 && back.findings.length === 1, JSON.stringify(back));
check('timestamp preserved', back && new Date(back.timestamp) instanceof Date || (back && !isNaN(Date.parse(back.timestamp))));

console.log('\n=== KV subscribers set ops ===');
const emailA = 'test-a@example.com';
const emailB = 'test-b@example.com';
await kv.srem(SUB_KEY, emailA);
await kv.srem(SUB_KEY, emailB);
const added1 = await kv.sadd(SUB_KEY, emailA);
const added2 = await kv.sadd(SUB_KEY, emailA); // duplicate
const added3 = await kv.sadd(SUB_KEY, emailB);
check('sadd returns 1 for new member', added1 === 1, `added1=${added1}`);
check('sadd returns 0 for duplicate', added2 === 0, `added2=${added2}`);
check('sadd returns 1 for second new member', added3 === 1, `added3=${added3}`);
const members = await kv.smembers(SUB_KEY);
check('smembers returns both unique', members.length === 2 && members.includes(emailA) && members.includes(emailB), JSON.stringify(members));
const removed = await kv.srem(SUB_KEY, emailA);
check('srem removes member', removed >= 1);
const after = await kv.smembers(SUB_KEY);
check('smembers after removal = 1', after.length === 1 && after[0] === emailB, JSON.stringify(after));

console.log('\n=== KV real keys in production ===');
const latest = await kv.get('latest_ai_offers');
check('latest_ai_offers exists', Boolean(latest), 'null');
if (latest) {
  check('has findings array', Array.isArray(latest.findings), typeof latest.findings);
  check('has timestamps', typeof latest.timestamp === 'string' && !isNaN(Date.parse(latest.timestamp)));
  check(`latest_ai_offers: total=${latest.totalFindings} relevant=${latest.relevantFindings}`, latest.relevantFindings >= 0);
}
const subs = await kv.smembers('subscribers');
check('subscribers key exists', Array.isArray(subs), 'null');
if (subs.length) console.log(`  subscribers (${subs.length}): ${subs.join(', ')}`);

// cleanup test keys
await kv.srem(SUB_KEY, emailB);
await kv.srem(SUB_KEY, emailA);

console.log(`\n=== KV TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);