import { spawn } from "node:child_process";

export function buildAgentCommand({ agent, model, prompt, passthrough = [] }) {
  if (agent === "claude") {
    return {
      command: "claude",
      args: ["--print", "--model", model, ...passthrough, prompt]
    };
  }
  if (agent === "codex") {
    return {
      command: "codex",
      args: ["exec", "--model", model, ...passthrough, prompt]
    };
  }
  throw new Error("Expected agent to be 'claude' or 'codex'.");
}

export function formatAgentCommand(request) {
  const { command, args } = buildAgentCommand(request);
  return `${command} ${args.map(shellQuote).join(" ")}`;
}

export async function executeAgent({ agent, model, prompt, cwd, passthrough = [] }) {
  const { command, args } = buildAgentCommand({ agent, model, prompt, passthrough });
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ exitCode: 1, stdout, stderr, error });
    });
    child.on("exit", (code, signal) => {
      resolve({ exitCode: code ?? 1, signal, stdout, stderr });
    });
  });
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}
