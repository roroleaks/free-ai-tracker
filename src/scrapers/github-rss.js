import fetch from 'node-fetch';

const SEARCH_QUERIES = [
  '"LLM" OR "AI model" OR "GPT" OR "open source model" in:name,description,readme',
  '"free api" in:name,description,readme',
  '"llm free tier" OR "free inference" OR "ai credits" in:name,description',
  '"open weights model" in:name,description',
  '"free ai" OR "ai tools" OR "ai platform" in:name,description',
];

const HEADERS = {
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'AI-Offer-Tracker/1.0',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchGitHubReleases() {
  const seen = new Map();

  async function searchPage(query) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=20`;
    const headers = {
      ...HEADERS,
      Authorization: process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : '',
    };

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error(`GitHub search failed with status ${response.status} for query "${query}"`);
      return;
    }

    const data = await response.json();
    for (const repo of data.items || []) {
      if (!seen.has(repo.full_name)) {
        seen.set(repo.full_name, {
          title: repo.full_name,
          description: repo.description || `Trending repo with ${repo.stargazers_count} stars`,
          url: repo.html_url,
          source: 'github',
          date: repo.updated_at || new Date().toISOString(),
        });
      }
    }
  }

  for (const query of SEARCH_QUERIES) {
    try {
      await searchPage(query);
      await sleep(1200);
    } catch (error) {
      console.error(`Failed to fetch GitHub search "${query}":`, error.message);
    }
  }

  return [...seen.values()];
}