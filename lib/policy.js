export const TIER_ORDER = {
  simple: 0,
  balanced: 1,
  complex: 2,
  planning: 3
};

export function evaluatePolicy({ tier, costEstimate, config, maxTier, maxCostUsd }) {
  const effectiveMaxTier = maxTier ?? config.policy?.maxTier ?? "planning";
  const effectiveMaxCostUsd = maxCostUsd ?? config.policy?.maxCostUsd ?? null;
  const failures = [];
  if (TIER_ORDER[tier] > TIER_ORDER[effectiveMaxTier]) {
    failures.push(`tier ${tier} exceeds max tier ${effectiveMaxTier}`);
  }
  if (
    effectiveMaxCostUsd !== null &&
    effectiveMaxCostUsd !== undefined &&
    costEstimate?.available &&
    costEstimate.inputCostUsd > Number(effectiveMaxCostUsd)
  ) {
    failures.push(`estimated cost ${formatUsd(costEstimate.inputCostUsd)} exceeds max cost ${formatUsd(Number(effectiveMaxCostUsd))}`);
  }
  return {
    passed: failures.length === 0,
    failures,
    maxTier: effectiveMaxTier,
    maxCostUsd: effectiveMaxCostUsd
  };
}

export function formatUsd(value) {
  if (!Number.isFinite(value)) return "unavailable";
  if (value === 0) return "$0.000000";
  return `$${value.toFixed(6)}`;
}
