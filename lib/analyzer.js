import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { analyzeJavaScriptFile } from "./parsers/javascript.js";
import { analyzePythonFile } from "./parsers/python.js";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".venv", "venv", "__pycache__", "coverage"]);
const JS_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const PY_EXTENSIONS = new Set([".py"]);

export async function analyzeTask({ cwd, task, config }) {
  const root = path.resolve(cwd);
  const files = await collectFiles(root);
  const astFiles = files.filter((file) => JS_EXTENSIONS.has(path.extname(file)) || PY_EXTENSIONS.has(path.extname(file))).slice(0, 80);
  const ast = await summarizeAst(astFiles);
  const prompt = scorePrompt(task);
  const repo = scoreRepo(files, astFiles);
  const score = prompt.score + repo.score + ast.score;
  const tier = tierFor(score, task, config);
  const signals = [
    { name: "prompt", value: prompt.score, detail: prompt.matches.join(",") || "none" },
    { name: "repo", value: repo.score, detail: `${files.length} files, ${astFiles.length} AST files` },
    { name: "ast", value: ast.score, detail: `${ast.functions} functions, ${ast.classes} classes, ${ast.branches} branches` },
    { name: "languages", value: ast.languages.size, detail: [...ast.languages].join(",") || "none" }
  ];
  return {
    cwd: root,
    tier,
    confidence: confidenceFor(score, tier, config),
    score,
    signals
  };
}

async function collectFiles(root, relative = "") {
  let entries;
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) files.push(...await collectFiles(root, child));
      continue;
    }
    if (entry.isFile()) files.push(path.join(root, child));
  }
  return files;
}

async function summarizeAst(files) {
  const total = { score: 0, functions: 0, classes: 0, branches: 0, imports: 0, languages: new Set() };
  for (const file of files) {
    const ext = path.extname(file);
    const summary = PY_EXTENSIONS.has(ext) ? await analyzePythonFile(file) : await analyzeJavaScriptFile(file);
    if (!summary.ok) continue;
    total.functions += summary.functions;
    total.classes += summary.classes;
    total.branches += summary.branches;
    total.imports += summary.imports;
    total.languages.add(summary.language);
  }
  total.score = Math.min(45, total.functions * 0.45 + total.classes * 1.5 + total.branches * 0.7 + total.imports * 0.15 + total.languages.size * 4);
  return total;
}

function scorePrompt(task) {
  const text = task.toLowerCase();
  const patterns = [
    [/architecture|design|migration|refactor|rewrite|multi-file|cross-module/g, 18],
    [/security|auth|database|billing|payment|production|deploy/g, 16],
    [/debug|bug|failing|regression|race|performance/g, 12],
    [/test|coverage|unit|integration|e2e/g, 8],
    [/explain|summarize|readme|docs|comment/g, 4]
  ];
  const matches = [];
  let score = 0;
  for (const [regex, weight] of patterns) {
    const found = text.match(regex);
    if (!found) continue;
    matches.push(...found);
    score += Math.min(weight, found.length * weight);
  }
  if (text.length > 800) score += 10;
  if (text.length > 1800) score += 10;
  return { score: Math.min(50, score), matches };
}

function scoreRepo(files, astFiles) {
  let score = 0;
  if (files.length > 100) score += 8;
  if (files.length > 500) score += 12;
  if (astFiles.length > 20) score += 8;
  if (astFiles.length > 60) score += 12;
  if (files.some((file) => /package\.json|pyproject\.toml|requirements\.txt|Dockerfile|\.github\/workflows/.test(file))) score += 8;
  return { score: Math.min(35, score) };
}

function tierFor(score, task, config) {
  if (/explain|summarize|readme|docs|comment/i.test(task) && !/architecture|migration|security|auth|database|billing|payment|production|deploy/i.test(task) && score <= config.thresholds.balancedMax) {
    return "simple";
  }
  if (/plan|architecture|migration|strategy/i.test(task) && score >= config.thresholds.simpleMax) return "planning";
  if (score <= config.thresholds.simpleMax) return "simple";
  if (score <= config.thresholds.balancedMax) return "balanced";
  return "complex";
}

function confidenceFor(score, tier, config) {
  const target = tier === "simple" ? config.thresholds.simpleMax : tier === "balanced" ? config.thresholds.balancedMax : config.thresholds.balancedMax + 30;
  const distance = Math.min(40, Math.abs(score - target));
  return Math.max(0.55, Math.min(0.95, 0.95 - (40 - distance) / 120));
}
