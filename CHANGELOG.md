# Changelog

Versions here are the `version` field in `.claude-plugin/plugin.json`, which Claude Code uses as the update cache key — an installed plugin only updates when that field rises. Repo-level changes that ship to nobody (docs/, evals/, scripts/, the root README, CI) are not versioned and are not listed.

Versioning is [semantic](https://semver.org) with one deliberate exception: **pre-1.0, breaking changes ship as MINOR**, not MAJOR — reserving 1.0.0 for a stability commitment this plugin has not made. Anything breaking is called out in its entry.

Pre-split lineage (the retired `delegation-steering` plugin this one was split from) lives at [delegation-tiering's CHANGELOG.md](https://github.com/TheRealBillSiegler/delegation-tiering/blob/main/CHANGELOG.md).

## 0.1.0

First release under this name — the steering-mechanism decision guide split out of `delegation-steering` (retired) as a single-skill plugin: the skill alone, no hooks. The skill's content is the restructured `delegation-steering` version; its worked enforcement example now cites the sibling `delegation-tiering` plugin's gate. Matching the sibling, the payload carries only what Claude needs to apply the skill — the Source section keeps the article link and the doc pages behind the mechanics; the dated quote digest lives in this repo's `docs/research/`, and the mechanism-claims coverage row lives in the sibling's [coverage matrix](https://github.com/TheRealBillSiegler/delegation-tiering/blob/main/docs/COVERAGE.md).
