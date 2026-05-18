import { tokenize } from "@tokenometer/core";

export function estimateCost({ agent, selectedModel, task, config }) {
  const mappedModel = config.modelMappings?.[agent]?.[selectedModel];
  if (!task?.trim()) {
    return unavailable("No task text was provided, so there is no prompt to estimate.");
  }
  if (!mappedModel) {
    return unavailable(`No Tokenometer model mapping for ${agent} model "${selectedModel}".`);
  }
  try {
    const result = tokenize({
      format: "text",
      modelId: mappedModel,
      prompt: task
    });
    return {
      available: true,
      scope: "task",
      source: "tokenometer",
      model: mappedModel,
      inputTokens: result.inputTokens,
      inputCostUsd: result.inputCost,
      approximate: result.approximate,
      tokenizer: result.tokenizer,
      reason: result.approximate
        ? "Estimated from Tokenometer offline/proxy tokenizer."
        : "Estimated from Tokenometer exact offline tokenizer."
    };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error), mappedModel);
  }
}

function unavailable(reason, model = null) {
  return {
    available: false,
    scope: "task",
    source: "tokenometer",
    model,
    inputTokens: null,
    inputCostUsd: null,
    approximate: null,
    tokenizer: null,
    reason
  };
}
