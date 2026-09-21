import { kv } from '../src/utils/kv.js';
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

const SUBSCRIBERS_KEY = 'subscribers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let email = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
  }

  try {
    const added = await kv.sadd(SUBSCRIBERS_KEY, email);
    const subscribers = await kv.smembers(SUBSCRIBERS_KEY);

    if (added === 1) {
      try {
        await sendWelcomeEmail(email);
        console.log(`Welcome email sent to ${email}`);
      } catch (welcomeError) {
        console.error(`Welcome email failed for ${email}:`, welcomeError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: added === 1 ? 'You are subscribed to Free AI Tracker alerts! 🎉' : 'You are already subscribed to Free AI Tracker alerts 📬',
      email,
      subscriberCount: subscribers.length,
    });
  } catch (error) {
    console.error('Failed to save subscriber:', error);
    res.status(500).json({ success: false, error: 'Failed to subscribe. Please try again later.' });
  }
}