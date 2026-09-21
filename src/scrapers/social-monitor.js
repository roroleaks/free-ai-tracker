import fetch from 'node-fetch';

const PLATFORMS = [
  { name: 'huggingface', url: 'https://huggingface.co/api/models?sort=lastModified&limit=20' },
  { name: 'vercel', url: 'https://vercel.com/api/blog?limit=10' },
  { name: 'openai', url: 'https://openai.com/api/blog?limit=10' },
];

export async function fetchSocialUpdates() {
  const findings = [];

  for (const platform of PLATFORMS) {
    try {
      const response = await fetch(platform.url, {
        headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.models || data.posts || []);

      for (const item of items.slice(0, 10)) {
        findings.push({
          source: platform.name,
          title: item.name || item.title || 'Update',
          url: item.url || item.permalink || `#${item.id}`,
          publishedAt: item.lastModified || item.createdAt || item.publishedAt || new Date().toISOString(),
          body: item.description || item.summary || item.content?.slice(0, 2000),
        });
      }
    } catch (error) {
      console.error(`Failed to fetch ${platform.name}:`, error.message);
    }
  }

  return findings;
}