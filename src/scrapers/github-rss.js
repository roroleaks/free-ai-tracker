import fetch from 'node-fetch';

const REPOS = [
  'openai/openai-cookbook',
  'huggingface/transformers',
  'microsoft/DeepSpeed',
  'facebookresearch/llama',
  'google/gemma',
  'mistralai/mistral-src',
];

export async function fetchGitHubReleases() {
  const findings = [];

  for (const repo of REPOS) {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=5`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!response.ok) continue;

      const releases = await response.json();

      for (const release of releases) {
        if (release.draft || release.prerelease) continue;

        findings.push({
          source: 'github',
          repo,
          title: release.name || release.tag_name,
          url: release.html_url,
          publishedAt: release.published_at,
          body: release.body?.slice(0, 2000),
        });
      }
    } catch (error) {
      console.error(`Failed to fetch ${repo}:`, error.message);
    }
  }

  return findings;
}