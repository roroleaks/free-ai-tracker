import crypto from 'node:crypto';
import { kv } from '../src/utils/kv.js';
import { logger } from '../src/utils/logger.js';
import { maskEmail } from '../src/utils/unsubscribe.js';
import { sendManageEmail } from '../src/services/email-notifier.js';

const SUBSCRIBERS_KEY = 'subscribers';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
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

export default async function handler(req, res) {
  const requestId = crypto.randomUUID();

  if (req.method !== 'POST') {
    logger.warn('manage rejected', { requestId, event: 'method_not_allowed' });
    return res.status(405).json({ success: false, error: 'Method not allowed' });
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