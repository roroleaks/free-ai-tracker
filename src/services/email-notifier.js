import fetch from 'node-fetch';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function sourceBadge(source) {
  const labels = {
    github: '[GitHub]',
    openrouter: '[OpenRouter]',
    huggingface: '[HuggingFace]',
    reddit: '[Reddit]',
    'vercel-ai-sdk': '[Vercel AI SDK]',
  };
  return labels[source] || `[${source}]`;
}

function buildEmailHtml(findings) {
  const items = findings.map(f => {
    const badge = sourceBadge(f.source);

    return `
      <tr>
        <td style="padding: 0 0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 12px; border-collapse: separate; overflow: hidden;">
            <tr>
              <td style="padding: 20px;">
                <div style="margin-bottom: 10px;">
                  <span style="display: inline-block; background: #0ea5e9; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px;">${badge}</span>
                  ${typeof f.score === 'number' ? `<span style="display: inline-block; background: #f3f4f6; color: #4b5563; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; margin-left: 6px;">Relevance ${Math.round(f.score * 100)}%</span>` : ''}
                </div>
                <h3 style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 16px; font-weight: 700; color: #111827;">${f.title}</h3>
                <p style="margin: 0 0 14px; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #4b5563;">${f.description || 'No description available'}</p>
                <a href="${f.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0284c7; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px;">View Offer →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background: #f9fafb; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #0369a1, #0ea5e9); padding: 32px 24px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🤖</div>
                    <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: 700; color: #ffffff;">Free AI Tracker - Daily Digest</h1>
                    <p style="margin: 6px 0 0; font-family: Arial, sans-serif; font-size: 13px; color: #e0f2fe;">${findings.length} hand-picked AI offers · ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
                  </td>
                </tr>
                <tr>
                  <td style="background: #f3f4f6; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #6b7280;">© ${new Date().getFullYear()} Free AI Tracker · <a href="https://github.com" target="_blank" style="color: #0284c7; text-decoration: none;">Dashboard</a></p>
                    <p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; color: #374151;">Created by Dr Raouf Roshdy | Vol. 1.0</p>
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

function buildWelcomeEmailHtml(email) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background: #f9fafb; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #0369a1, #0ea5e9); padding: 32px 24px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🤖</div>
                    <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: 700; color: #ffffff;">Welcome to Free AI Tracker!</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">Hey there,</p>
                    <p style="margin: 0 0 16px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">You're all set! Your subscription to <strong>${email}</strong> is confirmed. 🎉</p>
                    <p style="margin: 0 0 16px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">Every week we scan the web for the best <strong>free</strong> AI models, platforms, and open-source releases — and deliver a hand-picked digest straight to your inbox.</p>
                    <p style="margin: 0 0 20px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">No spam. One curated email per week. You can unsubscribe anytime.</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background: #ecfdf5; border-radius: 12px;" width="100%">
                      <tr>
                        <td style="padding: 16px; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #065f46;">✅ Weekly digest of free AI models &amp; platforms<br>✅ Open-source releases &amp; new tooling<br>✅ Hand-picked, relevance-scored offers</td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #6b7280;">Your first digest will arrive on the next scheduled run. See you in your inbox!</p>
                  </td>
                </tr>
                <tr>
                  <td style="background: #f3f4f6; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #6b7280;">© ${new Date().getFullYear()} Free AI Tracker</p>
                    <p style="margin: 4px 0 0; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; color: #374151;">Created by Dr Raouf Roshdy | Vol. 1.0</p>
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
    subject: `Free AI Tracker - Daily Digest: ${findings.length} Offers`,
    html: buildEmailHtml(findings),
  });
}

export { buildEmailHtml, buildWelcomeEmailHtml };