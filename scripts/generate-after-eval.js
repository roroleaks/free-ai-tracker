import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { buildEmailHtml } from '../src/services/email-notifier.js';
import { baselineFixtures } from './generate-baseline.js';

const outDir = path.resolve('scratch/visual-eval');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Generate 8-item enhanced HTML (matching baseline fixture)
const html8 = buildEmailHtml(baselineFixtures, 'raouf66@gmail.com');
const enhanced8Path = path.join(outDir, 'enhanced_8.html');
fs.writeFileSync(enhanced8Path, html8, 'utf8');

// 2. Generate 15-item enhanced HTML
export const fixture15 = [
  ...baselineFixtures,
  {
    title: 'Qwen 2.5 72B Free Serverless Endpoint on Together AI',
    description: 'Together AI provides generous monthly community credits and fast token generation for Qwen 2.5 72B open weights.',
    url: 'https://together.ai/models/qwen-2.5-72b',
    source: 'together',
    date: new Date().toISOString(),
    score: 0.94,
    isNew: true,
  },
  {
    title: 'Google AI Studio: Gemini 1.5 Flash Free Tier',
    description: 'Generous 15 RPM free API tier with 1M context window for developers building multimodal applications.',
    url: 'https://aistudio.google.com',
    source: 'google',
    date: new Date().toISOString(),
    score: 0.93,
    isNew: false,
  },
  {
    title: 'Cerebras Inference: Llama 3.1 70B at 2000 tokens/sec',
    description: 'Lightning fast wafer-scale engine inference offering 1M free daily tokens on open weights.',
    url: 'https://cerebras.ai',
    source: 'cerebras',
    date: new Date().toISOString(),
    score: 0.87,
    isNew: true,
  },
  {
    title: 'Cohere Command R+ Free Trial API Keys',
    description: 'Cohere trial tier provides free embedding and text generation keys for research and prototyping.',
    url: 'https://cohere.com',
    source: 'cohere',
    date: new Date().toISOString(),
    score: 0.81,
    isNew: false,
  },
  {
    title: 'Vercel AI SDK 4.0 Open Source Release',
    description: 'Unified TypeScript toolkit for building AI-powered streaming user interfaces with React and Next.js.',
    url: 'https://sdk.vercel.ai',
    source: 'vercel-ai-sdk',
    date: new Date().toISOString(),
    score: 0.86,
    isNew: true,
  },
  {
    title: 'AI Free Dev: Curated Directory of 500+ Zero-Cost AI Tools',
    description: 'Comprehensive aggregator tracking active trials, open weights repositories, and educational API coupons.',
    url: 'https://aifree.dev',
    source: 'aifree',
    date: new Date().toISOString(),
    score: 0.76,
    isNew: false,
  },
  {
    title: 'RunPod $10 Signup Cloud GPU Credit Promo',
    description: 'New developer accounts receive $10 compute credit for serverless PyTorch and ComfyUI containers upon email verification.',
    url: 'https://runpod.io',
    source: 'deepinfra',
    date: new Date().toISOString(),
    score: 0.84,
    isNew: true,
    offerType: 'signup-credit',
  },
];

const html15 = buildEmailHtml(fixture15, 'raouf66@gmail.com');
const enhanced15Path = path.join(outDir, 'enhanced_15.html');
fs.writeFileSync(enhanced15Path, html15, 'utf8');

// Also update public/previews/digest-email-preview.html so user can view live in browser!
const previewPath = path.resolve('public/previews/digest-email-preview.html');
fs.writeFileSync(previewPath, html15, 'utf8');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fileUrl15 = `file:///${enhanced15Path.replace(/\\/g, '/')}`;
const fileUrl8 = `file:///${enhanced8Path.replace(/\\/g, '/')}`;

const shot8_1280 = path.join(outDir, 'enhanced_8_1280.png');
const shot8_375 = path.join(outDir, 'enhanced_8_375.png');

const shot15_1280 = path.join(outDir, 'enhanced_15_1280.png');
const shot15_375 = path.join(outDir, 'enhanced_15_375.png');
const shot15_375_dark = path.join(outDir, 'enhanced_15_375_dark.png');

console.log('Capturing 8-item comparison screenshots...');
execSync(`"${chromePath}" --headless=new --screenshot="${shot8_1280}" --window-size=1280,1800 --default-background-color=00000000 "${fileUrl8}"`, { stdio: 'inherit' });
execSync(`"${chromePath}" --headless=new --screenshot="${shot8_375}" --window-size=375,2600 --default-background-color=00000000 "${fileUrl8}"`, { stdio: 'inherit' });

console.log('Capturing 15-item 1280px light screenshot...');
execSync(`"${chromePath}" --headless=new --screenshot="${shot15_1280}" --window-size=1280,2400 --default-background-color=00000000 "${fileUrl15}"`, { stdio: 'inherit' });

console.log('Capturing 15-item 375px light screenshot...');
execSync(`"${chromePath}" --headless=new --screenshot="${shot15_375}" --window-size=375,3600 --default-background-color=00000000 "${fileUrl15}"`, { stdio: 'inherit' });

console.log('Capturing 15-item 375px dark screenshot...');
execSync(`"${chromePath}" --headless=new --force-prefers-color-scheme=dark --screenshot="${shot15_375_dark}" --window-size=375,3600 --default-background-color=00000000 "${fileUrl15}"`, { stdio: 'inherit' });

console.log('\nAll visual evaluation artifacts generated:');
console.log(`- 8-item enhanced: ${enhanced8Path}`);
console.log(`- 15-item enhanced: ${enhanced15Path} (${Buffer.byteLength(html15, 'utf8')} bytes)`);
console.log(`- 8-item 1280px: ${shot8_1280}`);
console.log(`- 8-item 375px: ${shot8_375}`);
console.log(`- 15-item 1280px: ${shot15_1280}`);
console.log(`- 15-item 375px: ${shot15_375}`);
console.log(`- 15-item 375px dark: ${shot15_375_dark}`);
