import 'dotenv/config';
import {
  createUnsubscribeToken,
  parseUnsubscribeToken,
  buildUnsubscribeUrl,
  maskEmail,
  TOKEN_TTL_MS,
} from '../src/utils/unsubscribe.js';

let passes = 0;
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`); }
}

console.log('=== Token generation ===');
const email = 'subscriber@example.com';
const token = createUnsubscribeToken(email);
check('token produced', typeof token === 'string' && token.length > 10);
check('token is opaque (no raw email chars leaked)', !token.includes('subscriber@') && !token.includes('example.com'));
check('token has exactly 2 dot-separated parts', token.split('.').length === 2, token);
check('default TTL is 30 days (ms)', TOKEN_TTL_MS === 30 * 24 * 60 * 60 * 1000, String(TOKEN_TTL_MS));

console.log('\n=== Token parsing ===');
const parsed = parseUnsubscribeToken(token);
check('valid token -> valid + original email', parsed.status === 'valid' && parsed.email === email, JSON.stringify(parsed));

console.log('\n=== Expired token ===');
const expiredToken = createUnsubscribeToken(email, Date.now() - 1000);
check('expired token -> expired', parseUnsubscribeToken(expiredToken).status === 'expired', JSON.stringify(parseUnsubscribeToken(expiredToken)));

console.log('\n=== Tampered token ===');
const tampered = token.slice(0, -4) + (token.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
check('tampered sig -> invalid', parseUnsubscribeToken(tampered).status === 'invalid', JSON.stringify(parseUnsubscribeToken(tampered)));
const tamperedPayload = (token.split('.')[0].slice(0, -2) + 'QQ') + '.' + token.split('.')[1];
check('tampered payload -> invalid', parseUnsubscribeToken(tamperedPayload).status === 'invalid');

console.log('\n=== Malformed tokens ===');
check('empty -> invalid', parseUnsubscribeToken('').status === 'invalid');
check('single part -> invalid', parseUnsubscribeToken('abc').status === 'invalid');
check('garbage -> invalid', parseUnsubscribeToken('not.a.valid.token').status === 'invalid');
check('non-string -> invalid', parseUnsubscribeToken(null).status === 'invalid');
check('undefined -> invalid', parseUnsubscribeToken(undefined).status === 'invalid');

console.log('\n=== Subscriber-specific (different email, different token) ===');
const other = createUnsubscribeToken('other@example.com');
check('different email -> different token', other !== token);
check('parses back to other address', parseUnsubscribeToken(other).email === 'other@example.com');

console.log('\n=== URL ===');
const url = buildUnsubscribeUrl(email);
check('url uses token query only', /unsubscribe\?token=[^&]+$/.test(url), url);
check('url has no email param', !url.includes('email='), url);
check('url hides the address', !url.includes('subscriber@example.com'), url);

console.log('\n=== Masking ===');
check('maskEmail long local', maskEmail('john.doe@gmail.com') === 'jo******@gmail.com', maskEmail('john.doe@gmail.com'));
check('maskEmail short local', maskEmail('ab@gmail.com') === 'ab*@gmail.com', maskEmail('ab@gmail.com'));
check('maskEmail no email', maskEmail('nope') === 'nope');

console.log(`\n=== UNSUBSCRIBE TOKEN TEST: ${passes} passed, ${failures} failed ===`);
process.exit(failures ? 1 : 0);