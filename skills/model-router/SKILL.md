---
name: model-router
description: Use AST AI Model Router to choose an appropriate Claude or Codex model from task and code complexity before launching or recommending an agent command.
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

2. If the user wants execution, launch through the wrapper:

```bash
ast-ai-model-router run codex --task "<task>" -- <codex args>
```

```bash
ast-ai-model-router run claude --task "<task>" -- <claude args>
```

3. Explain the selected model in token-economics terms: simple tasks should use faster/cheaper models; complex migrations, security-sensitive work, and architecture planning should use stronger models.

## Notes

- Codex model names are discovered dynamically from `codex debug models`.
- Claude model names use aliases: `haiku`, `sonnet`, `opus`, and `opusplan`.
- The router analyzes JavaScript/TypeScript with Babel ASTs and Python with stdlib `ast`.
