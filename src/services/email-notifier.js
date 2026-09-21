import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNotification(findings) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Free AI Tracker <tracker@yourdomain.com>';
  const to = process.env.EMAIL_TO;

  if (!apiKey || !to) {
    console.warn('Email not configured, skipping notification');
    return;
  }

  const html = `
    <h2>🤖 Free AI Tracker Updates (${findings.length} findings)</h2>
    ${findings.map(f => `
      <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #eee; border-radius: 8px;">
        <h3 style="margin: 0 0 8px;">${f.title}</h3>
        <p style="margin: 0 0 8px; color: #666;">Source: ${f.source} | Score: ${(f.score * 100).toFixed(0)}%</p>
        <a href="${f.url}" style="color: #0066cc;">View Details →</a>
      </div>
    `).join('')}
  `;

  await resend.emails.send({
    from,
    to,
    subject: `Free AI Tracker: ${findings.length} New Offers`,
    html,
  });
}