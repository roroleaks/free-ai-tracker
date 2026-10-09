import fetch from 'node-fetch';

const OLLAMA_LIBRARY_URL = 'https://ollama.com/library';
const OLLAMA_SOURCE = 'ollama';

/**
 * Parses Ollama library HTML page into standardized finding objects.
 */
export function parseOllamaHtml(html) {
  const findings = [];
  const regex = /<a[^>]*href="\/library\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const slug = match[1].trim();
    const inner = match[2];

    // Extract human-friendly model title (e.g., "llama3.1", "deepseek-r1")
    const titleMatch = inner.match(/<span[^>]*truncate[^>]*>([^<]+)<\/span>/i) ||
                       inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const rawTitle = titleMatch ? titleMatch[1].trim() : slug;
    const cleanTitle = rawTitle.replace(/<[^>]+>/g, '').trim() || slug;

    // Extract description
    const descMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const desc = descMatch
      ? descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
      : 'Open-weights model available for local and serverless inference via Ollama.';

    // Format title
    const title = `Ollama: ${cleanTitle}`;

    findings.push({
      title,
      description: desc || `Open weights model ${slug} ready for zero-cost local execution`,
      url: `https://ollama.com/library/${slug}`,
      source: OLLAMA_SOURCE,
      date: new Date().toISOString(),
    });
  }

  return findings;
}

/**
 * Fetches the top open-weights models from Ollama's public model library.
 */
export async function fetchOllamaModels() {
  try {
    const response = await fetch(OLLAMA_LIBRARY_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.error(`Ollama library fetch failed with status ${response.status}`);
      return [];
    }

    const html = await response.text();
    const all = parseOllamaHtml(html);
    // Return top 25 open-weight models
    return all.slice(0, 25);
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error.message);
    return [];
  }
}
