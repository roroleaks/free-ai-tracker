import 'dotenv/config';
import { buildEmailHtml, buildWelcomeEmailHtml, excerpt } from '../src/services/email-notifier.js';
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
check('relevance score badge', html.includes('Relevance 94%'));
check('site name shown', /github\.com|education\.github\.com|reddit\.com/.test(html));

console.log('\n=== Email builder: per-link favicon ===');
check('favicon uses google s2 service', html.includes('www.google.com/s2/favicons'));
check('favicon domain encoded (anthropic)', html.includes('domain=anthropic.com'));

console.log('\n=== Welcome email ===');
const welcome = buildWelcomeEmailHtml('new@user.dev');
check('welcome is HTML', /<!DOCTYPE html>/i.test(welcome));
check('welcome shows email', welcome.includes('new@user.dev'));
check('welcome has token unsubscribe link', welcome.includes('/api/unsubscribe?token=') && welcome.includes('Unsubscribe anytime'));

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

console.log(`\n=== EMAIL-HTML TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);