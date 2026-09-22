const STRONG_HINTS = [
  { phrase: '100% free', weight: 0.4 },
  { phrase: 'no credit card', weight: 0.4 },
  { phrase: 'free tier', weight: 0.35 },
  { phrase: 'open weights', weight: 0.35 },
  { phrase: 'free api', weight: 0.3 },
  { phrase: 'free inference', weight: 0.3 },
  { phrase: 'free credits', weight: 0.3 },
  { phrase: 'ai credits', weight: 0.25 },
];

const KEYWORDS = [
  'free', 'open source', 'release', 'launch', 'available',
  'beta', 'preview', 'trial', 'promo', 'discount',
  'llm', 'model', 'api', 'inference', 'fine-tun',
  'credits', 'allowance', 'quota', 'serverless',
];

const SOURCE_BOOST = {
  github: 0.15,
  openrouter: 0.1,
  huggingface: 0.1,
  'vercel-ai-sdk': 0.05,
  reddit: 0.05,
  groq: 0.1,
  together: 0.1,
  google: 0.1,
};

const NEW_MODEL_DAYS = 7;
const NEW_MODEL_BOOST = 0.15;
const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 60 * 60 * 1000;

function isNewModel(finding, now = Date.now()) {
  const date = finding?.date ? new Date(finding.date) : null;
  return Boolean(date && !Number.isNaN(date.getTime()) && now - date.getTime() <= NEW_MODEL_DAYS * DAY_MS + GRACE_MS);
}

function scoreItem(finding) {
  const text = `${finding.title} ${finding.description || ''}`.toLowerCase();
  let score = 0;

  for (const { phrase, weight } of STRONG_HINTS) {
    if (text.includes(phrase)) score += weight;
  }

  for (const keyword of KEYWORDS) {
    if (text.includes(keyword)) score += 0.1;
  }

  score += SOURCE_BOOST[finding.source] || 0;
  if (text.includes('free')) score += 0.2;
  if (isNewModel(finding)) score += NEW_MODEL_BOOST;

  return Math.min(score, 1);
}

function dedupeKey(finding) {
  const title = (finding.title || '').toLowerCase().trim();
  const slug = title.replace(/[^a-z0-9]+/g, ' ').trim();
  return slug.slice(0, 60);
}

function dedupe(findings) {
  const seen = new Map();
  for (const finding of findings) {
    const key = dedupeKey(finding);
    const existing = seen.get(key);
    if (!existing || finding.score > existing.score) {
      seen.set(key, finding);
    }
  }
  return [...seen.values()];
}

export async function filterAndScore(findings) {
  const scored = findings
    .filter(Boolean)
    .map(finding => ({ ...finding, score: scoreItem(finding), isNew: isNewModel(finding) }));

  const deduped = dedupe(scored);
  return deduped.sort((a, b) => b.score - a.score).slice(0, 15);
}

export { isNewModel, NEW_MODEL_DAYS };