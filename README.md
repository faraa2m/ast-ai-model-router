# AST AI Model Router

AST-aware model selection for Claude Code and Codex. It inspects the current task, JavaScript/TypeScript ASTs, Python ASTs, and repo shape, then launches the coding agent with a dynamically chosen model.

This project is part of the [`faraa2m`](https://github.com/faraa2m) token economics stack:

- [`tokenometer`](https://github.com/faraa2m/tokenometer) measures tokens, USD cost, latency, and CI prompt-cost regressions.
- [`llm-tokens-atlas`](https://github.com/faraa2m/llm-tokens-atlas) calibrates offline tokenizers against empirical provider counts.
- [`routerlab`](https://github.com/faraa2m/routerlab) builds cost-quality routing frontiers for LLM APIs.
- [`promptc`](https://github.com/faraa2m/promptc) compiles prompts through deterministic cost-reduction passes.
- `ast-ai-model-router` brings that cost-aware routing idea into local coding agents.

## Install

```bash
npm install -g ast-ai-model-router
```

For local development:

```bash
npm install
npm link
```

## Usage

Analyze a task without launching an agent:

```bash
ast-ai-model-router analyze --agent codex --task "refactor the auth parser and add tests"
```

Launch Codex with the selected model:

```bash
ast-ai-model-router run codex --task "fix the failing Python AST tests" -- --cd .
```

Launch Claude Code with the selected alias:

```bash
ast-ai-model-router run claude --task "plan a cross-module migration" -- --permission-mode plan
```

Machine-readable output:

```bash
ast-ai-model-router analyze --agent codex --task "write docs" --json
```

## How Routing Works

The router scores four groups of signals:

- Prompt intent: docs, tests, debugging, refactors, architecture, security, migrations.
- Repo shape: file count, AST file count, package/build/config files.
- AST complexity: functions, classes, branches, imports, and language mix.
- Agent model catalog: Codex models are discovered through `codex debug models`; Claude uses dynamic aliases.

Claude targets are intentionally aliases, not dated model names:

- `simple` -> `haiku`
- `balanced` -> `sonnet`
- `complex` -> `opus`
- `planning` -> `opusplan`

Codex targets are selected from the installed Codex model catalog. If discovery fails, the router falls back to configurable defaults in `model-router.config.json`.

## Configuration

Add `model-router.config.json` to a project root:

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
    "discoveryCommand": "codex debug models"
  }
}
```

## Plugin

This repo includes a Codex/Claude plugin manifest at `.codex-plugin/plugin.json` and a skill under `skills/model-router/`.

Use it directly while developing:

```bash
claude --plugin-dir .
codex plugin marketplace add .
```

## Privacy

The router reads local source files to compute AST complexity and launches the local `claude` or `codex` CLI. It does not add a separate network service. Any model traffic comes from the Claude/Codex CLI you choose to run.

## License

MIT
