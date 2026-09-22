import fetch from 'node-fetch';
import { buildUnsubscribeUrl } from '../utils/unsubscribe.js';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const SOURCE_META = {
  github: { label: 'GitHub', color: '#24292f', light: '#f6f8fa' },
  openrouter: { label: 'OpenRouter', color: '#7c3aed', light: '#f5f3ff' },
  huggingface: { label: 'HuggingFace', color: '#f59e0b', light: '#fffbeb' },
  reddit: { label: 'Reddit', color: '#ff4500', light: '#fff5f0' },
  aifree: { label: 'AI Free', color: '#059669', light: '#ecfdf5' },
  'student-pack': { label: 'Student Pack', color: '#0369a1', light: '#f0f9ff' },
  'vercel-ai-sdk': { label: 'Vercel AI SDK', color: '#000000', light: '#f3f4f6' },
};

function sourceMeta(source) {
  return SOURCE_META[source] || { label: source, color: '#4b5563', light: '#f3f4f6' };
}

function stripTags(text) {
  return (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function excerpt(text, max = 160) {
  const clean = stripTags(text);
  if (!clean) return '';
  const words = (clean.length > max ? clean.slice(0, max) : clean);
  const cut = words.lastIndexOf(' ');
  return words.length > max ? `${words.slice(0, cut)}…` : words;
}

function getDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function siteDisplay(url) {
  const domain = getDomain(url);
  const known = {
    'education.github.com': 'GitHub Education',
    'github.com': 'GitHub',
    'huggingface.co': 'HuggingFace',
    'reddit.com': 'Reddit',
    'aifree.dev': 'AI Free',
    'openrouter.ai': 'OpenRouter',
  };
  return known[domain] || domain || 'Learn more';
}

function faviconUrl(url) {
  const domain = getDomain(url);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';
}

function sourceEmoji(source) {
  return {
    github: '📦',
    openrouter: '🔌',
    huggingface: '🤗',
    reddit: '💬',
    aifree: '🎁',
    'student-pack': '🎓',
    'vercel-ai-sdk': '▲',
  }[source] || '⚡';
}

function buildItemHtml(f, index) {
  const meta = sourceMeta(f.source);
  const icon = faviconUrl(f.url);
  const site = siteDisplay(f.url);
  const abstract = excerpt(f.description, 180) || 'No description available';
  const score = typeof f.score === 'number' ? Math.round(f.score * 100) : null;
  const isNew = f.isNew === true;

  return `
    <tr>
      <td style="padding: 0 0 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 14px; border-collapse: separate; overflow: hidden; background: #ffffff;">
          <tr>
            <td style="padding: 20px 20px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 48px; vertical-align: top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background: ${meta.light}; border-radius: 12px; border: 1px solid #e5e7eb; width: 44px; height: 44px; text-align: center;">
                      <tr><td style="font-size: 22px; font-family: Arial, sans-serif;">${icon ? `<img src="${icon}" alt="" width="22" height="22" style="vertical-align: middle; display: block; margin: 0 auto;" onerror="this.style.display='none'">` : sourceEmoji(f.source)}</td></tr>
                    </table>
                  </td>
                  <td style="vertical-align: top; padding-left: 12px;">
                    <div style="margin-bottom: 6px;">
                      <span style="display: inline-block; background: ${meta.color}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px;">${sourceEmoji(f.source)} ${meta.label}</span>
                      ${isNew ? '<span style="display: inline-block; background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-left: 6px;">NEW</span>' : ''}
                      ${score !== null ? `<span style="display: inline-block; background: #f3f4f6; color: #4b5563; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; margin-left: 6px;">Relevance ${score}%</span>` : ''}
                    </div>
                    <h3 style="margin: 0 0 6px; font-family: Arial, sans-serif; font-size: 16px; font-weight: 700; color: #111827; line-height: 1.35;">${f.title}</h3>
                    <p style="margin: 0 0 6px; font-family: Arial, sans-serif; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: lowercase;">${site}</p>
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #4b5563;">${abstract}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 20px 20px; text-align: right;">
              <a href="${f.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: ${meta.color}; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 20px; border-radius: 8px;">View offer →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildEmailHtml(findings, recipient) {
  const items = (findings || []).map(buildItemHtml).join('');
  const subUrl = buildUnsubscribeUrl(recipient || process.env.EMAIL_TO || '');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0ea5e9 100%); padding: 36px 28px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 10px;">
                      <tr>
                        <td style="background: rgba(255,255,255,0.12); border-radius: 50%; width: 64px; height: 64px; text-align: center; font-size: 30px; line-height: 64px;">🤖</td>
                      </tr>
                    </table>
                    <h1 style="margin: 0 0 6px; font-family: Arial, sans-serif; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 0.02em;">Free AI Tracker</h1>
                    <div style="width: 48px; height: 3px; background: #38bdf8; border-radius: 2px; margin: 0 auto 10px;"></div>
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #bae6fd;">Weekly AI Digest · ${findings.length} hand-picked offers</p>
                    <p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #7dd3fc;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 24px 8px;">
                    <p style="margin: 0 0 22px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #374151;">
                      Hey there! 👋<br><br>
                      Here are the <strong>${findings.length} best free AI offers</strong> we found this week — new free credits, models, tiers and tools. Tap through for the details.
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}<tr><td style="height: 12px;"></td></tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="background: #0f172a; padding: 24px 28px; text-align: center;">
                    <p style="margin: 0 0 6px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; color: #e2e8f0;">Free AI Tracker</p>
                    <p style="margin: 0 0 10px; font-family: Arial, sans-serif; font-size: 12px; color: #94a3b8;">Automated weekly digest of free AI tools, models &amp; credits.</p>
                    <p style="margin: 0 0 14px; font-family: Arial, sans-serif; font-size: 12px; color: #64748b;">© ${new Date().getFullYear()} · Curated by Dr Raouf Roshdy · free-ai-tracker.vercel.app</p>
                    <a href="${subUrl}" style="display: inline-block; color: #bae6fd; font-family: Arial, sans-serif; font-size: 12px; text-decoration: underline;">Unsubscribe from weekly digest</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 12px 0 0; font-family: Arial, sans-serif; font-size: 11px; color: #9ca3af; text-align: center;">You are receiving this because you subscribed to the Free AI Tracker weekly digest.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildWelcomeEmailHtml(email) {
  const subUrl = buildUnsubscribeUrl(email);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0ea5e9 100%); padding: 36px 28px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 10px;">
                      <tr>
                        <td style="background: rgba(255,255,255,0.12); border-radius: 50%; width: 64px; height: 64px; text-align: center; font-size: 30px; line-height: 64px;">🗞️</td>
                      </tr>
                    </table>
                    <h1 style="margin: 0 0 6px; font-family: Arial, sans-serif; font-size: 26px; font-weight: 800; color: #ffffff;">Welcome to Free AI Tracker!</h1>
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #bae6fd;">Your weekly AI deals digest</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 28px 24px;">
                    <p style="margin: 0 0 16px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">Hey there,</p>
                    <p style="margin: 0 0 16px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">You're all set! Your subscription to <strong>${email}</strong> is confirmed. 🎉</p>
                    <p style="margin: 0 0 16px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">Every week we scan the web for the best <strong>free</strong> AI models, platforms, and open-source releases — and deliver a hand-picked digest straight to your inbox.</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background: #f0f9ff; border-radius: 12px;" width="100%">
                      <tr>
                        <td style="padding: 16px; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #0369a1;">📬 Weekly digest of free AI models &amp; platforms<br>🚀 Open-source releases &amp; new tooling<br>🎯 Hand-picked, relevance-scored offers</td>
                      </tr>
                    </table>
                    <p style="margin: 20px 0 0; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #6b7280;">Your first digest will arrive on the next scheduled run. See you in your inbox!</p>
                  </td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 6px; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; color: #334155;">Free AI Tracker</p>
                    <p style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 12px; color: #94a3b8;">Curated by Dr Raouf Roshdy · © ${new Date().getFullYear()}</p>
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #64748b;">No spam — one curated email per week. <a href="${subUrl}" style="color: #0284c7; text-decoration: underline;">Unsubscribe anytime</a>.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function sendBrevo({ from, to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn('BREVO_API_KEY not set, skipping email');
    return;
  }
  if (!to) {
    console.warn('No recipient resolved for email, skipping');
    return;
  }

  const match = from.match(/^(.*?)<([^>]+)>$/);
  const senderName = match ? match[1].trim() : '';
  const senderEmail = match ? match[2] : from;

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`Brevo rejected email to ${to}: ${data.message || res.statusText}`);
  }
  if (!data.messageId) {
    throw new Error(`Brevo returned no message id for ${to} — send did not complete`);
  }
}

export async function sendWelcomeEmail(email) {
  const from = process.env.EMAIL_FROM || 'Free AI Tracker <tracker@yourdomain.com>';

  await sendBrevo({
    from,
    to: email,
    subject: 'Welcome to Free AI Tracker! 🎉',
    html: buildWelcomeEmailHtml(email),
  });
}

export async function sendNotification(findings, recipient) {
  const from = process.env.EMAIL_FROM || 'Free AI Tracker <tracker@yourdomain.com>';
  const to = recipient || process.env.EMAIL_TO;

  await sendBrevo({
    from,
    to,
    subject: `Free AI Tracker - Weekly AI Digest: ${findings.length} Free Offers`,
    html: buildEmailHtml(findings, to),
  });
}

export { buildEmailHtml, buildWelcomeEmailHtml };