import fetch from 'node-fetch';

const REPOS = [
  'vercel/ai',
  'ollama/ollama',
  'ggerganov/llama.cpp',
  'vllm-project/vllm',
  'microsoft/autogen',
  'huggingface/transformers',
  'comfyanonymous/ComfyUI',
  'openai/openai-python'
];

function apiHeaders() {
  return {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AI-Offer-Tracker/1.0',
    'Authorization': process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : '',
  };
}

async function fetchReleases(repo) {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=5`;
  const response = await fetch(url, { headers: apiHeaders() });

  if (!response.ok) {
    console.error(`GitHub releases failed for ${repo} with status ${response.status}`);
    return [];
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.map((item) => ({
    title: `${repo.split('/')[1]} ${item.tag_name}`,
    description: (item.body || 'Open-source release update').slice(0, 500),
    url: item.html_url,
    source: 'vercel-ai-sdk',
    date: item.published_at || new Date().toISOString(),
  }));
}

function parseRssFeed(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || 'Untitled';
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const description = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || '';
    const date = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || new Date().toISOString();

    if (!link) continue;

    items.push({
      title,
      description: description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) || `Latest article on HuggingFace blog: ${title}`,
      url: link,
      source: 'huggingface',
      date,
    });
  }

  return items;
}

async function fetchHuggingFaceBlog() {
  const response = await fetch('https://huggingface.co/blog/feed.xml', {
    headers: { 'User-Agent': 'AI-Offer-Tracker/1.0' },
  });

  if (!response.ok) {
    console.error(`HuggingFace blog fetch failed with status ${response.status}`);
    return [];
  }

  const xml = await response.text();
  return parseRssFeed(xml).slice(0, 10);
}

export async function fetchSocialUpdates() {
  const findings = [];

  try {
    const blogItems = await fetchHuggingFaceBlog();
    findings.push(...blogItems);
  } catch (error) {
    console.error('Failed to fetch HuggingFace blog:', error.message);
  }

  let foundRepos = [];
  try {
    foundRepos = await Promise.all(REPOS.map((repo) => fetchReleases(repo)));
    findings.push(...foundRepos.flat());
  } catch (error) {
    console.error('Failed to fetch repo releases:', error.message);
  }

  return findings;
}

export function getSourceNames() {
  return [['huggingface', 'HuggingFace'], ['vercel-ai-sdk', 'Vercel AI SDK']];
}