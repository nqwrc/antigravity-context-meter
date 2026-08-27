# antigravity-context-meter

Real-time context window usage meter and token tracker for Google Antigravity IDE with per-project scoping.

## goal
Provide zero-configuration context window telemetry, multi-window session tracking, and developer artifact navigation for Google Antigravity IDE.

## kpi
- marketplace-installs: total verified installations across VS Code Marketplace and Open VSX.
- active-issues: open bug reports or feature requests on GitHub.

## kill
Archived if Google Antigravity IDE introduces native, project-scoped token telemetry and transcript navigation in core UI.

## how
VS Code extension written in vanilla JavaScript (Node.js built-ins) with zero runtime dependencies.

---

## Features

- **Project-Scoped Status Bar**: Displays active workspace project name and token usage (e.g., `Context (my-app): 24.5k / 1.0M (2.5%)`).
- **Multi-Window Support**: Automatically disambiguates and binds metrics to the specific project open in each VS Code window.
- **Real-Time Log Watching**: Asynchronous event-driven file watching on session transcripts.
- **Warning Threshold**: Highlights the status bar badge in warning amber when context exceeds capacity limit (default 75%).
- **QuickPick Details**: Click badge to view turn counts, tool executions, transcript file size, and one-click actions:
  - Open active JSONL transcript in editor.
  - Reveal session artifacts directory in OS file manager.
  - Copy internal session UUID to clipboard.

## Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `antigravityContextMeter.modelContextLimit` | number | `1000000` | Context token capacity for active model. |
| `antigravityContextMeter.warningThresholdPercent` | number | `75` | Percentage threshold to trigger amber warning badge. |
| `antigravityContextMeter.refreshIntervalSeconds` | number | `3` | Interval to check for active conversation changes. |

## License

MIT © Nicola Pandolfi
