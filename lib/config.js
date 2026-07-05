import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFIG = {
  thresholds: {
    simpleMax: 34,
    balancedMax: 74
  },
  claude: {
    aliases: {
      simple: "haiku",
      balanced: "sonnet",
      complex: "opus",
      planning: "opusplan"
    }
  },
  codex: {
    discoveryCommand: "codex debug models",
    fallbackModels: {
      simple: "gpt-5.4-mini",
      balanced: "gpt-5.4",
      complex: "gpt-5.5",
      planning: "gpt-5.5"
    }
  },
  modelMappings: {
    claude: {
      haiku: "claude-haiku-4-5",
      sonnet: "claude-sonnet-4-6",
      opus: "claude-opus-4-7",
      opusplan: "claude-opus-4-7"
    },
    codex: {
      "gpt-5.4-mini": "gpt-5.4-mini",
      "gpt-5.4": "gpt-5.4",
      "gpt-5.5": "gpt-5.5",
      "codex-mini-latest": "codex-mini-latest"
    }
  },
  policy: {
    maxTier: "planning",
    maxCostUsd: null
  },
  logging: {
    enabled: false,
    path: ".model-router/decisions.jsonl"
  },
  overrides: []
};

export const CONFIG_TEMPLATE = {
  thresholds: DEFAULT_CONFIG.thresholds,
  claude: DEFAULT_CONFIG.claude,
  codex: DEFAULT_CONFIG.codex,
  modelMappings: DEFAULT_CONFIG.modelMappings,
  policy: {
    maxTier: "planning",
    maxCostUsd: null
  },
  logging: DEFAULT_CONFIG.logging,
  overrides: []
};

export async function loadConfig(cwd) {
  const configPath = path.join(cwd, "model-router.config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    return mergeConfig(DEFAULT_CONFIG, JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") return DEFAULT_CONFIG;
    throw error;
  }
}

function mergeConfig(base, override) {
  return {
    ...base,
    ...override,
    thresholds: { ...base.thresholds, ...override.thresholds },
    claude: {
      ...base.claude,
      ...override.claude,
      aliases: { ...base.claude.aliases, ...override.claude?.aliases }
    },
    codex: {
      ...base.codex,
      ...override.codex,
      fallbackModels: { ...base.codex.fallbackModels, ...override.codex?.fallbackModels }
    },
    modelMappings: {
      claude: { ...base.modelMappings.claude, ...override.modelMappings?.claude },
      codex: { ...base.modelMappings.codex, ...override.modelMappings?.codex }
    },
    policy: { ...base.policy, ...override.policy },
    logging: { ...base.logging, ...override.logging },
    overrides: override.overrides ?? base.overrides
  };
}

export function validateTier(tier, field = "tier") {
  if (["simple", "balanced", "complex", "planning"].includes(tier)) return tier;
  throw new Error(`${field} must be one of: simple, balanced, complex, planning`);
}
