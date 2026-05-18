import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function chooseModel({ agent, tier, config, refreshModels }) {
  if (agent === "claude") {
    return { model: config.claude.aliases[tier] ?? config.claude.aliases.balanced, source: "claude-alias" };
  }
  const catalog = await loadCodexCatalog(config, refreshModels);
  const selected = selectCodexModel(catalog, tier) ?? config.codex.fallbackModels[tier] ?? config.codex.fallbackModels.balanced;
  return { model: selected, source: catalog.length ? "codex-debug-models" : "fallback" };
}

async function loadCodexCatalog(config) {
  const [command, ...args] = config.codex.discoveryCommand.split(/\s+/);
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 5000, maxBuffer: 1024 * 1024 * 6 });
    const line = stdout.trim().split("\n").find((item) => item.trim().startsWith("{"));
    const parsed = JSON.parse(line);
    return Array.isArray(parsed.models) ? parsed.models.filter((model) => model.visibility !== "hidden") : [];
  } catch {
    return [];
  }
}

function selectCodexModel(models, tier) {
  if (!models.length) return null;
  const visible = models.map((model) => ({
    slug: model.slug,
    text: `${model.slug} ${model.display_name ?? ""} ${model.description ?? ""}`.toLowerCase(),
    priority: Number.isFinite(model.priority) ? model.priority : 1000,
    context: model.context_window ?? 0
  }));
  if (tier === "simple") return best(visible, [/mini|small|fast|efficient/], [/frontier|complex/]);
  if (tier === "balanced") return best(visible, [/gpt-5\.4$|balanced|coding|everyday/], [/mini/]);
  return best(visible, [/gpt-5\.5|frontier|complex|real-world|large/], [/mini|small/]);
}

function best(models, positive, negative) {
  return models
    .map((model) => {
      let score = 1000 - model.priority;
      for (const regex of positive) if (regex.test(model.text)) score += 100;
      for (const regex of negative) if (regex.test(model.text)) score -= 80;
      score += Math.min(50, model.context / 20000);
      return { ...model, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.slug ?? null;
}
