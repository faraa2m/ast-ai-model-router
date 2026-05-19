---
name: model-router
description: Use AST AI Model Router to choose an appropriate Claude Code or Codex model from task, code complexity, token-cost, and policy signals before launching or recommending an agent command.
---

# Model Router

Use this skill when the user wants cost-aware model selection for a coding task.

## Workflow

1. Run an analysis command from the project root:

```bash
ast-ai-model-router analyze --agent codex --task "<task>"
```

or:

```bash
ast-ai-model-router analyze --agent claude --task "<task>"
```

2. When the user needs rationale, use:

```bash
ast-ai-model-router explain --agent codex --task "<task>"
```

3. For CI or production policy checks, use:

```bash
ast-ai-model-router ci --agent codex --task "<task>" --max-tier complex
```

4. If the user wants execution, launch through the wrapper:

```bash
ast-ai-model-router run codex --task "<task>" -- <codex args>
```

```bash
ast-ai-model-router run claude --task "<task>" -- <claude args>
```

5. If the user wants every new prompt routed independently, use the gateway:

```bash
ast-ai-model-router gateway codex -- <codex args>
```

```bash
ast-ai-model-router gateway claude -- <claude args>
```

For a single routed turn:

```bash
ast-ai-model-router gateway codex --once --task "<task>" -- <codex args>
```

6. Explain the selected model in token-economics terms: simple tasks should use faster/cheaper models; complex migrations, security-sensitive work, and architecture planning should use stronger models.

## Notes

- Codex model names are discovered dynamically from `codex debug models`.
- Claude model names use aliases: `haiku`, `sonnet`, `opus`, and `opusplan`.
- Token-cost estimates use Tokenometer when a selected model maps cleanly to a known provider model.
- The router analyzes JavaScript/TypeScript with Babel ASTs and Python with stdlib `ast`.
- Gateway mode routes prompts entered through `ast-ai-model-router gateway`; it does not invisibly intercept an already-running Claude Code or Codex TUI.
