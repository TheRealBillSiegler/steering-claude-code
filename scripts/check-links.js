#!/usr/bin/env node
// Dead-reference checker, two phases. Run from the repo root; exit 1 on any hit.
//
// 1. Repo-wide: every relative markdown link resolves to a real file, and every
//    #anchor matches a heading in the target under GitHub's slug rules
//    (lowercase, punctuation stripped, each space becomes one hyphen — an em
//    dash between spaces therefore yields a double hyphen).
// 2. Payload containment: a markdown link inside skills/ or .claude-plugin/ —
//    this single-plugin repo's shipped payload — must resolve WITHIN one of
//    those two dirs or be an absolute URL. docs/, evals/, scripts/, and the
//    root README are build/verify apparatus, not the execution surface a
//    skill should assume travels with it; a relative link out of the payload
//    into apparatus looks fine in this checkout but is dead wherever the
//    payload is read on its own.
//
// Prose references (backticked paths, "this repo's X") are not checked here:
// a lint precise enough to avoid flagging correctly-qualified repo references
// would be a parser, not a grep. That class stays with human/agent review.
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) files.push(p);
  }
})('.');

const slug = (t) => t.toLowerCase().replace(/[^\w\s-]/g, '').replace(/ /g, '-');
const anchors = {};
for (const f of files) {
  anchors[path.resolve(f)] = new Set(
    [...fs.readFileSync(f, 'utf8').matchAll(/^#+\s+(.*)$/gm)].map((m) => slug(m[1]))
  );
}

// Single-plugin root layout: the shipped payload is skills/ + .claude-plugin/
// (no hooks or commands ship in this plugin). Anything else at the root
// (docs/, evals/, scripts/, README, CHANGELOG, LICENSE) is repo apparatus.
const PAYLOAD_DIRS = ['skills', '.claude-plugin'];
const payloadRootOf = (f) => {
  const top = path.relative('.', f).split(path.sep)[0];
  return PAYLOAD_DIRS.includes(top) ? path.resolve(top) : null;
};

let checked = 0;
const bad = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const payload = payloadRootOf(f);
  for (const m of src.matchAll(/\]\(([^)\s]+)\)/g)) {
    const url = m[1];
    if (/^(https?:|mailto:)/.test(url)) continue;
    checked++;
    const [rel, anchor] = url.split('#');
    const target = rel ? path.resolve(path.dirname(f), rel) : path.resolve(f);
    if (rel && !fs.existsSync(target)) {
      bad.push(`${f} -> ${url} (missing target)`);
      continue;
    }
    if (anchor && fs.existsSync(target) && fs.statSync(target).isFile() && anchors[target] && !anchors[target].has(anchor)) {
      bad.push(`${f} -> ${url} (missing anchor)`);
    }
    if (payload && rel && !(target + path.sep).startsWith(payload + path.sep) && target !== payload) {
      bad.push(`${f} -> ${url} (escapes the payload: dead wherever skills/ or .claude-plugin/ is read on its own — use an absolute URL)`);
    }
  }
}

console.log(`${checked} relative links checked across ${files.length} markdown files`);
if (bad.length) {
  console.error('DEAD REFERENCES:');
  for (const b of bad) console.error('  ' + b);
  process.exit(1);
}
console.log('all resolve; plugin payload self-contained');
