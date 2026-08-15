#!/usr/bin/env node
// Fails when a PR changes the shipped payload (skills/ or .claude-plugin/)
// without raising the plugin's version. Claude Code uses the version in
// .claude-plugin/plugin.json as the cache key for updates: with a version
// pinned, "users get updates only when you bump this field. Pushing new
// commits without bumping it has no effect, and /plugin update reports
// 'already at the latest version'"
// (https://code.claude.com/docs/en/plugins-reference#version-management).
// So an unbumped change to the payload ships to nobody — silently, and
// looking like success. This guard is the deterministic backstop for that.
//
// Everything outside skills/ and .claude-plugin/ (docs/, evals/, scripts/,
// root README, CHANGELOG) is repo apparatus that never reaches an installer,
// so it needs no bump.
//
// The comparison baseline is what installers can actually have: the version
// on origin/main, the branch the marketplace serves. A version that has
// never reached main shipped to nobody, so a payload change against it needs
// no bump. If origin/main is unreachable, the guard falls back to comparing
// against the PR base — stricter, never weaker — and says so.
//
// Usage: node scripts/check-version-bump.js <baseSha> [headSha]
const { execFileSync } = require('child_process');

const [, , base, head = 'HEAD'] = process.argv;
if (!base) {
  console.error('usage: check-version-bump.js <baseSha> [headSha]');
  process.exit(2);
}

// stderr ignored: probing refs that legitimately lack a path (manifest never
// existed at that ref) makes git print "fatal:" noise the catch already handles.
const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });

// A base we cannot read means we cannot compare. Warn rather than block: this
// job only runs on pull_request, where base.sha is present, so the realistic
// cause is a git edge case rather than a missing bump.
try {
  git(['cat-file', '-e', base]);
} catch {
  console.warn('WARN base ' + base + ' is unreachable — skipping version check');
  process.exit(0);
}

const mainRef = (() => {
  try {
    return git(['rev-parse', '--verify', 'origin/main']).trim();
  } catch {
    return null;
  }
})();
if (!mainRef) console.warn('WARN origin/main unreachable — comparing against the PR base instead of the released baseline (fetch it with: git fetch origin main)');

const PAYLOAD_DIRS = ['skills/', '.claude-plugin/'];
const changed = git(['diff', '--name-only', base, head]).split('\n').filter(Boolean);
const touched = changed.filter((f) => PAYLOAD_DIRS.some((d) => f.startsWith(d)));

if (!touched.length) {
  console.log('ok   payload (skills/, .claude-plugin/) unchanged — version bump not required');
  process.exit(0);
}

const parse = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
const isGreater = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
};

const MANIFEST = '.claude-plugin/plugin.json';
const versionAt = (ref) => {
  try {
    return JSON.parse(git(['show', ref + ':' + MANIFEST])).version;
  } catch {
    return null; // manifest did not exist at this ref
  }
};

const after = versionAt(head);
let failures = 0;
if (after == null) {
  failures++;
  console.error('FAIL ' + MANIFEST + ' is missing or unreadable at head');
} else {
  const released = mainRef ? versionAt(mainRef) : versionAt(base);
  if (released == null) {
    console.log('ok   never released on main — version ' + after + ' needs no bump');
  } else if (isGreater(after, released)) {
    console.log('ok   released ' + released + ' -> ' + after + ' at head (' + touched.length + ' shipped file(s) changed)');
  } else {
    failures++;
    console.error(
      'FAIL version ' + after + ' does not exceed released ' + released + ' but ' + touched.length + ' shipped file(s) changed:\n' +
        touched.map((f) => '       ' + f).join('\n') +
        '\n       Raise "version" in ' + MANIFEST + ' above the version main serves, or installers will never receive this change.'
    );
  }
}

process.exit(failures ? 1 : 0);
