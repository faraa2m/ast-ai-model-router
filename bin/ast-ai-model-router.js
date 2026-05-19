#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { CONFIG_TEMPLATE, loadConfig, validateTier } from "../lib/config.js";
import { createDecision, maybeLogDecision } from "../lib/decision.js";
import { runGateway } from "../lib/gateway.js";
import { formatUsd } from "../lib/policy.js";

const HELP = `ast-ai-model-router

Usage:
  ast-ai-model-router analyze --agent claude|codex --task "fix auth bug" [--json]
  ast-ai-model-router explain --agent claude|codex --task "plan migration" [--json]
  ast-ai-model-router ci --agent claude|codex --task "deploy change" [--max-tier complex]
  ast-ai-model-router run claude --task "refactor parser" -- [extra claude args]
  ast-ai-model-router run codex --task "write tests" -- [extra codex args]
  ast-ai-model-router gateway claude|codex [--once --task "write docs"] -- [extra agent args]
  ast-ai-model-router init [--cwd <path>] [--force]

Options:
  --agent <agent>      claude or codex for analyze
  --task <text>        Current task description
  --cwd <path>         Workspace to inspect, defaults to current directory
  --json               Emit machine-readable JSON
  --max-tier <tier>    Policy ceiling: simple, balanced, complex, planning
  --max-cost-usd <n>   Policy ceiling when cost estimate is available
  --log                Append a local JSONL decision record
  --dry-run            For run: print the command instead of launching
  --once               For gateway: route one --task prompt and exit
  --refresh-models     Refresh Codex model catalog cache
`;

const EXIT_INVALID = 2;
const EXIT_POLICY = 3;

async function main() {
  const [command, maybeAgent, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }

  if (command === "init") {
    const { values } = parseArgs({
      args: [maybeAgent, ...rest].filter(Boolean),
      options: {
        cwd: { type: "string" },
        force: { type: "boolean" }
      }
    });
    const cwd = path.resolve(values.cwd ?? process.cwd());
    const configPath = path.join(cwd, "model-router.config.json");
    if (!values.force) {
      try {
        await access(configPath);
        throw new Error(`model-router.config.json already exists at ${configPath}. Use --force to replace it.`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await writeFile(configPath, `${JSON.stringify(CONFIG_TEMPLATE, null, 2)}\n`, "utf8");
    process.stdout.write(`Wrote ${configPath}\n`);
    return;
  }

  if (command === "analyze" || command === "explain" || command === "ci") {
    const { values } = parseArgs({
      args: [maybeAgent, ...rest].filter(Boolean),
      options: {
        agent: { type: "string" },
        task: { type: "string" },
        cwd: { type: "string" },
        json: { type: "boolean" },
        log: { type: "boolean" },
        "max-tier": { type: "string" },
        "max-cost-usd": { type: "string" },
        "refresh-models": { type: "boolean" }
      }
    });
    const agent = assertAgent(values.agent);
    const result = await routeFromValues({ agent, values });
    if (values.log) await maybeLogDecision(result, await loadConfig(values.cwd ?? process.cwd()), true);
    if (command === "explain") {
      printExplanation(result, Boolean(values.json));
      return;
    }
    if (command === "ci") {
      printCi(result, Boolean(values.json));
      if (!result.policy.passed) process.exit(EXIT_POLICY);
      return;
    }
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
        log: { type: "boolean" },
        "max-tier": { type: "string" },
        "max-cost-usd": { type: "string" },
        "dry-run": { type: "boolean" },
        "refresh-models": { type: "boolean" }
      }
    });
    const result = await routeFromValues({ agent, values });
    if (values.log) await maybeLogDecision(result, await loadConfig(values.cwd ?? process.cwd()), true);
    if (!result.policy.passed) {
      process.stderr.write(`[model-router] policy failed: ${result.policy.failures.join("; ")}\n`);
      process.exit(EXIT_POLICY);
    }
    const executable = agent === "claude" ? "claude" : "codex";
    const args = ["--model", result.selectedModel, ...passthrough];
    if (values["dry-run"]) {
      process.stdout.write(`${executable} ${args.map(shellQuote).join(" ")}\n`);
      return;
    }
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

  if (command === "gateway" || command === "intercept") {
    const agent = assertAgent(maybeAgent);
    const split = rest.indexOf("--");
    const optionArgs = split === -1 ? rest : rest.slice(0, split);
    const passthrough = split === -1 ? [] : rest.slice(split + 1);
    const { values } = parseArgs({
      args: optionArgs,
      options: {
        task: { type: "string" },
        cwd: { type: "string" },
        log: { type: "boolean" },
        once: { type: "boolean" },
        "max-tier": { type: "string" },
        "max-cost-usd": { type: "string" },
        "dry-run": { type: "boolean" },
        "refresh-models": { type: "boolean" }
      }
    });
    if (values.once && !values.task) throw new Error("--task is required with --once.");
    const exitCode = await runGateway({
      agent,
      cwd: values.cwd ?? process.cwd(),
      log: Boolean(values.log),
      dryRun: Boolean(values["dry-run"]),
      refreshModels: Boolean(values["refresh-models"]),
      maxTier: values["max-tier"] ? validateTier(values["max-tier"], "--max-tier") : undefined,
      maxCostUsd: parseOptionalNumber(values["max-cost-usd"], "--max-cost-usd"),
      passthrough,
      onceTask: values.once ? values.task : undefined
    });
    process.exit(exitCode);
  }

  throw new Error(`Unknown command: ${command}`);
}

async function routeFromValues({ agent, values }) {
  const maxTier = values["max-tier"] ? validateTier(values["max-tier"], "--max-tier") : undefined;
  const maxCostUsd = parseOptionalNumber(values["max-cost-usd"], "--max-cost-usd");
  const config = await loadConfig(values.cwd ?? process.cwd());
  return createDecision({
    agent,
    task: values.task ?? "",
    cwd: values.cwd ?? process.cwd(),
    config,
    refreshModels: Boolean(values["refresh-models"]),
    maxTier,
    maxCostUsd
  });
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
  process.stdout.write(`Cost: ${formatCost(result.costEstimate)}\n`);
  if (result.warnings.length) process.stdout.write(`Warnings: ${result.warnings.join(" ")}\n`);
  process.stdout.write(`Why: ${result.rationale[0]}\n`);
  process.stdout.write(`Run: ${result.commandPreview}\n`);
}

function printExplanation(result, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ...result, explanation: result.rationale }, null, 2)}\n`);
    return;
  }
  printResult(result, false);
  process.stdout.write("\nExplanation:\n");
  for (const line of result.rationale) process.stdout.write(`- ${line}\n`);
  process.stdout.write("\nSignal details:\n");
  for (const signal of result.signals) {
    process.stdout.write(`- ${signal.name}: ${signal.value} (${signal.detail})\n`);
  }
}

function printCi(result, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(result.policy.passed ? "model-router ci: passed\n" : "model-router ci: failed\n");
  printResult(result, false);
  if (!result.policy.passed) {
    for (const failure of result.policy.failures) process.stdout.write(`Policy failure: ${failure}\n`);
  }
}

function formatCost(costEstimate) {
  if (!costEstimate?.available) return `unavailable (${costEstimate?.reason ?? "unknown"})`;
  return `${costEstimate.inputTokens} input tokens, ${formatUsd(costEstimate.inputCostUsd)} (${costEstimate.model})`;
}

function parseOptionalNumber(raw, field) {
  if (raw === undefined || raw === null) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a non-negative number`);
  return value;
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

main().catch((error) => {
  process.stderr.write(`[model-router] ${error.message}\n`);
  process.exit(error.message.includes("must be") || error.message.includes("Expected") ? EXIT_INVALID : 1);
});
