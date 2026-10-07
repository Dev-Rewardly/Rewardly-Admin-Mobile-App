#!/usr/bin/env node
// Token guard. Fails when a screen paints a hex colour that is not a
// constants/design.ts token. Run from the repo root: npm run tokens:check
import fs from 'node:fs';
import path from 'node:path';

const design = fs.readFileSync('constants/design.ts', 'utf8');
const TOKENS = new Set([...design.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(m => m[0].toUpperCase()));

const files = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
};
['app', 'components'].forEach(d => fs.existsSync(d) && walk(d));

let bad = 0;
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*\/\//.test(line)) return;
    for (const m of line.matchAll(/#[0-9A-Fa-f]{6}\b/g)) {
      if (TOKENS.has(m[0].toUpperCase())) continue;
      bad++;
      console.error(`✗ ${f}:${i + 1}: ${m[0]} is not a design token`);
    }
  });
}
console.log(bad ? `tokens: FAIL — ${bad} off-palette colour(s)` : `tokens: OK — ${files.length} files, palette of ${TOKENS.size}`);
process.exit(bad ? 1 : 0);
