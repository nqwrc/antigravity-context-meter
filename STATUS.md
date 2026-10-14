# status

state: next
goal: infra
remote: github-public
updated: 2026-10-14
stale-after-days: 30

## kpi
| kpi | target | current | as-of |
|---|---|---|---|
| marketplace-installs | 100 | 0 (nothing published; the Open VSX namespace nqwrc does not exist yet) | 2026-09-29 |
| active-issues | 0 | 0 | 2026-09-05 |

## focus
- Release workflow defect found on review: the two publish steps had `if: env.X != ''` with `env` declared in the same step, so they were skipped without a warning and the run stayed green. The package builds (vsce 4.0.0, 12.58 KB) and the smoke test passes; the rest of the review is in the local file `NOTTE-2026-09-29.md`, which stays out of this public repo.
- Patches 0001-0003 applied on the local branch `feature/release-1.0.0` (commit 76845d2, not merged, not pushed): lint OK, 9 test checks pass, `vsce` 4.0.0 packages 8 files, 12.94 KB, store README in the .vsix. No real run on GitHub yet.
- Open technical points: the context limit per model in the table is an assumption, to check with a real Antigravity session; project matching works on Windows paths only, other systems fall back to the latest session.

## next
- Owner: Open VSX first (Eclipse account with GitHub user nqwrc, Publisher Agreement, token stored as `nqwrc/OVSX_PAT`, `ovsx create-namespace nqwrc`), then the `OVSX_PAT` GitHub secret.
- Owner, **deadline 2026-11-30**: Marketplace publisher `nqwrc` and an Azure DevOps PAT (All accessible organizations, Marketplace Manage, expiry <= 2026-11-30; global PATs stop working on 2026-12-01), stored as `nqwrc/VSCE_PAT`, then the `VSCE_PAT` GitHub secret.
- Before the tag: align the CHANGELOG date with the release day and check whether Antigravity 2.x already shows the context natively.
- Push `feature/release-1.0.0`, dry run of the workflow (manual, `publish` unchecked), merge into main, then tag v1.0.0 and push the tag.

## blockers
- No Open VSX or Marketplace account, and no PAT, exists yet (external setup by the owner).
