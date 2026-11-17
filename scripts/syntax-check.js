import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIRS = ['api', 'src', 'scripts', 'tests'];
let checkedCount = 0;

function checkFile(filePath) {
  try {
    execFileSync(process.execPath, ['--check', filePath], { stdio: 'pipe' });
    checkedCount++;
  } catch (err) {
    console.error(`Syntax error in ${filePath}:`, err.message);
    process.exit(1);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      checkFile(full);
    }
  }
}

for (const dir of DIRS) {
  walkDir(dir);
}

console.log(`✅ Syntax check passed for all ${checkedCount} JavaScript/ESM files.`);
