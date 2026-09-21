# status

state: next
goal: infra
remote: github-public
updated: 2026-09-21
stale-after-days: 30

## kpi
| kpi | target | current | as-of |
|---|---|---|---|
| marketplace-installs | 100 | 0 | 2026-09-05 |
| active-issues | 0 | 0 | 2026-09-05 |

## focus
- Hardened packaging, marketplace metadata, and CI/CD automated release pipeline.

## next
- Complete Microsoft publisher registration for 'nqwrc' at marketplace.visualstudio.com/manage.
- Generate Azure DevOps PAT, save to Windows Credential Manager as nqwrc/VSCE_PAT, and set GitHub Secret.
- Trigger initial v1.0.0 release.

## blockers
- Pending external publisher account setup and PAT generation on Azure DevOps.
