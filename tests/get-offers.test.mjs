let passes = 0;
let failures = 0;

function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const BASE = 'https://free-ai-tracker.vercel.app';

console.log('=== GET /api/get-offers ===');
let r;
try {
  r = await fetch(`${BASE}/api/get-offers?t=${Date.now()}`, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
} catch (e) { failures++; console.log('FAIL  fetch threw:', e.message); r = null; }

if (r) {
  check('HTTP 200', r.status === 200, `status=${r.status}`);
  const cc = r.headers.get('cache-control') || '';
  check('Cache-Control present (public/s-maxage)', /public/.test(cc) && /s-maxage=300/.test(cc), cc);
  check('Content-Type application/json', (r.headers.get('content-type') || '').includes('application/json'), r.headers.get('content-type'));

  let body;
  try { body = await r.json(); } catch { check('valid JSON body', false, 'parse failed'); }
  if (body) {
    check('success=true', body.success === true);
    check('has timestamp (ISO)', typeof body.timestamp === 'string' && !isNaN(Date.parse(body.timestamp)));
    check('totalFindings is number', typeof body.totalFindings === 'number');
    check('relevantFindings is number', typeof body.relevantFindings === 'number');
    check('findings is array', Array.isArray(body.findings), typeof body.findings);
    check('findings length matches relevantFindings', Array.isArray(body.findings) && (body.findings.length === 0 || body.findings.length === body.relevantFindings), `len=${body.findings?.length} relevant=${body.relevantFindings}`);
    if (Array.isArray(body.findings) && body.findings.length) {
      const f = body.findings[0];
      check('finding has title', typeof f.title === 'string' && f.title.length > 0);
      check('finding has description', typeof f.description === 'string');
      check('finding has url (http)', typeof f.url === 'string' && f.url.startsWith('http'));
      check('finding has valid source', ['github', 'openrouter', 'huggingface', 'vercel-ai-sdk', 'reddit', 'aifree', 'student-pack'].includes(f.source), f.source);
      check('finding has valid date', !isNaN(Date.parse(f.date)));
      check('finding has score 0..1', typeof f.score === 'number' && f.score >= 0 && f.score <= 1);
      check('finding has isNew boolean', typeof f.isNew === 'boolean');
      const newCount = body.findings.filter(x => x.isNew).length;
      check(`isNew flags present (${newCount}/${body.findings.length} new)`, newCount >= 0);
    }
    const sources = new Set(body.findings?.map(f => f.source) || []);
    console.log(`  sources in payload: ${[...sources].join(', ') || '(none)'}`);
  }
}

console.log('\n=== GET /api/get-offers (raw headers) ===');
try {
  const r2 = await fetch(`${BASE}/api/get-offers?t=${Date.now()}`, { cache: 'no-store' });
  console.log('  status:', r2.status, '| content-type:', r2.headers.get('content-type'), '| cache-control:', r2.headers.get('cache-control'));
} catch (e) { console.log('  FAIL fetch threw:', e.message); failures++; }

console.log(`\n=== GET-OFFERS TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);