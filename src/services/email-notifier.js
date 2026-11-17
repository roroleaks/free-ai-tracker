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
  kaggle: { label: 'Kaggle', color: '#20BEFF', light: '#e8f7fd' },
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function sourceMeta(source) {
  return SOURCE_META[source] || { label: source, color: '#4b5563', light: '#f3f4f6' };
}

function stripTags(text) {
  return (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function excerpt(text, max = 160) {
  const clean = stripTags(text);
  if (!clean) return '';
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(' ', max);
  return clean.slice(0, cut > 0 ? cut : max) + '…';
}

function clampTitle(title, max = 110) {
  const clean = String(title ?? '').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(' ', max);
  return clean.slice(0, cut > 0 ? cut : max) + '…';
}

function dedupeDescription(title, description) {
  const cleanTitle = stripTags(title);
  const cleanDesc = stripTags(description);
  if (!cleanDesc) return '';
  if (!cleanTitle) return cleanDesc;

  if (cleanDesc.length >= 40 && cleanTitle.length >= 40 && cleanDesc.slice(0, 40).toLowerCase() === cleanTitle.slice(0, 40).toLowerCase()) {
    let matchLen = 40;
    while (matchLen < cleanTitle.length && matchLen < cleanDesc.length && cleanTitle[matchLen].toLowerCase() === cleanDesc[matchLen].toLowerCase()) {
      matchLen++;
    }
    const stripped = cleanDesc.slice(matchLen).replace(/^[\s:–—.-]+/, '');
    return stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : cleanDesc;
  }
  if (cleanTitle.length >= 10 && cleanDesc.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    const stripped = cleanDesc.slice(cleanTitle.length).replace(/^[\s:–—.-]+/, '');
    return stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : cleanDesc;
  }
  return cleanDesc;
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
    'kaggle.com': 'Kaggle',
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
    kaggle: '🏅',
  }[source] || '⚡';
}

const SOURCE_GROUPS = {
  openrouter: 'Models & Platforms',
  groq: 'Models & Platforms',
  together: 'Models & Platforms',
  google: 'Models & Platforms',
  deepinfra: 'Models & Platforms',
  cerebras: 'Models & Platforms',
  cohere: 'Models & Platforms',
  ollama: 'Models & Platforms',
  kaggle: 'Models & Platforms',
  github: 'Open-source & Tools',
  huggingface: 'Open-source & Tools',
  'vercel-ai-sdk': 'Open-source & Tools',
  aifree: 'News & Reading',
  reddit: 'News & Reading',
  'student-pack': 'News & Reading',
};

const GROUP_ORDER = [
  'Models & Platforms',
  'Open-source & Tools',
  'News & Reading',
];

function buildItemHtml(f, options = {}) {
  const isTopPick = typeof options === 'object' && options !== null ? Boolean(options.isTopPick) : false;
  const meta = sourceMeta(f.source);
  const icon = faviconUrl(f.url);
  const site = siteDisplay(f.url);
  const actionDomain = getDomain(f.url);
  const actionLabel = actionDomain ? `${actionDomain} · ${meta.label}` : meta.label;
  const cleanTitle = clampTitle(f.title, 110);
  const cleanDesc = dedupeDescription(f.title, f.description);
  const abstract = excerpt(cleanDesc, 180) || 'No description available';
  const score = typeof f.score === 'number' ? Math.round(f.score * 100) : null;
  const showRelevance = typeof f.score === 'number' && f.score < 0.9;
  const isNew = f.isNew === true;
  const isPromoCredit = f.offerType === 'signup-credit';
  const safeUrl = /^https?:\/\//i.test(f.url || '') ? f.url : '#';

  return `
    <tr>
      <td style="padding: 0 0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="offer-card ${isTopPick ? 'offer-card-top-pick' : ''}" style="border: 1px solid #e2e8f0; ${isTopPick ? 'border-top: 2px solid #38bdf8;' : ''} border-radius: 14px; border-collapse: separate; overflow: hidden; background: #ffffff; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);">
          <!-- Top Tag Bar -->
          <tr>
            <td class="offer-card-top" style="padding: 18px 20px 10px; background: #ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="display: inline-block; background: ${meta.color}; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; line-height: 1.2;">${sourceEmoji(f.source)} ${meta.label}</span>
                    ${isTopPick ? '<span class="top-pick-pill" style="display: inline-block; background: #e0f2fe; border: 1px solid #bae6fd; color: #0284c7; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; margin-left: 6px; line-height: 1.2;">TOP PICK</span>' : ''}
                    ${isNew ? '<span class="new-pill" style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; margin-left: 6px; line-height: 1.2;">NEW</span>' : ''}
                    ${isPromoCredit ? '<span class="promo-pill" style="display: inline-block; background: #fef3c7; border: 1px solid #fde68a; color: #b45309; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; margin-left: 6px; line-height: 1.2;">PROMO CREDIT</span>' : ''}
                    ${!isTopPick && showRelevance && score !== null ? `<span class="relevance-pill" style="display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; margin-left: 6px; line-height: 1.2;">Relevance ${score}%</span>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding: 0 20px 14px;">
              <h3 class="offer-title" style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 17px; font-weight: 700; color: #0f172a; line-height: 1.35; letter-spacing: -0.01em;">${escapeHtml(cleanTitle)}</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 10px;">
                <tr>
                  <td style="vertical-align: middle;">
                    ${icon ? `<img src="${icon}" alt="" width="16" height="16" style="vertical-align: middle; display: inline-block; margin-right: 6px; border-radius: 3px;">` : ''}
                  </td>
                  <td class="site-display" style="vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 600; color: #64748b; line-height: 1.2;">
                    ${escapeHtml(site)}
                  </td>
                </tr>
              </table>
              <p class="offer-desc" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #334155;">${escapeHtml(abstract)}</p>
            </td>
          </tr>
          <!-- Bottom Action Row -->
          <tr>
            <td class="action-strip" style="padding: 12px 20px 14px; background: #f8fafc; border-top: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="action-strip-meta" align="left" style="vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 500; color: #64748b; line-height: 1.3;">
                    ${escapeHtml(actionLabel)}
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="offer-btn" style="display: inline-block; background: #0284c7; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; text-decoration: none; padding: 13px 22px; border-radius: 8px; box-shadow: 0 1px 3px rgba(2, 132, 199, 0.25); mso-line-height-rule: exactly; line-height: 18px;">View offer →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildEmailHtml(findings, recipient) {
  const standard = (findings || []).filter(f => f.offerType !== 'signup-credit');
  const promo = (findings || []).filter(f => f.offerType === 'signup-credit');

  // Sort standard findings by score descending (stable, preserving order for ties)
  const sortedStandard = standard
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => {
      const scoreA = typeof a.item.score === 'number' ? a.item.score : 0;
      const scoreB = typeof b.item.score === 'number' ? b.item.score : 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return a.originalIndex - b.originalIndex;
    })
    .map(wrapper => wrapper.item);

  const topPicks = sortedStandard.slice(0, 3);
  const remainingStandard = sortedStandard.slice(3);

  let itemsHtml = '';

  if (topPicks.length > 0) {
    itemsHtml += `
      <tr>
        <td style="padding: 10px 0 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td class="group-header-label" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; padding-right: 12px;">
                ⚡ Top picks this week
              </td>
              <td width="100%" style="vertical-align: middle;">
                <div class="group-header-rule" style="border-top: 1px solid #bae6fd; height: 1px; line-height: 1px;"></div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
    itemsHtml += topPicks.map(f => buildItemHtml(f, { isTopPick: true })).join('');
  }

  // Group remaining standard cards
  for (const groupName of GROUP_ORDER) {
    const groupItems = remainingStandard.filter(f => (SOURCE_GROUPS[f.source] || 'Models & Platforms') === groupName);
    if (groupItems.length > 0) {
      itemsHtml += `
        <tr>
          <td style="padding: 20px 0 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="group-header-label" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; padding-right: 12px;">
                  ${escapeHtml(groupName)}
                </td>
                <td width="100%" style="vertical-align: middle;">
                  <div class="group-header-rule" style="border-top: 1px solid #e2e8f0; height: 1px; line-height: 1px;"></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
      itemsHtml += groupItems.map(f => buildItemHtml(f)).join('');
    }
  }

  if (promo.length > 0) {
    if (sortedStandard.length > 0) {
      itemsHtml += `
        <tr>
          <td style="padding: 24px 0 12px;">
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
              <span style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 12px; border-radius: 999px;">🎁 Signup &amp; Promo Credits</span>
            </div>
          </td>
        </tr>
      `;
    }
    itemsHtml += promo.map(f => buildItemHtml(f)).join('');
  }

  const items = itemsHtml;
  const subUrl = buildUnsubscribeUrl(recipient || process.env.EMAIL_TO || '');
  const dateFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>Free AI Tracker - Weekly AI Digest</title>
        <style>
          @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; }
            .header-padding { padding: 28px 18px !important; }
            .body-padding { padding: 22px 16px 8px !important; }
            .footer-padding { padding: 22px 16px !important; }
            .relevance-pill { display: none !important; }
            .offer-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
            .action-strip table, .action-strip tbody, .action-strip tr, .action-strip td { display: block !important; width: 100% !important; }
            .action-strip-meta { display: block !important; padding-bottom: 10px !important; text-align: left !important; }
            .footer-link { display: block !important; padding: 8px 0 !important; font-size: 14px !important; margin: 0 !important; }
          }
          @media (prefers-color-scheme: dark) {
            body, .email-bg { background: #0b1120 !important; }
            .email-container { background: #0f172a !important; border-color: #334155 !important; }
            .email-intro { color: #cbd5e1 !important; }
            .offer-card { background: #1e293b !important; border-color: #334155 !important; }
            .offer-card-top { background: #1e293b !important; }
            .offer-title { color: #e2e8f0 !important; }
            .offer-desc { color: #cbd5e1 !important; }
            .site-display { color: #94a3b8 !important; }
            .action-strip { background: #0f172a !important; border-color: #1e293b !important; }
            .action-strip-meta { color: #94a3b8 !important; }
            .relevance-pill { background: rgba(241, 245, 249, 0.12) !important; border-color: rgba(226, 232, 240, 0.2) !important; color: #cbd5e1 !important; }
            .new-pill { background: rgba(16, 185, 129, 0.18) !important; border-color: rgba(16, 185, 129, 0.35) !important; color: #34d399 !important; }
            .promo-pill { background: rgba(245, 158, 11, 0.18) !important; border-color: rgba(245, 158, 11, 0.35) !important; color: #fbbf24 !important; }
            .top-pick-pill { background: rgba(56, 189, 248, 0.18) !important; border-color: rgba(56, 189, 248, 0.35) !important; color: #38bdf8 !important; }
            .group-header-label { color: #94a3b8 !important; }
            .group-header-rule { border-color: #334155 !important; }
          }
        </style>
      </head>
      <body class="email-bg" style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <!-- Hidden Preheader -->
        <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0;">
          Weekly AI Digest: ${findings.length} hand-picked free AI offers, open models &amp; platform credits ready to explore. &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background: #f8fafc; padding: 24px 12px;">
          <tr>
            <td align="center">
              <!--[if mso]><table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 640px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);">
                <!-- Header / Hero -->
                <tr>
                  <td class="header-padding" style="background-color: #0f172a; background: linear-gradient(135deg, #090d16 0%, #0f172a 40%, #1e3a8a 75%, #0284c7 100%); padding: 36px 28px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 14px;">
                      <tr>
                        <td style="background-color: rgba(255,255,255,0.08); border-radius: 14px; width: 56px; height: 56px; text-align: center; vertical-align: middle;">
                          <img src="https://free-ai-tracker.vercel.app/icon-192.png" alt="Free AI Tracker logo" width="56" height="56" style="border-radius: 14px; display: block; margin: 0 auto; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2px solid rgba(255,255,255,0.25);">
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 27px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Free AI Tracker</h1>
                    <div style="width: 44px; height: 3px; background: #38bdf8; border-radius: 2px; margin: 0 auto 10px;"></div>
                    <div style="margin: 0 0 8px;">
                      <span style="display: inline-block; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 0.08em; text-transform: uppercase;">Weekly AI Digest · Ver. 1.2</span>
                    </div>
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; color: #bae6fd; font-weight: 500;">${findings.length} hand-picked free AI models &amp; platform credits</p>
                    <p style="margin: 4px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #7dd3fc;">${dateFormatted}</p>
                    <div style="margin-top: 14px;">
                      <span style="display: inline-block; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 5px 12px; margin: 4px; font-size: 11.5px; font-weight: 600; color: #e0f2fe;">⚡ 100% Free Tiers</span>
                      <span style="display: inline-block; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 5px 12px; margin: 4px; font-size: 11.5px; font-weight: 600; color: #e0f2fe;">🚀 Open Weights</span>
                      <span style="display: inline-block; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 5px 12px; margin: 4px; font-size: 11.5px; font-weight: 600; color: #e0f2fe;">🎁 Promo Credits</span>
                    </div>
                  </td>
                </tr>
                <!-- Body Section -->
                <tr>
                  <td class="body-padding" style="padding: 28px 24px 8px;">
                    <p class="email-intro" style="margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14.5px; line-height: 1.6; color: #334155;">
                      Hey there! 👋<br><br>
                      Here are the <strong>${findings.length} best free AI offers</strong> we found this week — new free credits, models, tiers and tools. The top 3 picks first, everything else grouped below. Tap through for the details.
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${items}
                      <tr><td style="height: 8px;"></td></tr>
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td class="footer-padding" style="background: #0f172a; padding: 26px 28px; text-align: center;">
                    <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #f8fafc;">Free AI Tracker</p>
                    <p style="margin: 0 0 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #94a3b8;">Automated weekly digest of free AI tools, models &amp; credits.</p>
                    <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #94a3b8;">© ${new Date().getFullYear()} · Curated by Dr Raouf Roshdy · free-ai-tracker.vercel.app</p>
                    <div style="margin: 0 0 8px;">
                      <a href="https://free-ai-tracker.vercel.app" target="_blank" rel="noopener noreferrer" class="footer-link" style="display: inline-block; color: #38bdf8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; text-decoration: underline; margin-right: 14px;">Live Dashboard</a>
                      <a href="${subUrl}" class="footer-link" style="display: inline-block; color: #bae6fd; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; text-decoration: underline;">Unsubscribe from weekly digest</a>
                    </div>
                  </td>
                </tr>
              </table>
              <!--[if mso]></td></tr></table><![endif]-->
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
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>Welcome to Free AI Tracker!</title>
        <style>
          @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; }
            .header-padding { padding: 28px 18px !important; }
            .body-padding { padding: 22px 18px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <!-- Hidden Preheader -->
        <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0;">
          Welcome to Free AI Tracker! Your subscription for ${escapeHtml(email)} is confirmed. 🎉
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; padding: 24px 12px;">
          <tr>
            <td align="center">
              <!--[if mso]><table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 620px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);">
                <tr>
                  <td class="header-padding" style="background-color: #0f172a; background: linear-gradient(135deg, #090d16 0%, #0f172a 40%, #1e3a8a 75%, #0284c7 100%); padding: 36px 28px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 14px;">
                      <tr>
                        <td style="background-color: rgba(255,255,255,0.08); border-radius: 14px; width: 56px; height: 56px; text-align: center; vertical-align: middle;">
                          <img src="https://free-ai-tracker.vercel.app/icon-192.png" alt="Free AI Tracker logo" width="56" height="56" style="border-radius: 14px; display: block; margin: 0 auto; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2px solid rgba(255,255,255,0.25);">
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Welcome to Free AI Tracker!</h1>
                    <div style="margin: 0 0 8px;">
                      <span style="display: inline-block; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 0.08em; text-transform: uppercase;">Subscription Confirmed · Ver. 1.2</span>
                    </div>
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; color: #bae6fd;">Your weekly AI deals &amp; open models digest</p>
                  </td>
                </tr>
                <tr>
                  <td class="body-padding" style="padding: 28px 28px 24px;">
                    <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">Hey there,</p>
                    <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #334155;">You're all set! Your subscription to <strong>${escapeHtml(email)}</strong> is confirmed. 🎉</p>
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
              <!--[if mso]></td></tr></table><![endif]-->
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
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>Manage Your Subscription - Free AI Tracker</title>
        <style>
          @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; }
            .header-padding { padding: 28px 18px !important; }
            .body-padding { padding: 22px 18px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <!-- Hidden Preheader -->
        <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0;">
          Manage your Free AI Tracker subscription for ${escapeHtml(email)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; padding: 24px 12px;">
          <tr>
            <td align="center">
              <!--[if mso]><table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 620px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);">
                <tr>
                  <td class="header-padding" style="background-color: #0f172a; background: linear-gradient(135deg, #090d16 0%, #0f172a 40%, #1e3a8a 75%, #0284c7 100%); padding: 36px 28px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 14px;">
                      <tr>
                        <td style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; width: 56px; height: 56px; text-align: center; font-size: 26px; line-height: 56px;">
                          ⚙️
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Manage Your Subscription</h1>
                    <p style="margin: 6px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #bae6fd;">Free AI Tracker · ${escapeHtml(email)}</p>
                  </td>
                </tr>
                <tr>
                  <td class="body-padding" style="padding: 28px 28px 24px;">
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
              <!--[if mso]></td></tr></table><![endif]-->
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
    const detail = data?.message || data?.code || JSON.stringify(data);
    throw new Error(`Mail provider rejected send to ${maskedTo} (status=${res.status}, detail=${detail})`);
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

export { buildEmailHtml, buildWelcomeEmailHtml, buildManageEmailHtml, excerpt, clampTitle, dedupeDescription, buildItemHtml };
