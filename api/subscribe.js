import crypto from 'node:crypto';
import { kv } from '../src/utils/kv.js';
import { logger } from '../src/utils/logger.js';
import { maskEmail } from '../src/utils/unsubscribe.js';
import { sendWelcomeEmail } from '../src/services/email-notifier.js';

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

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

const SUBSCRIBERS_KEY = 'subscribers';
const WELCOME_PENDING_KEY = 'subscribers:pending';

export default async function handler(req, res) {
  const requestId = crypto.randomUUID();

  if (req.method !== 'POST') {
    logger.warn('subscribe rejected', { requestId, event: 'method_not_allowed' });
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let email = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    email = normalizeEmail(String(body.email || ''));
  } catch {
    logger.warn('subscribe rejected', { requestId, event: 'invalid_json' });
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  if (!isValidEmail(email)) {
    logger.warn('subscribe rejected', { requestId, event: 'invalid_email', emailMasked: email.includes('@') ? maskEmail(email) : '' });
    return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
  }

  try {
    // Atomic unique constraint: SADD returns 1 only for the first concurrent
    // writer with this canonical email; all others get 0 and follow the
    // already-active path (no duplicate welcome email).
    const added = await kv.sadd(SUBSCRIBERS_KEY, email);

    if (added === 1) {
      // Mark the welcome as unconfirmed until up-send completes. If the mail
      // provider times out or fails, the subscription stays durable and the
      // pending flag stays set: retries hit "already subscribed" and never
      // re-queue another email, so every retry cannot multiply mail traffic.
      await kv.sadd(WELCOME_PENDING_KEY, email);
      try {
        await sendWelcomeEmail(email);
        await kv.srem(WELCOME_PENDING_KEY, email);
        logger.info('subscribe confirmed', { requestId, event: 'welcome_sent', emailMasked: maskEmail(email) });
      } catch (welcomeError) {
        logger.error('subscribe stored but welcome email failed', {
          requestId,
          event: 'welcome_failed',
          emailMasked: maskEmail(email),
          error: welcomeError.message,
        });
      }
    } else {
      logger.info('subscribe already active', { requestId, event: 'already_subscribed', emailMasked: maskEmail(email) });
    }

    const subscriberCount = await kv.scard(SUBSCRIBERS_KEY);

    res.status(200).json({
      success: true,
      message: added === 1 ? 'You are subscribed to Free AI Tracker alerts! 🎉' : 'You are already subscribed to Free AI Tracker alerts 📬',
      email,
      subscriberCount,
    });
  } catch (error) {
    logger.error('subscribe storage failed', { requestId, event: 'storage_failed', error: error.message });
    res.status(500).json({ success: false, error: 'Failed to subscribe. Please try again later.' });
  }
}