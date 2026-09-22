import crypto from 'node:crypto';

const SITE_URL = process.env.SITE_URL || 'https://free-ai-tracker.vercel.app';
const TOKEN_TTL_DAYS = Number(process.env.UNSUBSCRIBE_TOKEN_TTL_DAYS || 30);
const TOKEN_TTL_MS = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

function secret() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.BREVO_API_KEY || 'free-ai-tracker';
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function b64urlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Signed, expiring, subscriber-specific unsubscribe token.
 * payload = base64url(`<email>.<expiresAtMs>`), signature = HMAC-SHA256(secret, payload).
 * The email is never a raw query parameter — it lives only inside the signed token.
 */
export function createUnsubscribeToken(email, expiresAtMs = Date.now() + TOKEN_TTL_MS) {
  const payload = b64url(`${email}.${expiresAtMs}`);
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseUnsubscribeToken(token) {
  if (!token || typeof token !== 'string') return { status: 'invalid' };
  const parts = token.split('.');
  if (parts.length !== 2) return { status: 'invalid' };

  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

  let a, b;
  try {
    a = Buffer.from(sig, 'base64url');
    b = Buffer.from(expected, 'base64url');
  } catch {
    return { status: 'invalid' };
  }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { status: 'invalid' };
  }

  let decoded;
  try {
    decoded = b64urlDecode(payload);
  } catch {
    return { status: 'invalid' };
  }
  const sep = decoded.lastIndexOf('.');
  if (sep <= 0) return { status: 'invalid' };
  const email = decoded.slice(0, sep);
  const expiresAt = Number(decoded.slice(sep + 1));
  if (!email.includes('@') || !Number.isFinite(expiresAt)) return { status: 'invalid' };

  if (Date.now() > expiresAt) return { status: 'expired' };
  return { status: 'valid', email };
}

export function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  const head = local.length <= 2 ? local : local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

export function buildUnsubscribeUrl(email) {
  return `${SITE_URL}/api/unsubscribe?token=${createUnsubscribeToken(email)}`;
}

export { SITE_URL, TOKEN_TTL_MS, secret };