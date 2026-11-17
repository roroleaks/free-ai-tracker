import 'dotenv/config';
import { 
  buildEmailHtml, 
  buildWelcomeEmailHtml, 
  buildManageEmailHtml, 
  excerpt,
  clampTitle,
  dedupeDescription,
  buildItemHtml
} from '../src/services/email-notifier.js';
import { buildUnsubscribeUrl } from '../src/utils/unsubscribe.js';

let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

const findings = [
  {
    title: 'Try Claude 3.5 Sonnet Free',
    description: 'Get $5 in free API credits when you sign up for Anthropic. This is a long description that keeps going and going and going so we can verify the abstract excerpt truncates cleanly at the word boundary for subscribers who open the digest.',
    url: 'https://anthropic.com/claude/free',
    source: 'github',
    score: 0.94,
    isNew: true,
  },
  {
    title: 'Free GPU Hours for Students',
    description: 'Students get 40 free GPU hours every month on Lambda.',
    url: 'https://education.github.com/pack',
    source: 'student-pack',
    score: 0.8,
  },
  {
    title: 'Reddit thread: best free LLM APIs',
    description: 'Users share the best free LLM API tiers.',
    url: 'https://reddit.com/r/LocalLLaMA/xyz',
    source: 'reddit',
  },
];

const html = buildEmailHtml(findings, 'user@test.dev');

console.log('=== Email builder: structure ===');
check('digest shell is HTML', /<!DOCTYPE html>/i.test(html));
check('3 offer cards rendered', (html.match(/View offer/g) || []).length === 3, String((html.match(/View offer/g) || []).length));
check('abstract excerpt included', /subscription for abstract/i.test(html) || /anthropic commonsancyabstract/.test(html) || /free API credits/.test(html), 'excerpt should contain description text');
check('unsubscribe link present (token-based)', html.includes('/api/unsubscribe?token='), 'missing token unsubscribe URL');
check('unsubscribe link does NOT expose raw email', !html.includes('user@test.dev'));
check('NEW badge for isNew', html.includes('>NEW</span>'));
check('TOP PICK badge on top picks', html.includes('>TOP PICK</span>'));
check('relevance pill absent for score >= 0.9', !html.includes('Relevance 94%'));

const lowerScoreCard = buildItemHtml({
  title: 'Community Tool',
  description: 'A handy tool for developers',
  url: 'https://groq.com/tool',
  source: 'groq',
  score: 0.85,
});
check('relevance score badge on non-top-pick with score < 0.9', lowerScoreCard.includes('Relevance 85%'));
check('relevance pill absent for score >= 0.9 on standard card', !buildItemHtml({ title: 'High', description: 'Desc', url: 'https://groq.com', source: 'groq', score: 0.95 }).includes('Relevance'));
check('site name shown', /github\.com|education\.github\.com|reddit\.com/.test(html));

console.log('\n=== Email builder: per-link favicon ===');
check('favicon uses google s2 service', html.includes('www.google.com/s2/favicons'));
check('favicon domain encoded (anthropic)', html.includes('domain=anthropic.com'));

console.log('\n=== Welcome email ===');
const welcome = buildWelcomeEmailHtml('new@user.dev');
check('welcome is HTML', /<!DOCTYPE html>/i.test(welcome));
check('welcome shows email', welcome.includes('new@user.dev'));
check('welcome has token unsubscribe link', welcome.includes('/api/unsubscribe?token=') && welcome.includes('Unsubscribe anytime'));
const manageMail = buildManageEmailHtml('<img src=x onerror=alert(1)>@test.dev');
check('manage email escapes HTML in address', !manageMail.includes('<img') && manageMail.includes('&lt;img'));

console.log('\n=== Unsubscribe URL util ===');
const url = buildUnsubscribeUrl('a@b.dev');
check('url is absolute & token-signed', url.startsWith('https://') && url.includes('token='));
check('url does not expose raw email', !url.includes('a@b.dev') && !url.includes('%40') && !url.includes('a%40b'));

console.log('\n=== HTML injection / sanitization (STEP 6) ===');
const maliciousHtml = buildEmailHtml([
  {
    title: '<img src=x onerror=alert(1)>Free GPU',
    description: '<script>alert("xss")</script>Test body',
    url: 'javascript:alert(1)',
    source: 'reddit',
  },
], 'victim@test.dev');
check('XSS in title escaped', maliciousHtml.includes('&lt;img src=x onerror=alert(1)&gt;Free GPU') && !maliciousHtml.includes('<img src=x onerror=alert(1)>'));
check('unsafe javascript: URL sanitized', !maliciousHtml.includes('href="javascript:alert(1)"') && maliciousHtml.includes('href="#"'));

console.log('\n=== Excerpt word-boundary cut & ellipsis (STEP 13) ===');
const exA = excerpt('a '.repeat(200), 160);
const exB = excerpt('a'.repeat(300), 160);
check('excerpt cut at space + ellipsis', exA.endsWith('…') && !/a$/.test(exA));
check('excerpt without spaces hard-cuts + ellipsis', exB.endsWith('…') && exB.length === 161);

console.log('\n=== Kaggle metadata & signup-credit section (STEP 14 & 21) ===');
const kaggleOffer = {
  title: 'Kaggle: Gemma 2 9B',
  description: 'Open weights model on Kaggle Hub',
  url: 'https://kaggle.com/models/google/gemma-2',
  source: 'kaggle',
};
const creditOffer = {
  title: 'DeepInfra: Qwen 2.5',
  description: 'Fast serverless deployment',
  url: 'https://deepinfra.com/qwen',
  source: 'deepinfra',
  offerType: 'signup-credit',
};
const mixedHtml = buildEmailHtml([kaggleOffer, creditOffer], 'user@test.dev');
check('Kaggle badge and emoji rendered', mixedHtml.includes('🏅 Kaggle') && mixedHtml.includes('#20BEFF'));
check('Signup credit section header present', mixedHtml.includes('Signup &amp; Promo Credits'));
check('PROMO CREDIT badge rendered', mixedHtml.includes('PROMO CREDIT'));

console.log('\n=== Hero fallbacks & MSO ghost tables ===');
check('every hero has background-color: #0f172a', 
  html.includes('background-color: #0f172a') && 
  welcome.includes('background-color: #0f172a') && 
  manageMail.includes('background-color: #0f172a')
);
check('mso conditional present in all three builders', 
  html.includes('<!--[if mso]>') && 
  welcome.includes('<!--[if mso]>') && 
  manageMail.includes('<!--[if mso]>')
);

console.log('\n=== Button styling & touch targets ===');
check('button has offer-btn class and 13px 22px padding', 
  html.includes('class="offer-btn"') && 
  html.includes('padding: 13px 22px')
);

console.log('\n=== No JavaScript / onerror removal ===');
const cleanManageMail = buildManageEmailHtml('user@test.dev');
check('no onerror attribute remains', 
  !html.includes('onerror=') && 
  !welcome.includes('onerror=') && 
  !cleanManageMail.includes('onerror=')
);

console.log('\n=== Title clamping and Description deduplication ===');
const shortTitle = clampTitle('Short Title', 110);
const longTitle = clampTitle('word '.repeat(30), 110);
const noSpaceTitle = clampTitle('x'.repeat(150), 110);
const multiByteTitle = clampTitle('🔥 Special Model '.repeat(15), 110);
check('clampTitle returns short title untouched', shortTitle === 'Short Title');
check('clampTitle cuts at word boundary <= 111 with ellipsis', longTitle.endsWith('…') && longTitle.length <= 111);
check('clampTitle hard-cuts unbroken token at 110 + ellipsis', noSpaceTitle.endsWith('…') && noSpaceTitle.length === 111);
check('clampTitle handles multibyte correctly', multiByteTitle.endsWith('…') && multiByteTitle.length <= 111);

const dedupedDesc = dedupeDescription(
  'GitHub Student Developer Pack AI Perks for Students',
  'GitHub Student Developer Pack AI Perks for Students include free GitHub Copilot and cloud credits'
);
check('description de-dupes when matching title prefix >= 40 chars', !dedupedDesc.startsWith('GitHub Student') && dedupedDesc.includes('free GitHub Copilot'));

console.log('\n=== Promo divider presence ===');
check('promo divider absent when no promo items exist', !html.includes('Signup &amp; Promo Credits'));
check('promo divider present when promo items exist', mixedHtml.includes('Signup &amp; Promo Credits'));

console.log('\n=== Dark mode styles ===');
check('dark-mode prefers-color-scheme block present', html.includes('@media (prefers-color-scheme: dark)'));
check('color-scheme meta tags present', html.includes('<meta name="color-scheme" content="light dark">'));

console.log('\n=== 15-item digest size budget (< 90KB) ===');
const fixture15 = Array.from({ length: 15 }, (_, i) => ({
  title: `AI Platform Free Tier Offer ${i + 1}`,
  description: `Generous free token tier inference and serverless container hosting for model variant ${i + 1} with community weights.`,
  url: `https://example.com/item-${i + 1}`,
  source: ['openrouter', 'groq', 'together', 'google', 'deepinfra', 'cerebras', 'cohere', 'ollama', 'github', 'huggingface', 'aifree', 'reddit', 'student-pack', 'kaggle', 'vercel-ai-sdk'][i % 15],
  score: 0.95 - (i * 0.02),
  isNew: i % 2 === 0,
  offerType: i === 14 ? 'signup-credit' : undefined,
}));
const digest15 = buildEmailHtml(fixture15, 'raouf66@gmail.com');
const byteLength15 = Buffer.byteLength(digest15, 'utf8');
console.log(`Rendered 15-item digest size: ${byteLength15} bytes (${(byteLength15 / 1024).toFixed(1)} KB)`);
check('total length < 90,000 characters for a 15-item fixture', digest15.length < 90000, `length was ${digest15.length}`);

console.log(`\n=== EMAIL-HTML TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);
