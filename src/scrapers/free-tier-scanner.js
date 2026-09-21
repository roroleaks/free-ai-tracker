import fetch from 'node-fetch';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

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

export async function scanFreeTiers() {
  const findings = [];

  try {
    const response = await fetch(OPENROUTER_API, {
      headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' },
    });

    if (!response.ok) {
      console.error(`OpenRouter API failed with status ${response.status}`);
      return findings;
    }

    const data = await response.json();
    const models = Array.isArray(data) ? data : (data.data || []);

    for (const model of models) {
      if (!isFreeModel(model)) continue;

      findings.push({
        title: model.name || model.id,
        description: model.description || 'Free AI model',
        url: `https://openrouter.ai/${model.id}`,
        source: 'openrouter',
        date: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to scan free tiers:', error.message);
  }

  return findings;
}