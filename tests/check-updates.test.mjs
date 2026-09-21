let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const BASE = 'https://free-ai-tracker.vercel.app';

console.log('=== POST/GET /api/check-updates (cron handler) ===');
const t0 = Date.now();
let r;
try {
  r = await fetch(`${BASE}/api/check-updates`, { method: 'GET', cache: 'no-store' });
} catch (e) { failures++; console.log('FAIL  fetch threw:', e.message); }

if (r) {
  check('HTTP 200', r.status === 200, `status=${r.status}`);
  let body;
  try { body = await r.json(); } catch { check('valid JSON body', false, 'parse failed'); }
  if (body) {
    check('success=true', body.success === true, JSON.stringify(body).slice(0, 200));
    check('duration reported (ms)', typeof body.duration === 'number' && body.duration > 0, `duration=${body.duration}`);
    check('totalFindings > 100 (multi-source)', typeof body.totalFindings === 'number' && body.totalFindings > 100, `total=${body.totalFindings}`);
    check('relevantFindings <= 15', typeof body.relevantFindings === 'number' && body.relevantFindings <= 15, `relevant=${body.relevantFindings}`);
    check('findings array', Array.isArray(body.findings), typeof body.findings);
    check('findings scored + isNew tagged', Array.isArray(body.findings) && body.findings.every(f => typeof f.score === 'number' && typeof f.isNew === 'boolean'));
    const multiSource = new Set(body.findings?.map(f => f.source) || []);
    check('findings span multiple sources', Array.isArray(body.findings) && body.findings.length > 0 && [...multiSource].length >= 2, [...multiSource].join(','));
    const elapsed = Date.now() - t0;
    console.log(`  completed in ${elapsed}ms (body.duration=${body.duration}ms)`);
    console.log(`  totalFindings=${body.totalFindings} relevantFindings=${body.relevantFindings} sources=[${[...multiSource].join(', ')}]`);
    if (Array.isArray(body.findings) && body.findings.length) {
      console.log('  top 3:');
      body.findings.slice(0, 3).forEach(f => console.log(`    - [${f.source}] ${f.title} (score=${f.score.toFixed(2)} isNew=${f.isNew})`));
    }
  }
}

console.log(`\n=== CHECK-UPDATES TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);