import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { analyzeTask } from "../lib/analyzer.js";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { createDecision } from "../lib/decision.js";
import { chooseModel } from "../lib/models.js";
import { buildAgentCommand } from "../lib/adapters.js";
import { runGatewayTurn } from "../lib/gateway.js";

const execFileAsync = promisify(execFile);

test("classifies small documentation task as simple", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "model-router-"));
  await writeFile(path.join(dir, "index.js"), "export function add(a, b) { return a + b; }\n");
  const result = await analyzeTask({ cwd: dir, task: "explain this helper", config: DEFAULT_CONFIG });
  assert.equal(result.tier, "simple");
});

test("classifies architecture refactor as planning or complex", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "model-router-"));
  await writeFile(path.join(dir, "service.py"), "class Service:\n    def run(self, x):\n        if x:\n            return x\n        return None\n");
  const result = await analyzeTask({ cwd: dir, task: "plan a multi-file architecture migration for auth and database code", config: DEFAULT_CONFIG });
  assert.match(result.tier, /planning|complex/);
});

test("uses dynamic Claude aliases", async () => {
  const result = await chooseModel({ agent: "claude", tier: "planning", config: DEFAULT_CONFIG });
  assert.equal(result.model, "opusplan");
  assert.equal(result.source, "claude-alias");
});

test("adds tokenometer cost estimates when a model mapping exists", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "model-router-"));
  await writeFile(path.join(dir, "index.js"), "export function add(a, b) { return a + b; }\n");
  const result = await createDecision({
    agent: "claude",
    task: "write docs",
    cwd: dir,
    config: DEFAULT_CONFIG
  });
  assert.equal(result.tier, "simple");
  assert.equal(result.costEstimate.available, true);
  assert.equal(result.costEstimate.model, "claude-haiku-4-5");
  assert.equal(result.policy.passed, true);
});

test("ci command fails with exit code 3 when policy is exceeded", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "model-router-"));
  await writeFile(path.join(dir, "service.py"), "class Service:\n    def run(self, x):\n        if x:\n            return x\n        return None\n");
  await assert.rejects(
    execFileAsync("node", [
      path.resolve("bin/ast-ai-model-router.js"),
      "ci",
      "--agent",
      "claude",
      "--task",
      "plan a database migration",
      "--cwd",
      dir,
      "--max-tier",
      "simple"
    ]),
    (error) => error.code === 3
  );
});

test("gateway turn routes prompt and calls executor with selected model", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "model-router-"));
  await writeFile(path.join(dir, "index.js"), "export function add(a, b) { return a + b; }\n");
  const calls = [];
  const result = await runGatewayTurn({
    agent: "claude",
    prompt: "write docs",
    cwd: dir,
    config: DEFAULT_CONFIG,
    executeAgent: async (request) => {
      calls.push(request);
      return { exitCode: 0, stdout: "done\n", stderr: "" };
    }
  });

  assert.equal(result.decision.selectedModel, "haiku");
  assert.equal(result.exitCode, 0);
  assert.equal(result.output, "done\n");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].agent, "claude");
  assert.equal(calls[0].model, "haiku");
  assert.equal(calls[0].prompt, "write docs");
});

test("gateway turn skips executor when policy fails", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "model-router-"));
  await writeFile(path.join(dir, "service.py"), "class Service:\n    def run(self, x):\n        if x:\n            return x\n        return None\n");
  let called = false;
  const result = await runGatewayTurn({
    agent: "claude",
    prompt: "plan a database migration",
    cwd: dir,
    config: DEFAULT_CONFIG,
    maxTier: "simple",
    executeAgent: async () => {
      called = true;
      return { exitCode: 0, stdout: "done\n", stderr: "" };
    }
  });

  assert.equal(result.exitCode, 3);
  assert.equal(called, false);
  assert.equal(result.decision.policy.passed, false);
});

test("agent adapters build non-interactive commands", () => {
  assert.deepEqual(buildAgentCommand({
    agent: "claude",
    model: "sonnet",
    prompt: "write tests",
    passthrough: ["--permission-mode", "plan"]
  }), {
    command: "claude",
    args: ["--print", "--model", "sonnet", "--permission-mode", "plan", "write tests"]
  });

  assert.deepEqual(buildAgentCommand({
    agent: "codex",
    model: "gpt-5.4",
    prompt: "write tests",
    passthrough: ["--sandbox", "workspace-write"]
  }), {
    command: "codex",
    args: ["exec", "--model", "gpt-5.4", "--sandbox", "workspace-write", "write tests"]
  });
});

test("gateway command can route one prompt in dry-run mode", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "model-router-"));
  await writeFile(path.join(dir, "index.js"), "export function add(a, b) { return a + b; }\n");
  const { stdout, stderr } = await execFileAsync("node", [
    path.resolve("bin/ast-ai-model-router.js"),
    "gateway",
    "claude",
    "--cwd",
    dir,
    "--task",
    "write docs",
    "--once",
    "--dry-run",
    "--",
    "--permission-mode",
    "plan"
  ]);

  assert.match(stderr, /claude: haiku/);
  assert.match(stdout, /claude --print --model haiku --permission-mode plan 'write docs'/);
});
