import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { analyzeTask } from "./analyzer.js";
import { estimateCost } from "./cost.js";
import { chooseModel } from "./models.js";
import { evaluatePolicy } from "./policy.js";

export async function createDecision({ agent, task, cwd, config, refreshModels = false, maxTier, maxCostUsd }) {
  const analysis = await analyzeTask({ cwd, task, config });
  const model = await chooseModel({ agent, tier: analysis.tier, task, config, refreshModels });
  const costEstimate = estimateCost({ agent, selectedModel: model.model, task, config });
  const policy = evaluatePolicy({ tier: analysis.tier, costEstimate, config, maxTier, maxCostUsd });
  const warnings = [];
  if (model.source === "fallback") warnings.push("Codex model discovery failed; using configured fallback model.");
  if (!costEstimate.available) warnings.push(`Cost estimate unavailable: ${costEstimate.reason}`);
  if (!policy.passed) warnings.push(`Policy failed: ${policy.failures.join("; ")}`);
  const rationale = buildRationale({ analysis, model, costEstimate, policy });
  return {
    agent,
    cwd: analysis.cwd,
    selectedModel: model.model,
    tier: analysis.tier,
    confidence: analysis.confidence,
    score: analysis.score,
    signals: analysis.signals,
    rationale,
    warnings,
    costEstimate,
    policy,
    modelSource: model.source,
    commandPreview: `${agent} --model ${model.model}`
  };
}

export async function maybeLogDecision(decision, config, explicitLog = false) {
  if (!explicitLog && !config.logging?.enabled) return;
  const logPath = path.resolve(decision.cwd, config.logging?.path ?? ".model-router/decisions.jsonl");
  await mkdir(path.dirname(logPath), { recursive: true });
  const record = {
    timestamp: new Date().toISOString(),
    agent: decision.agent,
    selectedModel: decision.selectedModel,
    tier: decision.tier,
    confidence: decision.confidence,
    score: decision.score,
    costEstimate: decision.costEstimate,
    policy: decision.policy,
    signals: decision.signals
  };
  await appendFile(logPath, `${JSON.stringify(record)}\n`, "utf8");
}

function buildRationale({ analysis, model, costEstimate, policy }) {
  const sorted = [...analysis.signals].sort((a, b) => Number(b.value) - Number(a.value));
  const top = sorted.slice(0, 3).map((signal) => `${signal.name}=${signal.value} (${signal.detail})`);
  const lines = [
    `Selected ${model.model} because the task scored as ${analysis.tier} complexity.`,
    `Top signals: ${top.join("; ")}.`,
    `Model source: ${model.source}.`
  ];
  if (costEstimate.available) {
    lines.push(`Estimated task prompt cost: ${costEstimate.inputTokens} input tokens, ${costEstimate.inputCostUsd.toFixed(6)} USD (${costEstimate.model}).`);
  } else {
    lines.push(`Cost estimate unavailable: ${costEstimate.reason}`);
  }
  lines.push(policy.passed ? "Policy: passed." : `Policy: failed (${policy.failures.join("; ")}).`);
  return lines;
}
