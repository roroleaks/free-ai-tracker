import { kv } from '../src/utils/kv.js';
import { parseUnsubscribeToken, maskEmail, SITE_URL } from '../src/utils/unsubscribe.js';

const SUBSCRIBERS_KEY = 'subscribers';

function page(title, bodyHtml, kind = 'info') {
  const icon = kind === 'success' ? '✅' : kind === 'error' ? '⚠️' : '🔒';
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Free AI Tracker</title>
  </head>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:48px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:32px 24px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">${icon}</div>
            <h1 style="margin:0;font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;">${title}</h1>
          </td></tr>
          <tr><td style="padding:24px;text-align:center;">
            <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#374151;">${bodyHtml}</p>
            <a href="${SITE_URL}" style="display:inline-block;background:#0284c7;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Back to Free AI Tracker</a>
          </td></tr>
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
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { token = '' } = req.query || {};
  const result = parseUnsubscribeToken(token);

  const wantsJson = (req.headers.accept || '').includes('application/json') || req.query.format === 'json';

  if (result.status !== 'valid') {
    const generic = 'This unsubscribe link is invalid or has expired. If you believe you are still subscribed, use the link from a recent email or contact support — we never want unwanted mail in your inbox.';
    console.warn(`Unsubscribe token rejected (status=${result.status})`);
    if (wantsJson) {
      return res.status(400).json({ success: false, error: generic });
    }
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page('Unsubscribe Link Invalid or Expired', generic));
  }

  const email = result.email;
  try {
    const removed = await kv.srem(SUBSCRIBERS_KEY, email);
    console.log(`Unsubscribed ${maskEmail(email)} (setRemoved=${removed})`);
  } catch (error) {
    console.error('Unsubscribe storage failed:', error);
    const msg = 'Something went wrong while processing your request. Please try again shortly.';
    if (wantsJson) return res.status(500).json({ success: false, error: msg });
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(page('Something Went Wrong', msg, 'error'));
  }

  if (wantsJson) {
    return res.status(200).json({ success: true, email, message: 'Unsubscribed successfully' });
  }

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(page(
    'You are Unsubscribed',
    `We have turned off weekly digests for <strong>${maskEmail(email)}</strong>. Sorry to see you go — you can <a href="${SITE_URL}" style="color:#0284c7;">resubscribe</a> anytime.`,
    'success'
  ));
}