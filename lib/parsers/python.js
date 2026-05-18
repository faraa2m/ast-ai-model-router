import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export async function analyzePythonFile(file) {
  try {
    const script = path.resolve(new URL("../../../scripts/python_ast_summary.py", import.meta.url).pathname);
    const { stdout } = await execFileAsync("python3", [script, file], { timeout: 5000 });
    return { ok: true, language: "python", ...JSON.parse(stdout) };
  } catch (error) {
    return { ok: false, file, error: error.message };
  }
}
