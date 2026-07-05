# @ast-ai-model-router/cli

## 2.0.3

### Patch Changes

- f6486c7: Map current Codex defaults to concrete Tokenometer model IDs.

  Updates the default Codex cost mappings for `gpt-5.4-mini`, `gpt-5.4`, and `gpt-5.5`, and raises the Tokenometer dependency range so those IDs can resolve after the refreshed Tokenometer release is published.

## 2.0.2

### Patch Changes

- bba00dc: Add `version`, `--version`, and `-v` commands for reliable npx smoke checks.

## 2.0.1

### Patch Changes

- 9c80beb: Polish the repository's open-source project documentation and contributor guidance.

## 2.0.0

### Major Changes

- 4c000b9: Require Node.js 26 and run CI, release, and smoke workflows on Node 26.

## 1.1.0

### Minor Changes

- 73b45ff: Add a per-turn gateway command for routing each Claude Code or Codex prompt through the model router before non-interactive agent execution.

## 1.0.0

### Major Changes

- 5607293: Add v1 utility features: explainable routing, Tokenometer-backed cost estimates, init/explain/ci commands, policy checks, richer JSON output, plugin metadata sync, and production-oriented documentation.

## 0.1.1

### Patch Changes

- 32a6608: Initial public release of the AST-aware Claude and Codex model router.
