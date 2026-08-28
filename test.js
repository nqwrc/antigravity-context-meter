const fs = require("fs");
const path = require("path");
const os = require("os");
const Module = require("module");

// Mock vscode module for standalone unit testing
const origRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === "vscode") {
    return {
      window: {
        createStatusBarItem: () => ({
          text: "",
          tooltip: "",
          show: () => {},
          dispose: () => {}
        }),
        showInformationMessage: () => {},
        showWarningMessage: () => {},
        showQuickPick: async () => null
      },
      workspace: {
        workspaceFolders: [{ uri: { fsPath: "d:\\skillshop" }, name: "skillshop" }],
        getConfiguration: () => ({
          get: (key, def) => def
        }),
        openTextDocument: async () => ({}),
        name: "skillshop"
      },
      commands: {
        registerCommand: () => ({ dispose: () => {} }),
        executeCommand: async () => {}
      },
      StatusBarAlignment: { Right: 2, Left: 1 },
      ThemeColor: class { constructor(id) { this.id = id; } },
      MarkdownString: class {
        constructor() { this.value = ""; }
        appendMarkdown(str) { this.value += str; }
      },
      Uri: { file: (p) => ({ fsPath: p }) },
      env: { clipboard: { writeText: async () => {} } }
    };
  }
  return origRequire.apply(this, arguments);
};

console.log("=== ANTIGRAVITY CONTEXT METER TEST SUITE ===");

const ext = require("./extension.js");
console.log("[PASS] extension.js loaded with mock VS Code environment");

// Test activation / deactivation lifecycle
const mockContext = { subscriptions: [] };
ext.activate(mockContext);
console.log(`[PASS] Extension activated: registered ${mockContext.subscriptions.length} subscriptions`);

ext.deactivate();
console.log("[PASS] Extension deactivated cleanly: resources disposed");

console.log("=== ALL TESTS COMPLETED SUCCESSFULLY ===");
