const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  if (!EMAIL_REGEX.test(email)) return false;
  if (email.length > 254) return false;
  const [local, domain] = email.split('@');
  if (local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) return false;
  if (/[-.]$/.test(domain)) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,}$/.test(tld)) return false;
  if (labels.some((l) => l.length === 0 || /^[-]/.test(l) || /[-]$/.test(l))) return false;
  return true;
}

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
};
let pass = true;
for (const [e, expect] of Object.entries(cases)) {
  const got = isValidEmail(e);
  if (got !== expect) { pass = false; console.log('MISMATCH', e, 'expect', expect, 'got', got); }
  else console.log('OK', JSON.stringify(e), '=>', got);
}
console.log(pass ? 'ALL CASES PASS' : 'FAILURES');
process.exit(pass ? 0 : 1);