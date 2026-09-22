import { kv } from '../src/utils/kv.js';
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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let email = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    email = normalizeEmail(body.email);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
  }

  // Generic response to avoid disclosing whether the address is subscribed.
  const generic = 'If that address is subscribed, we just emailed a one-time manage link.';

  try {
    const isSubscribed = (await kv.sismember(SUBSCRIBERS_KEY, email)) === 1;
    if (isSubscribed) {
      try {
        await sendManageEmail(email);
        console.log(`Manage link emailed to ${email}`);
      } catch (error) {
        console.error(`Manage email failed for ${email}:`, error.message);
      }
    }
    return res.status(200).json({ success: true, message: generic });
  } catch (error) {
    console.error('Failed to check subscription:', error);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again later.' });
  }
}