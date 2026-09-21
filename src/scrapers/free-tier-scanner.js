import fetch from 'node-fetch';

const FREE_TIER_SOURCES = [
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/models',
    freeIndicator: (model) => model.pricing?.prompt === '0' && model.pricing?.completion === '0',
  },
  {
    name: 'replicate',
    url: 'https://api.replicate.com/v1/models',
    freeIndicator: (model) => model.free_tier === true,
  },
];

export async function scanFreeTiers() {
  const findings = [];

  for (const source of FREE_TIER_SOURCES) {
    try {
      const response = await fetch(source.url);
      if (!response.ok) continue;

      const data = await response.json();
      const models = Array.isArray(data) ? data : (data.data || data.models || []);

      for (const model of models) {
        if (source.freeIndicator(model)) {
          findings.push({
            source: source.name,
            title: `Free model: ${model.name || model.id}`,
            url: `https://${source.name}.com/${model.name || model.id}`,
            publishedAt: new Date().toISOString(),
            body: model.description || 'Free tier model available',
            metadata: { modelId: model.id, pricing: model.pricing },
          });
        }
      }
    } catch (error) {
      console.error(`Failed to scan ${source.name}:`, error.message);
    }
  }

  return findings;
}