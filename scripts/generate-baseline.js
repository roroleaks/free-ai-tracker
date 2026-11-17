import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { buildEmailHtml } from '../src/services/email-notifier.js';

export const baselineFixtures = [
  {
    title: 'DeepSeek-V3 Open Weights Release',
    description: 'State of the art 671B mixture-of-experts model available with open weights for local inference via Ollama and vLLM with free public checkpoints.',
    url: 'https://ollama.com/library/deepseek-v3',
    source: 'ollama',
    date: new Date().toISOString(),
    score: 0.98,
    isNew: true,
  },
  {
    title: 'Llama 3.3 70B Free Tier Inference',
    description: 'Ultra fast free tier inference on Groq Cloud and OpenRouter with generous rate limits for open-source AI developers.',
    url: 'https://openrouter.ai/models/meta-llama/llama-3.3-70b-instruct:free',
    source: 'openrouter',
    date: new Date().toISOString(),
    score: 0.95,
    isNew: true,
  },
  {
    title: 'Groq Cloud Free Developer Tier',
    description: 'Ultra high-speed LPU inference on open models with generous daily free token allocations.',
    url: 'https://console.groq.com',
    source: 'groq',
    date: new Date().toISOString(),
    score: 0.91,
    isNew: false,
  },
  {
    title: 'Kaggle Models Hub: Gemma 2 9B Free Hosting',
    description: 'Google AI Gemma 2 available for free notebook GPU inference and serverless deployment directly on Kaggle.',
    url: 'https://kaggle.com/models/google/gemma-2',
    source: 'kaggle',
    date: new Date(Date.now() - 86400000).toISOString(),
    score: 0.88,
    isNew: false,
  },
  {
    title: 'HuggingFace Serverless Inference API',
    description: 'Test thousands of open-source models directly through serverless community API endpoints at zero cost.',
    url: 'https://huggingface.co/docs/api-inference',
    source: 'huggingface',
    date: new Date(Date.now() - 172800000).toISOString(),
    score: 0.85,
    isNew: false,
  },
  {
    title: 'GitHub Student Developer Pack AI Perks',
    description: 'GitHub Student Developer Pack AI Perks include free GitHub Copilot and cloud credits for verified active students worldwide.',
    url: 'https://education.github.com/pack',
    source: 'student-pack',
    date: new Date(Date.now() - 259200000).toISOString(),
    score: 0.78,
    isNew: false,
  },
  {
    title: 'Reddit Thread: Curated Community List of Free AI Tools',
    description: 'Active discussion on r/LocalLLaMA sharing current API tiers, free cloud compute coupons, and zero-cost local LLM stacks.',
    url: 'https://reddit.com/r/LocalLLaMA/comments/free_tools',
    source: 'reddit',
    date: new Date(Date.now() - 345600000).toISOString(),
    score: 0.72,
    isNew: false,
  },
  {
    title: 'DeepInfra: $5 Free Welcome API Credit',
    description: 'Get free serverless inference credits for Mistral, Qwen, and Llama models upon initial account creation.',
    url: 'https://deepinfra.com',
    source: 'deepinfra',
    date: new Date().toISOString(),
    score: 0.89,
    isNew: true,
    offerType: 'signup-credit',
  },
];

const outDir = path.resolve('scratch/visual-eval');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const baselineHtmlPath = path.join(outDir, 'baseline.html');
const rootBaselinePath = path.resolve('baseline.html');
const html = buildEmailHtml(baselineFixtures, 'raouf66@gmail.com');

fs.writeFileSync(baselineHtmlPath, html, 'utf8');
fs.writeFileSync(rootBaselinePath, html, 'utf8');
console.log(`Wrote baseline.html (${Buffer.byteLength(html, 'utf8')} bytes)`);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fileUrl = `file:///${baselineHtmlPath.replace(/\\/g, '/')}`;

const shot1280 = path.join(outDir, 'baseline_1280.png');
const shot375 = path.join(outDir, 'baseline_375.png');

console.log('Capturing 1280px screenshot...');
execSync(`"${chromePath}" --headless=new --screenshot="${shot1280}" --window-size=1280,1800 --default-background-color=00000000 "${fileUrl}"`, { stdio: 'inherit' });

console.log('Capturing 375px screenshot...');
execSync(`"${chromePath}" --headless=new --screenshot="${shot375}" --window-size=375,2600 --default-background-color=00000000 "${fileUrl}"`, { stdio: 'inherit' });

console.log(`Baseline screenshots saved:
- ${shot1280}
- ${shot375}`);
