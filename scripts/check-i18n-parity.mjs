#!/usr/bin/env node
// i18n parity + usage check. Cross-platform (Node only).
// Run from the repo root: npm run i18n:check
// Fails (exit 1) when any catalogue's keys differ from en.json, or when code
// uses a literal t('key') that en.json lacks. Plural suffixes (_one/_other)
// normalise to the base key.
import fs from 'node:fs';
import path from 'node:path';

const CAT = 'lib/i18n';
const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`.replace(/_(one|other)$/, '')],
  );
const load = f => new Set(flat(JSON.parse(fs.readFileSync(path.join(CAT, f), 'utf8'))));

const files = fs.readdirSync(CAT).filter(f => f.endsWith('.json'));
const en = load('en.json');
let fail = false;

for (const f of files.filter(f => f !== 'en.json')) {
  const set = load(f);
  const missing = [...en].filter(k => !set.has(k));
  const extra = [...set].filter(k => !en.has(k));
  if (missing.length) { fail = true; console.error(`✗ ${f} is missing:`, missing.join(', ')); }
  if (extra.length) { fail = true; console.error(`✗ ${f} has keys en.json does not:`, extra.join(', ')); }
}

const used = new Set();
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name))
      for (const m of fs.readFileSync(p, 'utf8').matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) used.add(m[1]);
  }
};
for (const d of ['app', 'components', 'context', 'lib']) if (fs.existsSync(d)) walk(d);

const absent = [...used].filter(k => !en.has(k));
if (absent.length) { fail = true; console.error('✗ t() keys used but absent from en.json:', absent.join(', ')); }

console.log(fail ? 'i18n parity: FAIL' : `i18n parity: OK — ${en.size} keys × ${files.length} catalogues, ${used.size} keys in use`);
process.exit(fail ? 1 : 0);
