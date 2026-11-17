import { isValidEmail } from '../src/utils/email.js';

const cases = {
  'x@y..com': false,
  'a@b': false,
  'foo..bar@x.com': false,
  'a@-b.com': false,
  'bad space@x.com': false,
  'x@y.': false,
  '.lead@x.com': false,
  'user@gmail.com': true,
  'e2e.smoke.123@test.dev': true,
  'test@example.com': true,
  'user.name+tag@sub.domain.co': true,
  'raouf66@gmail.com': true,
  'a"onmouseover="alert(1)"@ab.com': false,
  "a'b@ab.com": false,
  '<img src=x>@ab.com': false,
};
let pass = true;
for (const [e, expect] of Object.entries(cases)) {
  const got = isValidEmail(e);
  if (got !== expect) { pass = false; console.log('MISMATCH', e, 'expect', expect, 'got', got); }
  else console.log('OK', JSON.stringify(e), '=>', got);
}
console.log(pass ? 'ALL CASES PASS' : 'FAILURES');
process.exit(pass ? 0 : 1);
