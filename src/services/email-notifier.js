import fetch from 'node-fetch';
import { buildUnsubscribeUrl, maskEmail } from '../utils/unsubscribe.js';

const BREVO_API_URL = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';

const SOURCE_META = {
  github: { label: 'GitHub', color: '#24292f', light: '#f6f8fa' },
  openrouter: { label: 'OpenRouter', color: '#7c3aed', light: '#f5f3ff' },
  huggingface: { label: 'HuggingFace', color: '#f59e0b', light: '#fffbeb' },
  reddit: { label: 'Reddit', color: '#ff4500', light: '#fff5f0' },
  aifree: { label: 'AI Free', color: '#059669', light: '#ecfdf5' },
  'student-pack': { label: 'Student Pack', color: '#0284c7', light: '#f0f9ff' },
  'vercel-ai-sdk': { label: 'Vercel AI SDK', color: '#000000', light: '#f3f4f6' },
  groq: { label: 'Groq', color: '#f55036', light: '#fff1ee' },
  together: { label: 'Together AI', color: '#0f172a', light: '#f1f5f9' },
  google: { label: 'Google AI', color: '#1a73e8', light: '#e8f0fe' },
  ollama: { label: 'Ollama', color: '#059669', light: '#ecfdf5' },
  deepinfra: { label: 'DeepInfra', color: '#4f46e5', light: '#eef2ff' },
  cerebras: { label: 'Cerebras', color: '#ea580c', light: '#fff7ed' },
  cohere: { label: 'Cohere', color: '#0f766e', light: '#f0fdfa' },
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
    'console.groq.com': 'Groq',
    'together.ai': 'Together AI',
    'aistudio.google.com': 'Google AI Studio',
    'ollama.com': 'Ollama',
    'deepinfra.com': 'DeepInfra',
    'cerebras.ai': 'Cerebras',
    'inference.cerebras.ai': 'Cerebras',
    'cohere.com': 'Cohere',
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
    groq: '⚡',
    together: '🤝',
    google: '🌐',
    ollama: '🦙',
    deepinfra: '🚀',
    cerebras: '⚡',
    cohere: '💬',
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
      <td style="padding: 0 0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 14px; border-collapse: separate; overflow: hidden; background: #ffffff; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);">
          <tr>
            <td style="padding: 20px 20px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 46px; vertical-align: top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background: ${meta.light}; border-radius: 12px; border: 1px solid #e2e8f0; width: 44px; height: 44px; text-align: center;">
                      <tr><td style="font-size: 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${icon ? `<img src="${icon}" alt="" width="22" height="22" style="vertical-align: middle; display: block; margin: 0 auto; border-radius: 4px;" onerror="this.style.display='none'">` : sourceEmoji(f.source)}</td></tr>
                    </table>
                  </td>
                  <td style="vertical-align: top; padding-left: 14px;">
                    <div style="margin-bottom: 8px;">
                      <span style="display: inline-block; background: ${meta.color}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px;">${sourceEmoji(f.source)} ${meta.label}</span>
                      ${isNew ? '<span style="display: inline-block; background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-left: 6px;">NEW</span>' : ''}
                      ${score !== null ? `<span style="display: inline-block; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; margin-left: 6px;">Relevance ${score}%</span>` : ''}
                    </div>
                    <h3 style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.35;">${f.title}</h3>
                    <p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 600; color: #64748b; text-transform: lowercase;">${site}</p>
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; line-height: 1.6; color: #334155;">${abstract}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 20px 18px; text-align: right; border-top: 1px solid #f8fafc;">
              <a href="${f.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: ${meta.color}; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; text-decoration: none; padding: 9px 18px; border-radius: 8px;">View offer →</a>
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
  const dateFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Free AI Tracker - Weekly AI Digest</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <!-- Hidden Preheader -->
        <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0;">
          Weekly AI Digest: ${findings.length} hand-picked free AI offers, open models &amp; platform credits ready to explore. &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
                <!-- Header / Hero -->
                <tr>
                  <td style="background: linear-gradient(135deg, #090d16 0%, #0f172a 40%, #1e3a8a 75%, #0284c7 100%); padding: 36px 28px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 12px;">
                      <tr>
                        <td style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; width: 64px; height: 64px; text-align: center; font-size: 30px; line-height: 64px;">🤖</td>
                      </tr>
                    </table>
                    <h1 style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 27px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Free AI Tracker</h1>
                    <div style="width: 44px; height: 3px; background: #38bdf8; border-radius: 2px; margin: 0 auto 10px;"></div>
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; color: #bae6fd; font-weight: 500;">Weekly AI Digest · ${findings.length} hand-picked offers</p>
                    <p style="margin: 4px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #7dd3fc;">${dateFormatted}</p>
                    <div style="margin-top: 14px;">
                      <span style="display: inline-block; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 4px 14px; font-size: 11.5px; font-weight: 600; color: #e0f2fe;">⚡ 100% Free Tiers &nbsp;•&nbsp; 🚀 Open Weights &nbsp;•&nbsp; 🎁 Promo Credits</span>
                    </div>
                  </td>
                </tr>
                <!-- Body Section -->
                <tr>
                  <td style="padding: 28px 24px 8px;">
                    <p style="margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14.5px; line-height: 1.6; color: #334155;">
                      Hey there! 👋<br><br>
                      Here are the <strong>${findings.length} best free AI offers</strong> we found this week — new free credits, models, tiers and tools. Tap through for the details.
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${items}
                      <tr><td style="height: 8px;"></td></tr>
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background: #0f172a; padding: 26px 28px; text-align: center;">
                    <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #f8fafc;">Free AI Tracker</p>
                    <p style="margin: 0 0 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #94a3b8;">Automated weekly digest of free AI tools, models &amp; credits.</p>
                    <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #64748b;">© ${new Date().getFullYear()} · Curated by Dr Raouf Roshdy · free-ai-tracker.vercel.app</p>
                    <div style="margin: 0 0 8px;">
                      <a href="https://free-ai-tracker.vercel.app" target="_blank" rel="noopener noreferrer" style="display: inline-block; color: #38bdf8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; text-decoration: underline; margin-right: 14px;">Live Dashboard</a>
                      <a href="${subUrl}" style="display: inline-block; color: #bae6fd; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; text-decoration: underline;">Unsubscribe from weekly digest</a>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin: 14px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #94a3b8; text-align: center;">You are receiving this because you subscribed to the Free AI Tracker weekly digest.</p>
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
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Free AI Tracker!</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <!-- Hidden Preheader -->
        <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0;">
          Welcome to Free AI Tracker! Your subscription for ${email} is confirmed. 🎉
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
                <tr>
                  <td style="background: linear-gradient(135deg, #090d16 0%, #0f172a 40%, #1e3a8a 75%, #0284c7 100%); padding: 36px 28px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 12px;">
                      <tr>
                        <td style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; width: 64px; height: 64px; text-align: center; font-size: 30px; line-height: 64px;">🗞️</td>
                      </tr>
                    </table>
                    <h1 style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Welcome to Free AI Tracker!</h1>
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; color: #bae6fd;">Your weekly AI deals digest</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 28px 24px;">
                    <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Hey there,</p>
                    <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">You're all set! Your subscription to <strong>${email}</strong> is confirmed. 🎉</p>
                    <p style="margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Every week we scan the web for the best <strong>free</strong> AI models, platforms, and open-source releases — and deliver a hand-picked digest straight to your inbox.</p>
                    
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; margin-bottom: 22px;" width="100%">
                      <tr>
                        <td style="padding: 18px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; line-height: 1.7; color: #0369a1;">
                          <strong>What you get every week:</strong><br>
                          📬 Weekly digest of free AI models &amp; platforms<br>
                          🚀 Open-source releases &amp; new tooling<br>
                          🎯 Hand-picked, relevance-scored offers
                        </td>
                      </tr>
                    </table>

                    <div style="text-align: center; margin: 24px 0 20px;">
                      <a href="https://free-ai-tracker.vercel.app" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0284c7; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 26px; border-radius: 8px; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);">Explore Current Free AI Offers →</a>
                    </div>

                    <p style="margin: 18px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #64748b; text-align: center;">Your first digest will arrive on the next scheduled run. See you in your inbox!</p>
                  </td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #334155;">Free AI Tracker</p>
                    <p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #94a3b8;">Curated by Dr Raouf Roshdy · © ${new Date().getFullYear()}</p>
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #64748b;">No spam — one curated email per week. <a href="${subUrl}" style="color: #0284c7; text-decoration: underline;">Unsubscribe anytime</a>.</p>
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

function buildManageEmailHtml(email) {
  const subUrl = buildUnsubscribeUrl(email);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Manage Your Subscription - Free AI Tracker</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <!-- Hidden Preheader -->
        <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0;">
          Manage your Free AI Tracker subscription for ${email}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
                <tr>
                  <td style="background: linear-gradient(135deg, #090d16 0%, #0f172a 40%, #1e3a8a 75%, #0284c7 100%); padding: 36px 28px; text-align: center;">
                    <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Manage Your Subscription</h1>
                    <p style="margin: 6px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #bae6fd;">Free AI Tracker · ${email}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 28px 24px;">
                    <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">You asked for a way to manage your Free AI Tracker subscription. Here it is:</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px;" width="100%">
                      <tr>
                        <td style="padding: 22px 20px; text-align: center;">
                          <a href="${subUrl}" style="display: inline-block; background: #dc2626; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);">Unsubscribe from weekly digest</a>
                          <p style="margin: 12px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #7f1d1d;">One click and you're done — no login needed.</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 20px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #64748b;">This one-time link is private and can't be used by anyone else. If you didn't request this, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #334155;">Free AI Tracker</p>
                    <p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #94a3b8;">Curated by Dr Raouf Roshdy · © ${new Date().getFullYear()}</p>
                    <a href="${subUrl}" style="color: #0284c7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; text-decoration: underline;">Unsubscribe anytime</a>
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
  const maskedTo = maskEmail(to);

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

  const timeoutMs = Number(process.env.EMAIL_TIMEOUT_MS || 10000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(BREVO_API_URL, {
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
      signal: controller.signal,
    });
  } catch (fetchError) {
    if (fetchError.name === 'AbortError') {
      throw new Error(`Mail provider request timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Mail provider request failed for ${maskedTo} (cause=${fetchError.name || 'error'})`);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`Mail provider rejected send to ${maskedTo} (status=${res.status})`);
  }
  if (!data.messageId) {
    throw new Error(`Mail provider returned no message id for ${maskedTo} — send did not complete`);
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

export async function sendManageEmail(email) {
  const from = process.env.EMAIL_FROM || 'Free AI Tracker <tracker@yourdomain.com>';

  await sendBrevo({
    from,
    to: email,
    subject: 'Manage your Free AI Tracker subscription',
    html: buildManageEmailHtml(email),
  });
}

export { buildEmailHtml, buildWelcomeEmailHtml, buildManageEmailHtml };