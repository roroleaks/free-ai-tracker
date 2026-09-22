import fetch from 'node-fetch';

const PACK_URL = 'https://education.github.com/pack';
const PACK_SOURCE = 'student-pack';

const RELEVANCE = [
  'ai', 'ml', 'machine learning', 'copilot', 'model', 'inference',
  'api', 'credits', 'cloud', 'gpu', 'open source', 'llm', 'gpt',
  'azure', 'deployment', 'developer tools', 'infrastructure',
];

function cleanText(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRelevant(text) {
  const lower = text.toLowerCase();
  return RELEVANCE.some((term) => lower.includes(term));
}

export function parseStudentPackHtml(html) {
  const findings = [];
  const companyRegex = /<h3 id="([^"]+)" class="sr-only">([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3 id="|<\/div>\s*<\/div>\s*<\/main>|$)/g;
  let companyMatch;

  while ((companyMatch = companyRegex.exec(html)) !== null) {
    const slug = companyMatch[1];
    const name = cleanText(companyMatch[2]);
    const block = companyMatch[3];

    const aboutMatch = block.match(/<h4 class="f5">About[\s\S]*?<\/h4>\s*<p class="mb-3">([\s\S]*?)<\/p>/);
    const about = aboutMatch ? cleanText(aboutMatch[1]) : '';

    const offerRegex = /<h5 class="f5 mb-1">([\s\S]*?)<\/h5>\s*<p style="margin-bottom: 12px;">([\s\S]*?)<\/p>/g;
    let offerMatch;

    while ((offerMatch = offerRegex.exec(block)) !== null) {
      const offerTitle = cleanText(offerMatch[1]);
      const offerText = cleanText(offerMatch[2]);
      const combined = `${name} ${about} ${offerTitle} ${offerText}`;

      if (!isRelevant(combined)) continue;

      let title;
      const isGenericTitle = /^Offer( #\d+)?$/.test(offerTitle);
      if (!isGenericTitle) {
        title = `${name} — ${offerTitle}`;
      } else if (offerText) {
        title = `${name} — ${offerText.slice(0, 70)}`;
      } else {
        title = `${name} — free student offer`;
      }

      findings.push({
        title,
        description: offerText || about || `Free offer for students from ${name}`,
        url: `${PACK_URL}#${slug}`,
        source: PACK_SOURCE,
        date: new Date().toISOString(),
      });
    }
  }

  return findings;
}

export async function fetchStudentPackOffers() {
  const response = await fetch(PACK_URL, {
    headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' },
  });

  if (!response.ok) {
    console.error(`GitHub Student Pack fetch failed with status ${response.status}`);
    return [];
  }

  const html = await response.text();
  return parseStudentPackHtml(html);
}