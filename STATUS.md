# status

state: next
goal: infra
remote: github-public
updated: 2026-09-29
stale-after-days: 30

## kpi
| kpi | target | current | as-of |
|---|---|---|---|
| marketplace-installs | 100 | 0 (nothing published; the Open VSX namespace nqwrc does not exist yet) | 2026-09-29 |
| active-issues | 0 | 0 | 2026-09-05 |

## focus
- Release workflow defect found on review: the two publish steps had `if: env.X != ''` with `env` declared in the same step, so they were skipped without a warning and the run stayed green. The package builds (vsce 4.0.0, 12.58 KB) and the smoke test passes; the rest of the review is in the local file `NOTTE-2026-09-29.md`, which stays out of this public repo.
- Three patches in `patches/` (untracked, not applied, tested with `git apply --check`, lint, test and package): 0001 release workflow (job-level secrets, Node 22, pinned vsce and ovsx, Node 24 actions, tag must equal the package.json version, Open VSX and Marketplace independent), 0002 store metadata (store README, categories, keywords, untrusted workspaces), 0003 amber threshold fix (`warningThresholdPercent` above 60), Gemini 3.8 Flash and status bar tests (9 checks). No real run on GitHub yet.
- Open technical points: the context limit per model in the table is an assumption, to check with a real Antigravity session; project matching works on Windows paths only, other systems fall back to the latest session.

## next
- Apply the three patches on a work branch (`NOTTE-2026-09-29.md` section 2), then publish on Open VSX first (Eclipse account, namespace `nqwrc`, token `nqwrc/OVSX_PAT`), the Marketplace publisher and PAT before 2026-11-30 (global Azure DevOps PATs stop working on 2026-12-01), the two GitHub secrets, a dry run of the workflow and the tag v1.0.0.
- Before the tag: align the CHANGELOG date with the release day and check whether Antigravity 2.x already shows the context natively.

## blockers
- The repository answers 404 to anonymous requests while `remote` says github-public: the store links break until it is public (`gh repo view nqwrc/antigravity-context-meter --json visibility`), or `remote` changes to github-private.
- No Open VSX or Marketplace account, and no PAT, exists yet (external setup by the owner).
