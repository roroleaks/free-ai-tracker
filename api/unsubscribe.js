import { kv } from '../src/utils/kv.js';
import { signEmail, SITE_URL } from '../src/utils/unsubscribe.js';

const SUBSCRIBERS_KEY = 'subscribers';

function buildUnsubscribePage(success, email) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unsubscribe - Free AI Tracker</title>
  </head>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:48px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:32px 24px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">${success ? '👋' : '🔒'}</div>
            <h1 style="margin:0;font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;">${success ? 'You are unsubscribed' : 'Confirm unsubscribe'}</h1>
          </td></tr>
          <tr><td style="padding:24px;">
            ${email ? `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:14px;color:#374151;">${success ? 'We removed' : 'This link will remove'} <strong>${email}</strong> ${success ? 'from our mailing list. Sorry to see you go!' : 'from our weekly digest list.'}</p>` : ''}
            ${success
              ? '<p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#374151;">No more weekly digests. You can always <a href="https://free-ai-tracker.vercel.app" style="color:#0284c7;">resubscribe</a> anytime.</p>'
              : '<p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#374151;">Click the button below to confirm you no longer want to receive the weekly Free AI Tracker digest.</p>'}
          </td></tr>
          ${!success && email ? `<tr><td style="padding:0 24px 24px;text-align:center;">
            <a href="${SITE_URL}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${signEmail(email)}" style="display:inline-block;background:#dc2626;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Yes, unsubscribe me</a>
          </td></tr>` : ''}
          <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;">© ${new Date().getFullYear()} Free AI Tracker</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export default async function handler(req, res) {
  const { email = '', token = '' } = req.query || {};

  if (!email || !token || token !== signEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid unsubscribe link' });
  }

  let success = true;
  try {
    await kv.srem(SUBSCRIBERS_KEY, email);
    console.log(`Unsubscribed ${email}`);
  } catch (error) {
    success = false;
    console.error('Unsubscribe failed:', error);
  }

  const wantsJson = (req.headers.accept || '').includes('application/json') || req.query.format === 'json';
  if (!wantsJson) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(buildUnsubscribePage(success, email));
  }

  return res.status(200).json({ success, email, message: success ? 'Unsubscribed successfully' : 'Failed to unsubscribe' });
}