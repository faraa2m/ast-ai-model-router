#!/usr/bin/env python3
import ast
import json
import sys


class Counter(ast.NodeVisitor):
    def __init__(self):
        self.functions = 0
        self.classes = 0
        self.branches = 0
        self.imports = 0

    def visit_FunctionDef(self, node):
        self.functions += 1
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):
        self.functions += 1
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        self.classes += 1
        self.generic_visit(node)

    def visit_If(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_For(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_AsyncFor(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_While(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_Try(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_Import(self, node):
        self.imports += len(node.names)

    def visit_ImportFrom(self, node):
        self.imports += len(node.names)


def main():
    with open(sys.argv[1], "r", encoding="utf-8") as handle:
        tree = ast.parse(handle.read(), filename=sys.argv[1])
    counter = Counter()
    counter.visit(tree)
    print(json.dumps(counter.__dict__))


if __name__ == "__main__":
    main()
