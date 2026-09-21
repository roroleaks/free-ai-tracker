import fetch from 'node-fetch';

const SEARCH_KEYWORDS = ['LLM', 'AI model', 'GPT', 'open source model'];
const SEARCH_QUERY = SEARCH_KEYWORDS.map(k => `"${k}"`).join(' OR ');

export async function fetchGitHubReleases() {
  const findings = [];

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
    `${SEARCH_QUERY} in:name,description,readme`
  )}&sort=stars&order=desc&per_page=20`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Offer-Tracker/1.0',
        Authorization: process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : '',
      },
    });

    if (!response.ok) {
      console.error(`GitHub search failed with status ${response.status}`);
      return findings;
    }

    const data = await response.json();

    for (const repo of (data.items || [])) {
      findings.push({
        title: repo.full_name,
        description: repo.description || `Trending repo with ${repo.stargazers_count} stars`,
        url: repo.html_url,
        source: 'github',
        date: repo.updated_at || new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to fetch GitHub trending:', error.message);
  }

  return findings;
}