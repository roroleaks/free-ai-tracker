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

const SUBREDDITS = [
  'ChatGPT',
  'ClaudeAI',
  'GoogleGeminiAI',
  'artificial',
  'LocalLLaMA',
  'SideProject',
  'Entrepreneur',
  'AppSumo',
  'StudentDeals'
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
      description: description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) || 'Latest update',
      url: link,
      source: 'huggingface',
      date,
    });
  }

  return items;
}

const REDDIT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

let redditTokenCache = { token: null, expiresAt: 0 };

async function getRedditToken() {
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET } = process.env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) return null;
  if (redditTokenCache.token && redditTokenCache.expiresAt > Date.now() + 60_000) {
    return redditTokenCache.token;
  }

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'User-Agent': REDDIT_UA,
      Authorization: `Basic ${Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    console.error(`Reddit token fetch failed with status ${response.status}`);
    return null;
  }

  const data = await response.json();
  if (!data?.access_token) return null;

  // Access tokens live ~2h window; refresh at 1h to be safe.
  redditTokenCache = { token: data.access_token, expiresAt: Date.now() + 60 * 60 * 1000 };
  return data.access_token;
}

async function fetchSubredditOAuth(subreddit, token) {
  const url = `https://oauth.reddit.com/r/${subreddit}/hot?limit=10&raw_json=1`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': REDDIT_UA,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.error(`Reddit oauth r/${subreddit} fetch failed with status ${response.status}`);
    return [];
  }

  const data = await response.json();
  const posts = data?.data?.children || [];
  if (!Array.isArray(posts)) return [];

  return posts
    .map(({ data: post }) => {
      if (!post || post.stickied) return null;
      const title = post.title || '';
      const selftext = (post.selftext || '').replace(/\s+/g, ' ').trim().slice(0, 500);
      const permalink = post.permalink ? `https://www.reddit.com${post.permalink}` : '';
      const date = post.created_utc
        ? new Date(post.created_utc * 1000).toISOString()
        : new Date().toISOString();

      return {
        title,
        description: selftext || `Discussion in r/${subreddit}: ${title}`,
        url: permalink,
        source: 'reddit',
        date,
      };
    })
    .filter(Boolean);
}

function parseRedditAtom(xml) {
  const items = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link href="([^"]+)"/) || [])[1] || '';
    const content = (block.match(/<content type="html">([\s\S]*?)<\/content>/) || [])[1] || '';
    const date = (block.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || new Date().toISOString();

    if (!title || !link) continue;

    const cleanContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    const subMatch = link.match(/reddit\.com\/r\/([^/]+)/);
    const sub = subMatch ? subMatch[1] : '';

    items.push({
      title,
      description: cleanContent || (sub ? `Discussion in r/${sub}: ${title}` : 'Latest Reddit discussion'),
      url: link,
      source: 'reddit',
      date,
    });
  }

  return items;
}

async function fetchSubredditPosts(subreddit) {
  const token = await getRedditToken();
  if (token) return fetchSubredditOAuth(subreddit, token);

  // Fallback: public RSS/Atom feed (best-effort, heavily rate-limited).
  const response = await fetch(`https://www.reddit.com/r/${subreddit}/.rss`, {
    headers: { 'User-Agent': REDDIT_UA },
  });

  if (!response.ok) {
    console.error(`Reddit r/${subreddit} fetch failed with status ${response.status}`);
    return [];
  }

  const xml = await response.text();
  return parseRedditAtom(xml).slice(0, 10);
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

  let foundReddit = [];
  try {
    const token = await getRedditToken();
    if (token) {
      // OAuth: parallel is fine (generous per-request allowance), avoids 429s.
      const posts = await Promise.all(SUBREDDITS.map((sub) => fetchSubredditOAuth(sub, token)));
      foundReddit.push(...posts.flat());
    } else {
      // No OAuth creds: best-effort RSS fallback, sequential + throttled,
      // capped to avoid blowing the serverless timeout budget.
      for (const sub of SUBREDDITS.slice(0, 5)) {
        const posts = await fetchSubredditPosts(sub);
        foundReddit.push(...posts);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    findings.push(...foundReddit);
  } catch (error) {
    console.error('Failed to fetch Reddit posts:', error.message);
  }

  return findings;
}