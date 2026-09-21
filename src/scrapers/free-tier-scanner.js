import fetch from 'node-fetch';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';
const HF_SERVERLESS_API = 'https://huggingface.co/api/models?inference=warm&sort=trendingScore&direction=-1&limit=25';

function parsePrice(value) {
  if (value === null || value === undefined) return NaN;
  const normalized = typeof value === 'number' ? String(value) : String(value).replace('$', '').trim();
  return parseFloat(normalized);
}

function isFreeModel(model) {
  const pricing = model.pricing || {};
  const prompt = parsePrice(pricing.prompt);
  const completion = parsePrice(pricing.completion);
  return prompt === 0 && completion === 0;
}

export function scanOpenRouter() {
  return fetch(OPENROUTER_API, { headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' } })
    .then((response) => {
      if (!response.ok) throw new Error(`OpenRouter API failed with status ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const models = Array.isArray(data) ? data : (data.data || []);
      return models
        .filter(isFreeModel)
        .map((model) => ({
          title: model.name || model.id,
          description: model.description || 'Free AI model',
          url: `https://openrouter.ai/${model.id}`,
          source: 'openrouter',
          date: new Date().toISOString(),
        }));
    });
}

export function scanHuggingFaceServerless() {
  return fetch(HF_SERVERLESS_API, { headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' } })
    .then((response) => {
      if (!response.ok) throw new Error(`HuggingFace serverless API failed with status ${response.status}`);
      return response.json();
    })
    .then((models) => {
      if (!Array.isArray(models)) return [];
      return models
        .filter((m) => ['text-generation', 'image-text-to-text'].includes(m.pipeline_tag))
        .map((model) => ({
          title: model.id,
          description: `Warm model available via HuggingFace serverless inference${model.tags?.length ? ` (${model.tags.slice(0, 4).join(', ')})` : ''}`,
          url: `https://huggingface.co/${model.id}`,
          source: 'huggingface',
          date: model.createdAt || new Date().toISOString(),
        }));
    });
}

export function scanGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn('[free-tier-scanner] GROQ_API_KEY not set — skipping Groq');
    return Promise.resolve([]);
  }
  return fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'AI-Offer-Tracker/1.0' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Groq API failed with status ${response.status}`);
      return response.json();
    })
    .then((data) => (data.data || []).map((model) => ({
      title: `Groq: ${model.id}`,
      description: `Available on Groq free tier${model.owned_by ? ` (${model.owned_by})` : ''}`,
      url: 'https://console.groq.com/docs/models',
      source: 'groq',
      date: new Date().toISOString(),
    })));
}

export function scanTogether() {
  const key = process.env.TOGETHER_API_KEY;
  if (!key) {
    console.warn('[free-tier-scanner] TOGETHER_API_KEY not set — skipping Together AI');
    return Promise.resolve([]);
  }
  return fetch('https://api.together.xyz/v1/models', {
    headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'AI-Offer-Tracker/1.0' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Together API failed with status ${response.status}`);
      return response.json();
    })
    .then((data) => (data.data || []).map((model) => ({
      title: `Together: ${model.id}`,
      description: `Model served by Together AI${model.type ? ` (${model.type})` : ''}`,
      url: 'https://www.together.ai/pricing',
      source: 'together',
      date: new Date().toISOString(),
    })));
}

export function scanGoogleAIStudio() {
  const key = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!key) {
    console.warn('[free-tier-scanner] GOOGLE_AI_STUDIO_KEY not set — skipping Google AI Studio');
    return Promise.resolve([]);
  }
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {
    headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Google AI Studio API failed with status ${response.status}`);
      return response.json();
    })
    .then((data) => (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((model) => ({
        title: `Gemini: ${model.name}`,
        description: `Free-tier model on Google AI Studio${model.description ? ` — ${model.description}` : ''}`,
        url: 'https://aistudio.google.com/pricing',
        source: 'google',
        date: new Date().toISOString(),
      })));
}

export async function scanFreeTiers() {
  const sources = [
    scanOpenRouter().catch((error) => { console.error(error.message); return []; }),
    scanHuggingFaceServerless().catch((error) => { console.error(error.message); return []; }),
    scanGroq(),
    scanTogether(),
    scanGoogleAIStudio(),
  ];

  const results = await Promise.all(sources);
  return results.flat();
}