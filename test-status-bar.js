// Behavioural tests for the status bar: builds a throw-away Antigravity "brain"
// folder in a temp dir, points the extension at it and reads what it renders.
// Standalone like test.js: `vscode` is mocked, no editor needed.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const origRequire = Module.prototype.require;
let settings = {};
let statusBarItem;

Module.prototype.require = function (id) {
  if (id !== "vscode") return origRequire.apply(this, arguments);
  return {
    window: {
      createStatusBarItem: () => {
        statusBarItem = { text: "", tooltip: "", backgroundColor: undefined, show() {}, dispose() {} };
        return statusBarItem;
      },
      showInformationMessage: () => {},
      showWarningMessage: () => {},
      showQuickPick: async () => null
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "d:\\skillshop" }, name: "skillshop" }],
      getConfiguration: () => ({ get: (key, def) => (key in settings ? settings[key] : def) }),
      openTextDocument: async () => ({}),
      name: "skillshop"
    },
    commands: { registerCommand: () => ({ dispose() {} }), executeCommand: async () => {} },
    StatusBarAlignment: { Right: 2, Left: 1 },
    ThemeColor: class { constructor(id) { this.id = id; } },
    MarkdownString: class {
      constructor() { this.value = ""; }
      appendMarkdown(str) { this.value += str; }
    },
    Uri: { file: (p) => ({ fsPath: p }) },
    env: { clipboard: { writeText: async () => {} } }
  };
};

// Renders the status bar for one fake session and returns the status bar item.
// `tokens` is the target estimate; the extension counts characters / 3.8.
function render({ tokens, header = "", config = {} }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "acm-test-"));
  const previousProfile = process.env.USERPROFILE;
  try {
    const logDir = path.join(home, ".gemini", "antigravity-ide", "brain", "session-1", ".system_generated", "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const content = header + "x".repeat(Math.max(0, Math.round(tokens * 3.8) - header.length));
    fs.writeFileSync(
      path.join(logDir, "transcript.jsonl"),
      JSON.stringify({ source: "USER", type: "USER_INPUT", content }) + "\n"
    );
    process.env.USERPROFILE = home;
    settings = { modelContextLimit: 10000, ...config };
    delete require.cache[require.resolve("./extension.js")];
    const ext = require("./extension.js");
    ext.activate({ subscriptions: [] });
    ext.deactivate();
    return statusBarItem;
  } finally {
    if (previousProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousProfile;
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

console.log("=== STATUS BAR BEHAVIOUR TESTS ===");

let item = render({ tokens: 2500 });
assert.ok(item.text.startsWith("$(graph) Context (skillshop): 2.5k / 10.0k (25.0%)"), item.text);
assert.strictEqual(item.backgroundColor, undefined);
console.log("[PASS] plain badge below every threshold");

// Regression: usage between 60% and the configured threshold must not warn.
item = render({ tokens: 6500 });
assert.ok(item.text.startsWith("$(graph)"), `65% with threshold 75 must not warn: ${item.text}`);
assert.strictEqual(item.backgroundColor, undefined);
console.log("[PASS] 65% with the default 75% threshold stays plain");

item = render({ tokens: 8000 });
assert.ok(item.text.startsWith("$(warning)"), item.text);
assert.strictEqual(item.backgroundColor.id, "statusBarItem.warningBackground");
console.log("[PASS] 80% turns the badge amber");

item = render({ tokens: 9000 });
assert.ok(item.text.startsWith("$(error)"), item.text);
assert.strictEqual(item.backgroundColor.id, "statusBarItem.errorBackground");
console.log("[PASS] 90% turns the badge red");

item = render({ tokens: 8000, config: { warningThresholdPercent: 90 } });
assert.ok(item.text.startsWith("$(graph)"), `80% with threshold 90 must not warn: ${item.text}`);
console.log("[PASS] a raised warning threshold is honoured");

item = render({ tokens: 2500, header: "Model: Gemini 3.8 Flash. " });
assert.ok(item.tooltip.value.includes("Gemini 3.8 Flash"), item.tooltip.value);
console.log("[PASS] Gemini 3.8 Flash is detected from the transcript");

console.log("=== ALL STATUS BAR TESTS COMPLETED SUCCESSFULLY ===");
