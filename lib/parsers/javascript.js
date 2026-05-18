import { readFile } from "node:fs/promises";
import { parse } from "@babel/parser";

export async function analyzeJavaScriptFile(file) {
  try {
    const source = await readFile(file, "utf8");
    const ast = parse(source, {
      sourceType: "unambiguous",
      plugins: ["typescript", "jsx", "decorators-legacy", "classProperties", "dynamicImport"]
    });
    const summary = { ok: true, language: "javascript", functions: 0, classes: 0, branches: 0, imports: 0 };
    walk(ast, (node) => {
      if (!node || typeof node.type !== "string") return;
      if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "ObjectMethod", "ClassMethod"].includes(node.type)) summary.functions += 1;
      if (["ClassDeclaration", "ClassExpression"].includes(node.type)) summary.classes += 1;
      if (["IfStatement", "ConditionalExpression", "ForStatement", "ForOfStatement", "ForInStatement", "WhileStatement", "DoWhileStatement", "SwitchCase", "TryStatement"].includes(node.type)) summary.branches += 1;
      if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration", "CallExpression"].includes(node.type)) {
        if (node.type !== "CallExpression" || node.callee?.name === "require") summary.imports += 1;
      }
    });
    return summary;
  } catch (error) {
    return { ok: false, file, error: error.message };
  }
}

function walk(value, visit) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  visit(value);
  for (const [key, child] of Object.entries(value)) {
    if (key === "loc" || key === "start" || key === "end") continue;
    walk(child, visit);
  }
}
