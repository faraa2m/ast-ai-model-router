import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { analyzeTask } from "../lib/analyzer.js";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { chooseModel } from "../lib/models.js";

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
