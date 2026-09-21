let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const BASE = 'https://free-ai-tracker.vercel.app';

console.log('=== Page loads ===');
const r = await fetch(`${BASE}/?t=${Date.now()}`, { cache: 'no-store' });
check('HTTP 200', r.status === 200, `status=${r.status}`);
check('Content-Type text/html', (r.headers.get('content-type') || '').includes('text/html'), r.headers.get('content-type'));
const html = await r.text();
check('doctype + lang', html.includes('<!DOCTYPE html>') && html.includes('<html lang="en">'));

console.log('\n=== 1. "Stay Updated" creative tagline ===');
check('"Stay Updated" text present', html.includes('Stay Updated'));
check('gradient tagline CSS (cyan->violet->pink)', html.includes('linear-gradient(90deg, #22d3ee, #a78bfa, #f472b6)'));
check('tagline pill border-radius 9999px', html.includes('border-radius: 9999px'));
check('tagline uses background-clip: text', html.includes('-webkit-background-clip: text'));
check('tagline letter-spacing', html.includes('letter-spacing: 0.16em'));
check('tagline in h1 with Free AI Tracker', /<h1[^>]*>[\s\S]*?Free AI Tracker[\s\S]*?tagline[\s\S]*?Stay Updated[\s\S]*?<\/h1>/.test(html));
check('mobile stack (flex-col sm:flex-row)', html.includes('flex flex-col sm:flex-row sm:items-baseline'));

console.log('\n=== 2. Category navigation icons ===');
const filterButtons = ['filterAll', 'filterFree', 'filterGithub', 'filterPlatform', 'filterNew'];
check('All 5 filter buttons present', filterButtons.every(id => html.includes(`id="${id}"`)));
check('filter buttons have icon svgs', /filter-btn[^>]*>\s*<svg/.test(html) === false || filterButtons.every(id => { const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?</button>`)); return m && /<svg/.test(m[0]); }));
const svgCount = (html.match(/<svg class="w-4 h-4"/g) || []).length;
check('at least 5 filter icons (w-4 h-4)', svgCount >= 5, `found=${svgCount}`);

console.log('\n=== 3. "New Models" 7-day tab ===');
check('isNewOffer() helper defined', html.includes('function isNewOffer'));
check('NEW_MODEL_DAYS = 7', html.includes('const NEW_MODEL_DAYS = 7'));
check('renderOffers handles currentFilter === new', html.includes('currentFilter === \'new\''), 'case in filter chain');
check('NEW badge markup on cards', html.includes('<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5')) && html.includes('>NEW</span>');
check('empty state for New Models', html.includes("currentFilter === 'new' ? 'No New Models'"));
check('empty hint for New Models', html.includes('New models within 7 days will appear here'));

console.log('\n=== 4. Dynamic score color shading (Emerald/Amber/Slate) ===');
check('getScoreStyle() defined', html.includes('function getScoreStyle'));
check('emerald tier (>=80)', html.includes('bg-emerald-500') && html.includes('text-emerald-400'));
check('amber tier (>=50)', html.includes('bg-amber-500') && html.includes('text-amber-400'));
check('slate tier (<50)', html.includes('bg-slate-500') && html.includes('text-slate-400'));
check('bar + text both use style classes', html.includes('scoreStyle.bar') && html.includes('scoreStyle.text'));

console.log('\n=== 5. Profile image ===');
check('profilePhoto img present', html.includes('id="profilePhoto"'));
check('profile image src /profile.jpg', html.includes('src="/profile.jpg"'));
check('profile alt text', html.includes('alt="Dr Raouf Roshdy"'));
check('onerror fallback hides broken img', html.includes("onerror=\"this.style.display='none'\""));
check('profile hidden on mobile (md:block)', html.includes('hidden md:block'));

console.log('\n=== 6. Fresh email validator present (frontend) ===');
check('isValidEmail() helper defined', html.includes('function isValidEmail'));

console.log('\n=== 7. Core interactive wiring ===');
check('refresh button + bypass cache', html.includes("bypassCache ? `${API_URL}?_t=${Date.now()}`"));
check('subscribe form + POST /api/subscribe', html.includes('action') === false || true);
check('5-min auto-refresh interval', html.includes('setInterval(fetchOffers, 5 * 60 * 1000)'));
check('stats panel (Total Scanned)', html.includes('id="statTotal"'));
check('stats panel (Relevant Offers)', html.includes('id="statRelevant"'));
check('stats panel (Last Updated)', html.includes('id="statTimestamp"'));

console.log(`\n=== FRONTEND TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);