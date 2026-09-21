import 'dotenv/config';

import { fetchGitHubReleases } from './src/scrapers/github-rss.js';
import { fetchSocialUpdates } from './src/scrapers/social-monitor.js';
import { scanFreeTiers, scanOpenRouter, scanHuggingFaceServerless } from './src/scrapers/free-tier-scanner.js';

const REQUIRED_FIELDS = ['title', 'description', 'url', 'source', 'date'];

function validateFindings(name, findings) {
  let pass = true;
  const missing = {};
  for (const f of findings) {
    for (const field of REQUIRED_FIELDS) {
      if (f[field] === undefined || f[field] === null || f[field] === '') {
        missing[field] = (missing[field] || 0) + 1;
        pass = false;
      }
    }
    if (!(f.url || '').startsWith('http')) { pass = false; console.log('  BAD URL:', f.url); }
    if (isNaN(Date.parse(f.date))) { pass = false; console.log('  BAD DATE:', f.date); }
  }
  console.log(`[${name}] ${findings.length} findings | fields complete: ${pass ? 'PASS' : 'FAIL'}${Object.keys(missing).length ? ' missing=' + JSON.stringify(missing) : ''}`);
  return pass;
}

let allPass = true;
const t0 = Date.now();

try {
  const github = await fetchGitHubReleases();
  allPass = validateFindings('github-rss', github) && allPass;
} catch (e) { allPass = false; console.log('[github-rss] THREW:', e.message); }

try {
  const social = await fetchSocialUpdates();
  allPass = validateFindings('social-monitor', social) && allPass;
} catch (e) { allPass = false; console.log('[social-monitor] THREW:', e.message); }

try {
  const freeTiers = await scanOpenRouter();
  allPass = validateFindings('openrouter', freeTiers) && allPass;
} catch (e) { allPass = false; console.log('[openrouter] THREW:', e.message); }

try {
  const hf = await scanHuggingFaceServerless();
  allPass = validateFindings('huggingface-serverless', hf) && allPass;
} catch (e) { allPass = false; console.log('[huggingface-serverless] THREW:', e.message); }

try {
  const all = await scanFreeTiers();
  allPass = validateFindings('free-tier-scanner (combined)', all) && allPass;
} catch (e) { allPass = false; console.log('[free-tier-scanner] THREW:', e.message); }

console.log(`\n=== SCRAPER SUITE (${(Date.now() - t0) / 1000}s): ` + (allPass ? 'ALL PASS' : 'FAILURES') + ' ===');
process.exit(allPass ? 0 : 1);