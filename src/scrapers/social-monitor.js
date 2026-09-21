import fetch from 'node-fetch';

const SOURCES = [
  {
    name: 'huggingface',
    url: 'https://huggingface.co/api/models?sort=lastModified&limit=20&search=llm+gpt',
    headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' },
    mapItem: (item) => ({
      title: item.id,
      description: item.tags?.join(', ') || 'Recent model update on HuggingFace',
      url: `https://huggingface.co/${item.id}`,
      source: 'huggingface',
      date: item.lastModified || new Date().toISOString(),
    }),
  },
  {
    name: 'vercel-ai-sdk',
    url: 'https://api.github.com/repos/vercel/ai/releases?per_page=10',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Offer-Tracker/1.0',
      'Authorization': process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : '',
    },
    mapItem: (item) => ({
      title: item.name || item.tag_name,
      description: (item.body || 'Vercel AI SDK release').slice(0, 500),
      url: item.html_url,
      source: 'vercel-ai-sdk',
      date: item.published_at || new Date().toISOString(),
    }),
  },
];

export async function fetchSocialUpdates() {
  const findings = [];

  for (const source of SOURCES) {
    try {
      const response = await fetch(source.url, { headers: source.headers });

      if (!response.ok) {
        console.error(`${source.name} fetch failed with status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.models || data.items || []);

      for (const item of items.slice(0, 10)) {
        findings.push(source.mapItem(item));
      }
    } catch (error) {
      console.error(`Failed to fetch ${source.name}:`, error.message);
    }
  }

  return findings;
}