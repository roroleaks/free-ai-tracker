import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const homeDir = os.homedir();
const scratchDir = path.resolve('..');
const scratchZip = path.join(scratchDir, 'free-ai-tracker-snapshot.zip');

const targetPaths = [
  scratchZip,
  path.join(homeDir, 'Downloads', 'free-ai-tracker-snapshot.zip'),
  path.join(homeDir, 'free-ai-tracker-snapshot.zip'),
];

console.log('📦 Creating clean project ZIP snapshot via git archive...');

try {
  // Archive committed HEAD files
  execSync(`git archive -o "${scratchZip}" HEAD`, { stdio: 'inherit' });

  const stats = fs.statSync(scratchZip);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  // Copy to user convenient locations (Downloads and Home root)
  for (const dest of targetPaths.slice(1)) {
    try {
      const destDir = path.dirname(dest);
      if (fs.existsSync(destDir)) {
        fs.copyFileSync(scratchZip, dest);
      }
    } catch (copyErr) {
      console.warn(`Could not copy to ${dest}:`, copyErr.message);
    }
  }

  console.log(`\n✅ Snapshot successfully created (${sizeMB} MB)!`);
  console.log('Available at:');
  for (const p of targetPaths) {
    if (fs.existsSync(p)) {
      console.log(`  - ${p}`);
    }
  }
} catch (err) {
  console.error('Failed to create snapshot:', err.message);
  process.exit(1);
}
