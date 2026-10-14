# Antigravity Context Window Meter

See how much of the context window your Google Antigravity session has used, per project, right in the status bar.

```
Context (my-app): 24.5k / 1.0M (2.5%)
```

Long agent sessions fill the context window. This extension shows how full it is for the project open in each window, so you can start a fresh conversation before the agent loses track of earlier turns.

## Install

Open the Extensions view of your editor, search for **Antigravity Context Window Meter** (extension ID `nqwrc.antigravity-context-meter`) and install it. The badge appears at the right of the status bar once an Antigravity session exists for the open project.

## Features

- **Per-project status bar**: shows the project name and estimated token usage. In a multi-window setup each window follows the session of its own project.
- **Live updates**: watches the session transcript and refreshes as the conversation grows.
- **Warning colours**: the badge turns amber above your warning threshold (default 75%) and red at 85%.
- **Model aware**: detects the active model from the transcript and picks its context size (Gemini 3.x Flash and 3.1 Pro, Claude Sonnet and Opus 4.6, GPT-OSS 120B).
- **Details on hover and click**: hover for project, model, estimated tokens, turns, tool executions, transcript size and a token breakdown (system, user, agent, tool payloads); click the badge for a menu with the same figures and the most used tools.
- **Shortcuts**: open the session transcript, reveal the session folder in your file manager, copy the session ID.

## How it works

Antigravity stores each conversation as a JSONL transcript under `~/.gemini/antigravity-ide/brain/<session>/.system_generated/logs/`. The extension reads that file, matches the session to your open workspace folder, and estimates tokens from the text length (about 3.8 characters per token).

The number is an **estimate**, not an exact token count, and the context limit comes from a built-in table of model sizes. If you know the effective window of your model, set `antigravityContextMeter.modelContextLimit` to it: any value other than the default 1,000,000 always wins over the built-in table.

## Privacy

Everything stays on your machine. The extension only reads local files, makes no network requests, sends no telemetry and has no runtime dependencies.

## Requirements

- Google Antigravity IDE (VS Code engine 1.80 or newer). The extension also installs in VS Code, but it only shows data where Antigravity session files exist.
- Developed and tested on Windows. On macOS and Linux the session folder is looked up in the same place under your home directory, but matching a session to a project relies on Windows-style paths, so the extension falls back to your most recent session. Reports from other platforms are welcome.

## Commands

| Command | What it does |
|---|---|
| `Antigravity: Show Context Window Details` | Opens the details menu (also opened by clicking the status bar badge). |
| `Antigravity: Refresh Context Telemetry` | Re-reads the transcript now. |
| `Antigravity: Open Active Session Transcript` | Opens the JSONL transcript of the current session. |
| `Antigravity: Reveal Session Folder in OS File Manager` | Shows the session folder in Explorer, Finder or your file manager. |

## Settings

| Setting | Default | Description |
|---|---|---|
| `antigravityContextMeter.modelContextLimit` | `1000000` | Context capacity in tokens. Left at the default, the size is picked from the detected model. |
| `antigravityContextMeter.warningThresholdPercent` | `75` | Usage percentage at which the badge turns amber. |
| `antigravityContextMeter.refreshIntervalSeconds` | `3` | How often the extension checks for a session or project change. |

## Feedback

Bug reports and feature requests: https://github.com/nqwrc/antigravity-context-meter/issues

## License

MIT. This is an independent project, not affiliated with or endorsed by Google.
