import fetch from 'node-fetch';

const SEARCH_QUERIES = [
  '"LLM" OR "AI model" OR "GPT" OR "open source model" in:name,description,readme',
  '"free api" OR "free inference" OR "llm free tier" OR "ai credits" in:name,description',
  '"open weights model" OR "free ai" OR "free tier" in:name,description',
];

const HEADERS = {
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'AI-Offer-Tracker/1.0',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchGitHubReleases() {
  const seen = new Map();

  async function searchPage(query, attempt = 0) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=30`;
    const headers = {
      ...HEADERS,
      Authorization: process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : '',
    };

    const response = await fetch(url, { headers });

    if (response.status === 403 || response.status === 429) {
      const wait = 5000 * (attempt + 1);
      console.error(`GitHub search rate-limited (${response.status}) for "${query}", retrying in ${wait}ms`);
      if (attempt < 2) {
        await sleep(wait);
        return searchPage(query, attempt + 1);
      }
      console.error(`GitHub search failed after retries with status ${response.status} for query "${query}"`);
      return;
    }

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
      await sleep(1500);
    } catch (error) {
      console.error(`Failed to fetch GitHub search "${query}":`, error.message);
    }
  }

  return [...seen.values()];
}