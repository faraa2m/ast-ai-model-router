# Contributing

Thanks for taking the time to improve AST AI Model Router. This project is a
local-first developer tool, so changes should keep routing decisions
deterministic, explainable, and safe to run in CI.

## Development

```bash
npm ci
npm run lint
npm test
```

Use `npm run pack:dry-run` before release-facing changes to verify the package
contents.

## Pull requests

- Keep pull requests focused on one behavior or documentation improvement.
- Add or update tests when routing behavior, policy checks, or CLI output
  changes.
- Document user-visible changes in `README.md` or `CHANGELOG.md` when relevant.
- Add a Changeset for release-worthy changes.

## Routing changes

Routing rules should prefer clear signals over opaque heuristics. If a change
adds a new signal, include the rationale in the test fixture or docs so users
can understand why a model tier was selected.
