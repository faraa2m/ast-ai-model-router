# AST AI Model Router

[![npm](https://img.shields.io/npm/v/@ast-ai-model-router/cli.svg?label=%40ast-ai-model-router%2Fcli)](https://www.npmjs.com/package/@ast-ai-model-router/cli)
[![CI](https://github.com/faraa2m/ast-ai-model-router/actions/workflows/ci.yml/badge.svg)](https://github.com/faraa2m/ast-ai-model-router/actions/workflows/ci.yml)
[![npm smoke](https://github.com/faraa2m/ast-ai-model-router/actions/workflows/npm-smoke.yml/badge.svg)](https://github.com/faraa2m/ast-ai-model-router/actions/workflows/npm-smoke.yml)
[![License: MIT](https://img.shields.io/github/license/faraa2m/ast-ai-model-router.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/faraa2m/ast-ai-model-router.svg?style=social)](https://github.com/faraa2m/ast-ai-model-router/stargazers)

AST-based Claude Code and Codex model router for developers who want explainable AI coding-agent model selection, token-cost visibility, and CI policy checks.

`ast-ai-model-router` inspects the current task, JavaScript/TypeScript ASTs, Python ASTs, and repo shape, then recommends or launches Claude Code / Codex with the right model tier. It is deterministic, local-first, and designed for both personal coding workflows and production team guardrails.

## Why Use It

- Avoid defaulting every coding-agent task to the strongest model.
- Keep simple documentation and explanation tasks on cheaper/faster models.
- Escalate refactors, migrations, security, auth, database, and architecture work.
- Get a readable rationale for every model decision.
- Add CI checks for max model tier and estimated prompt cost.
- Connect local coding-agent routing to the same token-economics stack as Tokenometer and RouterLab.

## Install

```bash
npm install -g @ast-ai-model-router/cli
```

Run without installing:

```bash
npx --yes --package @ast-ai-model-router/cli ast-ai-model-router --help
npx --yes @ast-ai-model-router/cli --version
```

## Quick Start

Initialize config in a repo:

```bash
ast-ai-model-router init
```

Analyze a Claude Code task:

```bash
ast-ai-model-router analyze --agent claude --task "write docs for the parser" 
```

Explain the decision:

```bash
ast-ai-model-router explain --agent codex --task "refactor auth middleware and add regression tests"
```

Preview a launch command without starting an agent:

```bash
ast-ai-model-router run codex --task "fix failing Python AST tests" --dry-run -- --cd .
```

Launch Codex with the selected model:

```bash
ast-ai-model-router run codex --task "fix failing Python AST tests" -- --cd .
```

Launch Claude Code with the selected alias:

```bash
ast-ai-model-router run claude --task "plan a cross-module database migration" -- --permission-mode plan
```

Route each prompt through a gateway session:

```bash
ast-ai-model-router gateway codex -- --sandbox workspace-write
```

Preview one gateway turn without launching an agent:

```bash
ast-ai-model-router gateway claude --once --task "write docs for this repo" --dry-run -- --permission-mode plan
```

## CI And Team Policy

Fail if a task would exceed the allowed tier:

```bash
ast-ai-model-router ci \
  --agent claude \
  --task "plan a production database migration" \
  --max-tier complex
```

Fail if Tokenometer can estimate the task prompt above your budget:

```bash
ast-ai-model-router ci \
  --agent codex \
  --task "review this large auth refactor" \
  --max-cost-usd 0.001
```

Machine-readable decision output:

```bash
ast-ai-model-router analyze --agent codex --task "write tests" --json
```

The JSON includes `selectedModel`, `tier`, `confidence`, `signals`, `rationale`, `warnings`, `costEstimate`, `policy`, and `commandPreview`.

## Per-Turn Gateway

`run` chooses one model before launching a Claude Code or Codex session. `gateway` is different: it keeps a small router prompt open, scores every message you type, then invokes the selected agent model for that turn.

```bash
ast-ai-model-router gateway claude -- --permission-mode plan
ast-ai-model-router gateway codex -- --sandbox workspace-write
```

Inside the gateway, type a prompt and press Enter. Use `/exit` or `/quit` to stop.

For single-turn automation or CI smoke tests:

```bash
ast-ai-model-router gateway codex --once --task "add regression tests for parser errors" --dry-run
```

The gateway uses non-interactive agent execution:

- Claude Code: `claude --print --model <selected-model> ... <prompt>`
- Codex: `codex exec --model <selected-model> ... <prompt>`

This is not an invisible hook inside an already-running Claude Code or Codex TUI. To route every turn, enter prompts through `ast-ai-model-router gateway ...`.

## How Routing Works

The router scores four groups of signals:

- Prompt intent: docs, tests, debugging, refactors, architecture, security, migrations.
- Repo shape: file count, AST file count, package/build/config files.
- AST complexity: functions, classes, branches, imports, and language mix.
- Agent model catalog: Codex models are discovered through `codex debug models`; Claude Code uses dynamic aliases.

Claude Code targets are aliases, not dated model names:

- `simple` -> `haiku`
- `balanced` -> `sonnet`
- `complex` -> `opus`
- `planning` -> `opusplan`

Codex targets are selected from the installed Codex model catalog. If discovery fails, the router falls back to configured defaults.

## Token-Cost Estimates

Cost estimates use [`@tokenometer/core`](https://github.com/faraa2m/tokenometer) when the selected model maps to a known provider model.

Examples:

- Claude alias `haiku` maps to `claude-haiku-4-5`.
- Claude alias `sonnet` maps to `claude-sonnet-4-6`.
- Codex `gpt-5.4-mini` maps to Tokenometer model `gpt-5-mini`.

If a model cannot be mapped, routing still works and the decision includes a warning:

```text
Cost estimate unavailable: No Tokenometer model mapping for codex model "..."
```

Cost estimates are for the task prompt text, not source-file contents. This keeps the tool privacy-preserving and fast by default.

## Configuration

`ast-ai-model-router init` writes `model-router.config.json`:

```json
{
  "thresholds": {
    "simpleMax": 34,
    "balancedMax": 74
  },
  "claude": {
    "aliases": {
      "simple": "haiku",
      "balanced": "sonnet",
      "complex": "opus",
      "planning": "opusplan"
    }
  },
  "codex": {
    "discoveryCommand": "codex debug models",
    "fallbackModels": {
      "simple": "gpt-5.4-mini",
      "balanced": "gpt-5.4",
      "complex": "gpt-5.5",
      "planning": "gpt-5.5"
    }
  },
  "policy": {
    "maxTier": "planning",
    "maxCostUsd": null
  },
  "logging": {
    "enabled": false,
    "path": ".model-router/decisions.jsonl"
  }
}
```

Decision logging is disabled by default. When enabled with config or `--log`, logs store model decisions and scores, not source code.

## Exit Codes

- `0`: success
- `1`: runtime failure
- `2`: invalid input or config
- `3`: policy failure

## Plugin Support

This repo includes:

- `.codex-plugin/plugin.json`
- `.claude-plugin/plugin.json`
- `skills/model-router/SKILL.md`

Use the plugin locally:

```bash
claude --plugin-dir .
codex plugin marketplace add .
```

## Token Economics Stack

This project is part of the [`faraa2m`](https://github.com/faraa2m) token-economics ecosystem:

- [`tokenometer`](https://github.com/faraa2m/tokenometer): token counts, USD cost, latency benchmarks, and CI prompt-cost guardrails.
- [`llm-tokens-atlas`](https://github.com/faraa2m/llm-tokens-atlas): empirical tokenizer calibration dataset.
- [`routerlab`](https://github.com/faraa2m/routerlab): cost-quality routing frontiers for LLM APIs.
- [`promptc`](https://github.com/faraa2m/promptc): deterministic prompt compiler for cost reduction.
- `ast-ai-model-router`: model routing for local coding agents.

## Privacy

The router reads local source files to compute AST complexity and launches the local `claude` or `codex` CLI. It does not run a separate network service and does not upload source code. Any model traffic comes from the Claude Code or Codex CLI you choose to run.

## Project Health

- [Contributing guide](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Changelog](./CHANGELOG.md)

## Status

This is an explainable heuristic router. It is production-usable for policy and workflow guardrails, but it does not claim empirically proven model-quality optimization yet. Future releases can add outcome logging and calibration against real task success.

## License

MIT
