import crypto from 'node:crypto';
import { kv } from '../src/utils/kv.js';
import { logger } from '../src/utils/logger.js';
import { maskEmail } from '../src/utils/unsubscribe.js';
import { isValidEmail } from '../src/utils/email.js';
import { sendManageEmail, sendWelcomeEmail } from '../src/services/email-notifier.js';

const SUBSCRIBERS_KEY = 'subscribers';
const WELCOME_PENDING_KEY = 'subscribers:pending';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  const requestId = crypto.randomUUID();

  if (req.method !== 'POST') {
    logger.warn('manage rejected', { requestId, event: 'method_not_allowed' });
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const forwarded = req.headers?.['x-forwarded-for'] || '';
  // Note: off-Vercel, the XFF first-entry IP is client-controlled.
  const ip = (typeof forwarded === 'string' && forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || 'unknown'));
  const day = new Date().toISOString().slice(0, 10);
  const rateKey = `ratelimit:manage:${ip}:${day}`;
  const hits = await kv.incr(rateKey);
  if (hits > 20) {
    logger.warn('manage rate limited', { requestId, event: 'rate_limited', ip });
    return res.status(429).json({ success: false, error: 'Too many requests. Try again later.' });
  }

  let email = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    email = normalizeEmail(body.email);
  } catch {
    logger.warn('manage rejected', { requestId, event: 'invalid_json' });
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  if (!isValidEmail(email)) {
    logger.warn('manage rejected', { requestId, event: 'invalid_email', emailMasked: email.includes('@') ? maskEmail(email) : '' });
    return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
  }

  // Generic response to avoid disclosing whether the address is subscribed.
  const generic = 'If that address is subscribed, we just emailed a one-time manage link.';

  try {
    const isSubscribed = (await kv.sismember(SUBSCRIBERS_KEY, email)) === 1;
    if (isSubscribed) {
      // If the subscriber has a pending welcome email, retry delivering it and clear the flag on success.
      try {
        const isPending = (await kv.sismember(WELCOME_PENDING_KEY, email)) === 1;
        if (isPending) {
          await sendWelcomeEmail(email);
          await kv.srem(WELCOME_PENDING_KEY, email);
          logger.info('welcome retry sent', { requestId, event: 'welcome_retry_sent', emailMasked: maskEmail(email) });
        }
      } catch (welcomeErr) {
        logger.error('welcome retry failed', { requestId, event: 'welcome_retry_failed', emailMasked: maskEmail(email), error: welcomeErr.message });
      }

      try {
        await sendManageEmail(email);
        logger.info('manage link sent', { requestId, event: 'manage_link_sent', emailMasked: maskEmail(email) });
      } catch (error) {
        logger.error('manage email failed', { requestId, event: 'manage_email_failed', emailMasked: maskEmail(email), error: error.message });
      }
    }
    return res.status(200).json({ success: true, message: generic });
  } catch (error) {
    logger.error('manage storage failed', { requestId, event: 'storage_failed', error: error.message });
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again later.' });
  }
}