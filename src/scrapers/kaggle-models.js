import fetch from 'node-fetch';

const KAGGLE_MODELS_API = 'https://www.kaggle.com/api/v1/models/list?pageSize=25';
const KAGGLE_SOURCE = 'kaggle';

function cleanDescription(text) {
  if (!text) return 'Open model weights and architecture on Kaggle Hub.';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/#+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

export function parseKaggleModels(data) {
  const models = data?.models || [];
  if (!Array.isArray(models)) return [];

  return models
    .filter((m) => m && m.title && m.url)
    .map((m) => {
      const desc = cleanDescription(m.subtitle || m.description);
      return {
        title: `Kaggle: ${m.title}`,
        description: desc || 'Open weights model available on Kaggle Hub.',
        url: m.url.startsWith('http') ? m.url : `https://www.kaggle.com${m.url}`,
        source: KAGGLE_SOURCE,
        date: new Date().toISOString(),
      };
    });
}

export async function fetchKaggleModels() {
  const username = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;

  if (!username || !key) {
    console.log('[kaggle-models] KAGGLE_USERNAME or KAGGLE_KEY not set — skipping Kaggle');
    return [];
  }

  try {
    const auth = Buffer.from(`${username}:${key}`).toString('base64');
    const response = await fetch(KAGGLE_MODELS_API, {
      headers: {
        'User-Agent': 'FreeAITracker/1.0',
        'Authorization': `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[kaggle-models] API returned status ${response.status}`);
      return [];
    }

    const data = await response.json();
    return parseKaggleModels(data).slice(0, 20);
  } catch (error) {
    console.warn('[kaggle-models] Fetch failed:', error.message);
    return [];
  }
}
