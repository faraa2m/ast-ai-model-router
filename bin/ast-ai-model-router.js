#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { analyzeTask } from "../lib/analyzer.js";
import { loadConfig } from "../lib/config.js";
import { chooseModel } from "../lib/models.js";

const HELP = `ast-ai-model-router

Usage:
  ast-ai-model-router analyze --agent claude|codex --task "fix auth bug" [--json]
  ast-ai-model-router run claude --task "refactor parser" -- [extra claude args]
  ast-ai-model-router run codex --task "write tests" -- [extra codex args]

Options:
  --agent <agent>      claude or codex for analyze
  --task <text>        Current task description
  --cwd <path>         Workspace to inspect, defaults to current directory
  --json               Emit machine-readable JSON
  --refresh-models     Refresh Codex model catalog cache
`;

async function main() {
  const [command, maybeAgent, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }

  if (command === "analyze") {
    const { values } = parseArgs({
      args: [maybeAgent, ...rest].filter(Boolean),
      options: {
        agent: { type: "string" },
        task: { type: "string" },
        cwd: { type: "string" },
        json: { type: "boolean" },
        "refresh-models": { type: "boolean" }
      }
    });
    const agent = assertAgent(values.agent);
    const result = await route({ agent, task: values.task, cwd: values.cwd, refreshModels: values["refresh-models"] });
    printResult(result, Boolean(values.json));
    return;
  }

  if (command === "run") {
    const agent = assertAgent(maybeAgent);
    const split = rest.indexOf("--");
    const optionArgs = split === -1 ? rest : rest.slice(0, split);
    const passthrough = split === -1 ? [] : rest.slice(split + 1);
    const { values } = parseArgs({
      args: optionArgs,
      options: {
        task: { type: "string" },
        cwd: { type: "string" },
        "refresh-models": { type: "boolean" }
      }
    });
    const result = await route({ agent, task: values.task, cwd: values.cwd, refreshModels: values["refresh-models"] });
    const executable = agent === "claude" ? "claude" : "codex";
    const args = ["--model", result.selectedModel, ...passthrough];
    process.stderr.write(`[model-router] ${agent}: ${result.selectedModel} (${result.tier}, confidence ${result.confidence.toFixed(2)})\n`);
    const child = spawn(executable, args, { cwd: result.cwd, stdio: "inherit" });
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 1);
    });
    child.on("error", (error) => {
      process.stderr.write(`[model-router] failed to launch ${executable}: ${error.message}\n`);
      process.exit(1);
    });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function route({ agent, task, cwd, refreshModels }) {
  const config = await loadConfig(cwd ?? process.cwd());
  const analysis = await analyzeTask({ cwd: cwd ?? process.cwd(), task: task ?? "", config });
  const model = await chooseModel({ agent, tier: analysis.tier, task: task ?? "", config, refreshModels: Boolean(refreshModels) });
  return {
    agent,
    cwd: analysis.cwd,
    selectedModel: model.model,
    tier: analysis.tier,
    confidence: analysis.confidence,
    signals: analysis.signals,
    modelSource: model.source,
    commandPreview: `${agent} --model ${model.model}`
  };
}

function assertAgent(agent) {
  if (agent === "claude" || agent === "codex") return agent;
  throw new Error("Expected agent to be 'claude' or 'codex'.");
}

function printResult(result, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`Agent: ${result.agent}\n`);
  process.stdout.write(`Model: ${result.selectedModel}\n`);
  process.stdout.write(`Tier: ${result.tier}\n`);
  process.stdout.write(`Confidence: ${result.confidence.toFixed(2)}\n`);
  process.stdout.write(`Signals: ${result.signals.map((signal) => `${signal.name}=${signal.value}`).join(", ")}\n`);
  process.stdout.write(`Run: ${result.commandPreview}\n`);
}

main().catch((error) => {
  process.stderr.write(`[model-router] ${error.message}\n`);
  process.exit(1);
});
