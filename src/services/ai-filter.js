const KEYWORDS = [
  'free', 'open source', 'release', 'launch', 'available',
  'beta', 'preview', 'trial', 'promo', 'discount',
  'llm', 'model', 'api', 'inference', 'fine-tun',
];

export async function filterAndScore(findings) {
  return findings.map(finding => {
    const text = `${finding.title} ${finding.body || ''}`.toLowerCase();
    let score = 0;

    for (const keyword of KEYWORDS) {
      if (text.includes(keyword)) score += 0.1;
    }

    if (finding.source === 'github') score += 0.15;
    if (text.includes('free') || text.includes('open source')) score += 0.3;

    return { ...finding, score: Math.min(score, 1) };
  }).sort((a, b) => b.score - a.score);
}