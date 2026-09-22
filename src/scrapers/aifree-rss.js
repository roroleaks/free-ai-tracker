import fetch from 'node-fetch';

const AIFREE_FEED = 'https://aifree.dev/rss.xml';
const AIFREE_SOURCE = 'aifree';

export function parseAifreeRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const description = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || '';
    const date = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';

    if (!title || !link) continue;

    items.push({
      title,
      description: description
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500) || 'Free AI offer from aifree.dev',
      url: link,
      source: AIFREE_SOURCE,
      date,
    });
  }

  return items;
}

export async function fetchAifreeOffers() {
  const response = await fetch(AIFREE_FEED, {
    headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' },
  });

  if (!response.ok) {
    console.error(`aifree.dev feed failed with status ${response.status}`);
    return [];
  }

  const xml = await response.text();
  return parseAifreeRss(xml).slice(0, 20);
}