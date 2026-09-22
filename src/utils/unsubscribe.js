import crypto from 'node:crypto';

const SITE_URL = process.env.SITE_URL || 'https://free-ai-tracker.vercel.app';

function signEmail(email) {
  const secret = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.BREVO_API_KEY || 'free-ai-tracker';
  return crypto.createHmac('sha256', secret).update(email).digest('hex');
}

export function buildUnsubscribeUrl(email) {
  return `${SITE_URL}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${signEmail(email)}`;
}

export { signEmail, SITE_URL };