import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "./config.js";
import { createDecision, maybeLogDecision } from "./decision.js";
import { executeAgent as defaultExecuteAgent, formatAgentCommand } from "./adapters.js";

export async function runGatewayTurn({
  agent,
  prompt,
  cwd,
  config,
  refreshModels = false,
  maxTier,
  maxCostUsd,
  log = false,
  dryRun = false,
  passthrough = [],
  executeAgent = defaultExecuteAgent
}) {
  const decision = await createDecision({
    agent,
    task: prompt,
    cwd,
    config,
    refreshModels,
    maxTier,
    maxCostUsd
  });
  await maybeLogDecision(decision, config, log);
  if (!decision.policy.passed) {
    return {
      decision,
      output: "",
      exitCode: 3,
      error: new Error(`Policy failed: ${decision.policy.failures.join("; ")}`)
    };
  }
  if (dryRun) {
    const commandPreview = formatAgentCommand({
      agent,
      model: decision.selectedModel,
      prompt,
      passthrough
    });
    return {
      decision,
      output: `${commandPreview}\n`,
      exitCode: 0,
      dryRun: true
    };
  }

  const result = await executeAgent({
    agent,
    model: decision.selectedModel,
    prompt,
    cwd: decision.cwd,
    passthrough
  });
  return {
    decision,
    output: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.exitCode ?? 1,
    signal: result.signal,
    error: result.error
  };
}

export async function runGateway({
  agent,
  cwd = process.cwd(),
  log = false,
  refreshModels = false,
  maxTier,
  maxCostUsd,
  dryRun = false,
  passthrough = [],
  onceTask
}) {
  const config = await loadConfig(cwd);
  if (onceTask !== undefined) {
    const result = await runGatewayTurn({
      agent,
      prompt: onceTask,
      cwd,
      config,
      log,
      dryRun,
      refreshModels,
      maxTier,
      maxCostUsd,
      passthrough
    });
    printGatewayTurn(result);
    return result.exitCode;
  }

  const rl = createInterface({ input, output });
  process.stdout.write(`[model-router] gateway for ${agent}. Type /exit or /quit to stop.\n`);
  try {
    for (;;) {
      const prompt = await rl.question("> ");
      const trimmed = prompt.trim();
      if (!trimmed) continue;
      if (trimmed === "/exit" || trimmed === "/quit") return 0;
      const result = await runGatewayTurn({
        agent,
        prompt,
        cwd,
        config,
        log,
        dryRun,
        refreshModels,
        maxTier,
        maxCostUsd,
        passthrough
      });
      printGatewayTurn(result);
    }
  } catch (error) {
    if (error?.code === "ERR_USE_AFTER_CLOSE") return 0;
    throw error;
  } finally {
    rl.close();
  }
}

export function printGatewayTurn(result) {
  const { decision } = result;
  process.stderr.write(`[model-router] ${decision.agent}: ${decision.selectedModel} (${decision.tier}, confidence ${decision.confidence.toFixed(2)})\n`);
  if (!decision.policy.passed) {
    process.stderr.write(`[model-router] policy failed: ${decision.policy.failures.join("; ")}\n`);
    return;
  }
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    process.stderr.write(`[model-router] failed to launch ${decision.agent}: ${result.error.message}\n`);
    return;
  }
  if (result.output) process.stdout.write(result.output);
  if (result.exitCode !== 0) process.stderr.write(`[model-router] ${decision.agent} exited with code ${result.exitCode}\n`);
}
