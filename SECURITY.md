# Security Policy

## Supported versions

Security fixes are applied to the latest published version of
`@ast-ai-model-router/cli`.

## Reporting a vulnerability

Please report suspected vulnerabilities through GitHub's private vulnerability
reporting flow for this repository, or email the maintainer listed in
`package.json` if GitHub reporting is unavailable.

Do not open a public issue for vulnerabilities that could expose user source
code, credentials, or CI policy bypasses.

## Security model

AST AI Model Router reads local repository files to score task complexity and
can launch local Claude Code or Codex commands. It does not run a hosted
service and does not upload source code itself. Network calls, if any, come from
the coding-agent CLI the user explicitly launches.
