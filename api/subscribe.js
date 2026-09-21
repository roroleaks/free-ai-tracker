import { kv } from '../src/utils/kv.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
  }

  try {
    await kv.sadd(SUBSCRIBERS_KEY, email);
    const subscribers = await kv.smembers(SUBSCRIBERS_KEY);

    res.status(200).json({
      success: true,
      message: 'You are subscribed to Free AI Tracker alerts! 🎉',
      email,
      subscriberCount: subscribers.length,
    });
  } catch (error) {
    console.error('Failed to save subscriber:', error);
    res.status(500).json({ success: false, error: 'Failed to subscribe. Please try again later.' });
  }
}