export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
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

export default isValidEmail;
