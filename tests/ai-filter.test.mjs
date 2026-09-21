import {
  filterAndScore,
  isNewModel,
  NEW_MODEL_DAYS,
} from './src/services/ai-filter.js';

const DAY_MS = 24 * 60 * 60 * 1000;
let allPass = true;
let asserts = 0;
const failures = [];

function check(name, cond, detail = '') {
  asserts++;
  if (!cond) { allPass = false; failures.push(name + (detail ? ` — ${detail}` : '')); }
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}` + (detail ? ` (${detail})` : ''));
}

// --- scoreItem / boost tests via filterAndScore output ---
const now = Date.now();
const mk = (title, opts = {}) => ({
  title,
  description: opts.description || '',
  url: opts.url || 'https://example.com/x',
  source: opts.source || 'github',
  date: opts.daysOld !== undefined ? new Date(now - opts.daysOld * DAY_MS).toISOString() : new Date().toISOString(),
});

console.log('=== scoreItem: strong hint boosts ===');
const r1 = await filterAndScore([mk('Free API forever — no credit card needed model', { source: 'github' })]);
check('"100% free"+hints push score >= 0.8', (r1[0]?.score || 0) >= 0.8, `score=${r1[0]?.score}`);
check('score never exceeds 1', r1[0]?.score <= 1, `score=${r1[0]?.score}`);

console.log('\n=== scoreItem: source boosts ===');
const ghItem = mk('A modest new api', { source: 'github', description: 'has an llm endpoint' });
const ghRes = await filterAndScore([ghItem]);
const orItem = { ...mk('A modest new api', { source: 'openrouter', description: 'has an llm endpoint' }) };
const orRes = await filterAndScore([orItem]);
console.log('  DEBUG ghRes:', JSON.stringify(ghRes));
console.log('  DEBUG orRes:', JSON.stringify(orRes));
const githubBoost = ghRes[0].score;
const openrouterBase = orRes[0].score;
check('github source boost (+0.15) > openrouter (+0.10)', githubBoost > openrouterBase, `github=${githubBoost} openrouter=${openrouterBase}`);

console.log('\n=== scoreItem: isNew recency boost (+0.15) ===');
const freshItem = mk('Fresh launch of a new open weights model', { daysOld: 0 });
const oldItem = mk('Fresh launch of a new open weights model', { daysOld: 10 });
console.log('  DEBUG freshItem:', JSON.stringify(freshItem));
console.log('  DEBUG oldItem:', JSON.stringify(oldItem));
const fresh = (await filterAndScore([freshItem]))[0];
const old = (await filterAndScore([oldItem]))[0];
check('fresh item gets isNew=true', fresh.isNew === true);
check('old (>7d) item gets isNew=false', old.isNew === false);
check('fresh item score = old score + 0.15 (recency boost)', Math.abs(fresh.score - old.score - 0.15) < 1e-9, `fresh=${fresh.score} old=${old.score}`);

console.log('\n=== isNew 7-day rolling window ===');
check('0d => new', isNewModel(mk('x', { daysOld: 0 })));
check('6.9d => new', isNewModel(mk('x', { daysOld: 6.9 })));
check('7.0d => new (grace 1h)', isNewModel(mk('x', { daysOld: 7.0 })));
check('7.1d => NOT new', !isNewModel(mk('x', { daysOld: 7.1 })));
check('30d => NOT new', !isNewModel(mk('x', { daysOld: 30 })));
check('invalid date => NOT new', !isNewModel({ title: 'x', date: 'not-a-date' }));
check('missing date => NOT new', !isNewModel({ title: 'x' }));
check('false (null) finding => NOT new', !isNewModel(null));
check('NEW_MODEL_DAYS exported = 7', NEW_MODEL_DAYS === 7);

console.log('\n=== dedupe: identical titles collapse ===');
const dupInput = [
  mk('Duplicate Open Source Project', { description: 'aaa' }),
  mk('Duplicate   Open Source   Project', { description: 'bbb same slug' }),
  mk('Something Completely Different', {}),
];
const deduped = await filterAndScore(dupInput);
const dupCount = deduped.filter(f => f.title.toLowerCase().startsWith('duplicate open source')).length;
check('duplicate slug deduped to 1', dupCount === 1, `count=${dupCount}`);
check('different item retained', deduped.some(f => f.title.includes('Completely Different')));
check('total unique results = 2', deduped.length === 2, `len=${deduped.length}`);

console.log('\n=== cap at 15 ===');
const many = [];
for (let i = 0; i < 50; i++) many.push(mk(`Unique title ${i} free API open source release`, { daysOld: i % 10 }));
const capped = await filterAndScore(many);
check('max 15 results returned', capped.length === 15, `len=${capped.length}`);
check('sorting by score desc (first >= last)', capped[0].score >= capped[capped.length - 1].score);

console.log('\n=== null/undefined input robustness ===');
const safe = await filterAndScore([null, undefined, false, 0, mk('Valid free model', {})]);
check('nullish entries filtered out, valid kept', safe.length === 1 && safe[0].title === 'Valid free model', `len=${safe.length}`);

console.log('\n=== ALL AI-FILTER TESTS ===');
console.log(asserts + ' assertions, ' + failures.length + ' failed');
if (failures.length) failures.forEach(f => console.log('  FAILED:', f));
console.log(allPass ? 'RESULT: ALL PASS' : 'RESULT: FAILURES');
process.exit(allPass ? 0 : 1);