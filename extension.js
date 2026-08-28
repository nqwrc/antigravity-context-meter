const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");

let statusBarItem;
let pollTimer = null;
let fileWatcher = null;
let currentConvId = null;
let currentLogPath = null;
let lastStats = null;
let debounceTimeout = null;

function normalizePath(p) {
  if (!p) return "";
  return p.trim().toLowerCase().replace(/[\\/]+/g, "/").replace(/\/+$/, "");
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

function getBrainDir() {
  const home = process.env.USERPROFILE || os.homedir();
  return path.join(home, ".gemini", "antigravity-ide", "brain");
}

function getActiveWorkspaceInfo() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return {
      name: vscode.workspace.name || "Default",
      paths: []
    };
  }

  return {
    name: folders[0].name || path.basename(folders[0].uri.fsPath),
    paths: folders.map(f => normalizePath(f.uri.fsPath))
  };
}

function getSessionPaths(logPath) {
  if (!fs.existsSync(logPath)) return [];
  try {
    const content = fs.readFileSync(logPath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    const detected = new Set();

    // Inspect first 35 and last 35 lines
    const sample = lines.slice(0, 35).concat(lines.slice(-35));

    for (const line of sample) {
      // 1. Workspace mapping tags: [URI] -> [CorpusName]
      const wsMatches = line.matchAll(/([a-zA-Z]:[\\/][^ \t\r\n\<\>\"\'\]]+)\s*->/g);
      for (const match of wsMatches) {
        const n = normalizePath(match[1]);
        if (n) detected.add(n);
      }

      // 2. Active Document / open documents
      const docMatches = line.matchAll(/(?:Active Document|open documents):\s*[\r\n\s\-]*(?:-\s*)?([a-zA-Z]:[\\/][^\r\n\(\)]+)/gi);
      for (const match of docMatches) {
        const n = normalizePath(match[1]);
        if (n) detected.add(n);
      }

      // 3. Cwd attributes
      const cwdMatches = line.matchAll(/"Cwd":\s*"([^"]+)"/g);
      for (const match of cwdMatches) {
        const n = normalizePath(match[1]);
        if (n) detected.add(n);
      }

      // 4. File tool parameters
      const fileMatches = line.matchAll(/"(?:AbsolutePath|TargetFile|SearchPath)":\s*"([^"]+)"/g);
      for (const match of fileMatches) {
        const p = normalizePath(match[1]);
        if (p && !p.includes(".gemini") && !p.includes("appdata") && !p.includes("windows/")) {
          detected.add(p);
        }
      }
    }

    return Array.from(detected);
  } catch (err) {
    return [];
  }
}

function findConversationForCurrentProject() {
  const brainDir = getBrainDir();
  if (!fs.existsSync(brainDir)) {
    return null;
  }

  const { name: projectName, paths: workspacePaths } = getActiveWorkspaceInfo();

  try {
    const entries = fs.readdirSync(brainDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== "tempmediaStorage")
      .map(d => {
        const logPath = path.join(brainDir, d.name, ".system_generated", "logs", "transcript.jsonl");
        const mtime = fs.existsSync(logPath) ? fs.statSync(logPath).mtimeMs : 0;
        return {
          id: d.name,
          logPath: logPath,
          dirPath: path.join(brainDir, d.name),
          mtime: mtime
        };
      })
      .filter(x => x.mtime > 0)
      .sort((a, b) => b.mtime - a.mtime);

    if (entries.length === 0) {
      return null;
    }

    // If we have workspace paths, find the latest conversation referencing one of these paths
    if (workspacePaths.length > 0) {
      for (const entry of entries) {
        const sessionPaths = getSessionPaths(entry.logPath);
        const matches = workspacePaths.some(wsPath =>
          sessionPaths.some(p => p.startsWith(wsPath) || wsPath.startsWith(p))
        );

        if (matches) {
          return {
            ...entry,
            projectName: projectName,
            workspaceRoot: workspacePaths[0]
          };
        }
      }
    }

    // Fallback: return latest overall session
    return {
      ...entries[0],
      projectName: projectName,
      workspaceRoot: workspacePaths[0] || "Global"
    };
  } catch (err) {
    return null;
  }
}

const MODEL_LIMITS_MAP = {
  "gemini 3.7 flash": 1000000,
  "gemini 3.6 flash": 1000000,
  "gemini 3.5 flash": 1000000,
  "gemini 3.1 pro": 1000000,
  "claude sonnet 4.6": 200000,
  "claude opus 4.6": 200000,
  "gpt-oss 120b": 128000
};

function detectModelName(content) {
  if (!content || typeof content !== "string") return null;
  const low = content.toLowerCase();
  if (low.includes("gemini 3.7 flash (high)") || low.includes("gemini 3.7 flash")) return "Gemini 3.7 Flash";
  if (low.includes("gemini 3.6 flash")) return "Gemini 3.6 Flash";
  if (low.includes("gemini 3.5 flash")) return "Gemini 3.5 Flash";
  if (low.includes("gemini 3.1 pro")) return "Gemini 3.1 Pro";
  if (low.includes("claude sonnet 4.6")) return "Claude Sonnet 4.6";
  if (low.includes("claude opus 4.6")) return "Claude Opus 4.6";
  if (low.includes("gpt-oss 120b")) return "GPT-OSS 120B";
  return null;
}

function parseTranscript(logPath) {
  if (!fs.existsSync(logPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(logPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    let totalChars = 0;
    let systemChars = 0;
    let userChars = 0;
    let assistantChars = 0;
    let thinkingChars = 0;
    let toolPayloadChars = 0;
    let userTurns = 0;
    let assistantTurns = 0;
    let toolCalls = 0;
    let truncatedCount = 0;
    let checkpointCount = 0;
    let detectedModel = null;
    const toolUsageMap = {};

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (!detectedModel && entry.content) {
          detectedModel = detectModelName(entry.content);
        }

        if (entry.content && typeof entry.content === "string") {
          totalChars += entry.content.length;
        }

        if (entry.type === "USER_INPUT") {
          userTurns++;
          if (entry.content) userChars += entry.content.length;
        } else if (entry.type === "PLANNER_RESPONSE" || entry.source === "MODEL") {
          assistantTurns++;
          if (entry.content) assistantChars += entry.content.length;
          if (entry.thinking) {
            thinkingChars += entry.thinking.length;
            totalChars += entry.thinking.length;
          }
        } else if (entry.source === "SYSTEM") {
          if (entry.content) {
            systemChars += entry.content.length;
            if (entry.type === "CHECKPOINT" || entry.content.trim().startsWith("{{ CHECKPOINT")) {
              checkpointCount++;
            }
          }
        }

        if (entry.tool_calls && Array.isArray(entry.tool_calls)) {
          toolCalls += entry.tool_calls.length;
          for (const tc of entry.tool_calls) {
            const toolName = tc.name || tc.toolAction || "unknown";
            toolUsageMap[toolName] = (toolUsageMap[toolName] || 0) + 1;
            if (tc.args) {
              const argStr = JSON.stringify(tc.args);
              toolPayloadChars += argStr.length;
              totalChars += argStr.length;
            }
          }
        }

        if (entry.is_truncated) {
          truncatedCount++;
        }
      } catch (e) {}
    }

    const systemTokens = Math.round(systemChars / 3.8);
    const userTokens = Math.round(userChars / 3.8);
    const assistantTokens = Math.round((assistantChars + thinkingChars) / 3.8);
    const toolTokens = Math.round(toolPayloadChars / 3.8);
    const estimatedTokens = Math.max(
      Math.round(totalChars / 3.8),
      systemTokens + userTokens + assistantTokens + toolTokens
    );

    const topTools = Object.entries(toolUsageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      lines: lines.length,
      userTurns,
      assistantTurns,
      toolCalls,
      truncatedCount,
      checkpointCount,
      totalChars,
      systemTokens,
      userTokens,
      assistantTokens,
      toolTokens,
      estimatedTokens,
      detectedModel: detectedModel || "Gemini Default",
      topTools,
      fileSizeBytes: fs.statSync(logPath).size
    };
  } catch (err) {
    return null;
  }
}

function updateStatusBar() {
  const config = vscode.workspace.getConfiguration("antigravityContextMeter");
  let maxTokens = config.get("modelContextLimit", 1000000);
  const warnThreshold = config.get("warningThresholdPercent", 75);

  const conv = findConversationForCurrentProject();
  if (!conv) {
    statusBarItem.text = "$(graph) Context: Idle";
    statusBarItem.tooltip = "No active Antigravity session found for this project.";
    statusBarItem.backgroundColor = undefined;
    statusBarItem.show();
    return;
  }

  if (currentConvId !== conv.id || currentLogPath !== conv.logPath) {
    currentConvId = conv.id;
    currentLogPath = conv.logPath;
    setupWatcher(conv.logPath);
  }

  const stats = parseTranscript(conv.logPath);
  if (!stats) {
    return;
  }

  // If detected model has known capacity and user hasn't overridden default
  if (stats.detectedModel && maxTokens === 1000000) {
    const key = stats.detectedModel.toLowerCase();
    if (MODEL_LIMITS_MAP[key]) {
      maxTokens = MODEL_LIMITS_MAP[key];
    }
  }

  lastStats = {
    ...stats,
    maxTokens,
    convId: conv.id,
    projectName: conv.projectName,
    workspaceRoot: conv.workspaceRoot,
    dirPath: conv.dirPath,
    logPath: conv.logPath
  };

  const pctNum = (stats.estimatedTokens / maxTokens) * 100;
  const pct = pctNum.toFixed(1);
  const tokenStr = formatNumber(stats.estimatedTokens);
  const maxStr = formatNumber(maxTokens);
  const tag = conv.projectName;

  if (pctNum >= 85) {
    statusBarItem.text = `$(error) Context (${tag}): ${tokenStr} / ${maxStr} (${pct}%)`;
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
  } else if (pctNum >= warnThreshold || pctNum >= 60) {
    statusBarItem.text = `$(warning) Context (${tag}): ${tokenStr} / ${maxStr} (${pct}%)`;
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  } else {
    statusBarItem.text = `$(graph) Context (${tag}): ${tokenStr} / ${maxStr} (${pct}%)`;
    statusBarItem.backgroundColor = undefined;
  }

  const tooltip = new vscode.MarkdownString();
  tooltip.isTrusted = true;
  tooltip.appendMarkdown(`### Antigravity Context Window — ${tag}\n\n`);
  tooltip.appendMarkdown(`| Metric | Value |\n|---|---|\n`);
  tooltip.appendMarkdown(`| **Project** | **${tag}** |\n`);
  tooltip.appendMarkdown(`| **Active Model** | **${stats.detectedModel}** |\n`);
  tooltip.appendMarkdown(`| **Tokens (est.)** | **${stats.estimatedTokens.toLocaleString()}** / ${maxTokens.toLocaleString()} |\n`);
  tooltip.appendMarkdown(`| **Context Used** | **${pct}%** |\n`);
  tooltip.appendMarkdown(`| **User Turns** | ${stats.userTurns} |\n`);
  tooltip.appendMarkdown(`| **Tool Executions** | ${stats.toolCalls} |\n`);
  tooltip.appendMarkdown(`| **Transcript Size** | ${(stats.fileSizeBytes / 1024).toFixed(1)} KB |\n\n`);

  tooltip.appendMarkdown(`#### Token Composition\n\n`);
  tooltip.appendMarkdown(`| Component | Est. Tokens |\n|---|---|\n`);
  tooltip.appendMarkdown(`| System / Instructions | ${stats.systemTokens.toLocaleString()} |\n`);
  tooltip.appendMarkdown(`| User Inputs | ${stats.userTokens.toLocaleString()} |\n`);
  tooltip.appendMarkdown(`| Agent Output & Thinking | ${stats.assistantTokens.toLocaleString()} |\n`);
  tooltip.appendMarkdown(`| Tool Argument Payloads | ${stats.toolTokens.toLocaleString()} |\n\n`);

  if (stats.topTools && stats.topTools.length > 0) {
    tooltip.appendMarkdown(`**Top Tools**: ${stats.topTools.map(t => `\`${t[0]}\` (${t[1]})`).join(", ")}\n\n`);
  }

  if (stats.truncatedCount > 0) {
    tooltip.appendMarkdown(`> [!WARNING]\n> ${stats.truncatedCount} steps were compacted in transcript.\n\n`);
  }
  tooltip.appendMarkdown("[Show Details](command:antigravityContextMeter.showDetails) | [Open Transcript](command:antigravityContextMeter.openTranscript)");

  statusBarItem.tooltip = tooltip;
  statusBarItem.show();
}

function setupWatcher(logPath) {
  if (fileWatcher) {
    try {
      fileWatcher.close();
    } catch (e) {}
    fileWatcher = null;
  }

  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    return;
  }

  try {
    fileWatcher = fs.watch(logDir, (eventType, filename) => {
      if (filename && filename.includes("transcript")) {
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(() => {
          updateStatusBar();
        }, 250);
      }
    });
  } catch (err) {}
}

function activate(context) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "antigravityContextMeter.showDetails";
  context.subscriptions.push(statusBarItem);

  const showDetailsCmd = vscode.commands.registerCommand("antigravityContextMeter.showDetails", async () => {
    if (!lastStats) {
      vscode.window.showInformationMessage("No conversation telemetry recorded yet for this project.");
      return;
    }

    const maxTokens = lastStats.maxTokens || 1000000;
    const pct = ((lastStats.estimatedTokens / maxTokens) * 100).toFixed(2);
    const topToolsStr = lastStats.topTools && lastStats.topTools.length > 0
      ? lastStats.topTools.map(t => `${t[0]} (${t[1]})`).join(", ")
      : "None";

    const items = [
      {
        label: `$(project) Project: ${lastStats.projectName} [${lastStats.detectedModel}]`,
        description: `Workspace: ${lastStats.workspaceRoot}`,
        action: "none"
      },
      {
        label: `$(graph) Context Window: ${lastStats.estimatedTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${pct}%)`,
        description: `System: ${lastStats.systemTokens.toLocaleString()} | User: ${lastStats.userTokens.toLocaleString()} | Asst: ${lastStats.assistantTokens.toLocaleString()} | Tools: ${lastStats.toolTokens.toLocaleString()}`,
        action: "none"
      },
      {
        label: `$(tools) Tool Executions: ${lastStats.toolCalls} calls across ${lastStats.lines} events`,
        description: `Top: ${topToolsStr}`,
        action: "none"
      },
      {
        label: "$(file-text) Open Project Session Transcript",
        description: path.basename(lastStats.logPath),
        action: "openLog"
      },
      {
        label: "$(folder-opened) Reveal Session Artifacts Folder in OS File Manager",
        description: lastStats.dirPath,
        action: "openDir"
      },
      {
        label: "$(clippy) Copy Internal Session ID",
        description: lastStats.convId,
        action: "copyId"
      }
    ];

    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: `Antigravity Telemetry: ${lastStats.projectName}`
    });

    if (!pick) return;

    if (pick.action === "openLog") {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(lastStats.logPath));
      await vscode.window.showTextDocument(doc);
    } else if (pick.action === "openDir") {
      vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(lastStats.dirPath));
    } else if (pick.action === "copyId") {
      await vscode.env.clipboard.writeText(lastStats.convId);
      vscode.window.showInformationMessage(`Copied Session ID for ${lastStats.projectName}`);
    }
  });

  const openTranscriptCmd = vscode.commands.registerCommand("antigravityContextMeter.openTranscript", async () => {
    if (lastStats && lastStats.logPath && fs.existsSync(lastStats.logPath)) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(lastStats.logPath));
      await vscode.window.showTextDocument(doc);
    } else {
      vscode.window.showWarningMessage("No active session transcript file found for this project.");
    }
  });

  const revealFolderCmd = vscode.commands.registerCommand("antigravityContextMeter.revealSessionFolder", async () => {
    if (lastStats && lastStats.dirPath && fs.existsSync(lastStats.dirPath)) {
      vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(lastStats.dirPath));
    }
  });

  const refreshCmd = vscode.commands.registerCommand("antigravityContextMeter.refresh", () => {
    updateStatusBar();
    if (typeof vscode.window.setStatusBarMessage === "function") {
      vscode.window.setStatusBarMessage("$(sync~spin) Antigravity Context telemetry refreshed", 2000);
    }
  });

  context.subscriptions.push(showDetailsCmd, refreshCmd, openTranscriptCmd, revealFolderCmd);

  // Initial update
  updateStatusBar();

  // Periodic poll to check for project/session switches
  const pollInterval = Math.max(1, vscode.workspace.getConfiguration("antigravityContextMeter").get("refreshIntervalSeconds", 3)) * 1000;
  pollTimer = setInterval(() => {
    updateStatusBar();
  }, pollInterval);
}

function deactivate() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (fileWatcher) {
    try {
      fileWatcher.close();
    } catch (e) {}
    fileWatcher = null;
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

module.exports = {
  activate,
  deactivate
};

