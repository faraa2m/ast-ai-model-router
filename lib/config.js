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
    overrides: override.overrides ?? base.overrides
  };
}
