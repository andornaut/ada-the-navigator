import ts from "typescript";

export interface ActionBindingFinding {
  readonly kind: "raw-discrete" | "gesture-review" | "unresolved-event" | "legacy-root";
  readonly line: number;
  readonly path: string;
  readonly source: string;
}

/** Reports bypasses without grandfathering existing consumer files. */
export function scanDiscreteActionBindings(path: string, text: string): ActionBindingFinding[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const constants = new Map<string, ts.Expression>();
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      constants.set(node.name.text, node.initializer);
    }
    if (ts.isForOfStatement(node) && ts.isVariableDeclarationList(node.initializer)) {
      const binding = node.initializer.declarations[0];
      if (binding && ts.isIdentifier(binding.name)) {
        constants.set(binding.name.text, node.expression);
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  const strings = (node: ts.Expression, seen = new Set<string>()): string[] => {
    if (ts.isStringLiteralLike(node)) {
      return [node.text];
    }
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) {
      return strings(node.expression, seen);
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.flatMap((item) => strings(item, seen));
    }
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      const value = constants.get(node.text);
      if (value) {
        return strings(value, new Set([...seen, node.text]));
      }
    }
    return [];
  };
  const findings: ActionBindingFinding[] = [];
  const record = (kind: ActionBindingFinding["kind"], node: ts.Node) => {
    findings.push({
      kind,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      path,
      source: node.getText(source),
    });
  };
  const nativeBridge = (node: ts.Node) => {
    if (path !== "src/ui/actionBinding.ts") {
      return false;
    }
    for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
      if (ts.isFunctionDeclaration(parent)) {
        return parent.name?.text === "bindAdaAction";
      }
    }
    return false;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        ts.isIdentifier(callee) &&
        callee.text === "bindAdaHoldActions" &&
        path !== "src/ui/holdActionsAdapter.ts"
      ) {
        record("legacy-root", node);
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ["addEventListener", "on", "addListener"].includes(callee.name.text)
      ) {
        const event = node.arguments[0];
        const names = event ? strings(event) : [];
        if (names.some((name) => ["click", "dblclick"].includes(name))) {
          if (!nativeBridge(node)) {
            record("raw-discrete", node);
          }
        } else if (names.some((name) => /^pointer|^touch|^mouse/.test(name))) {
          record("gesture-review", node);
        } else if (!names.length) {
          record("unresolved-event", node);
        }
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "setAttribute" &&
        node.arguments[0] &&
        strings(node.arguments[0]).some((name) => /^on(?:click|dblclick)$/i.test(name))
      ) {
        record("raw-discrete", node);
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const name = ts.isPropertyAccessExpression(node.left)
        ? node.left.name.text
        : ts.isElementAccessExpression(node.left) && node.left.argumentExpression
          ? strings(node.left.argumentExpression)[0]
          : undefined;
      if (name && /^on(?:click|dblclick)$/i.test(name)) {
        record("raw-discrete", node);
      }
    }
    if (
      ts.isPropertyAssignment(node) &&
      /^on(?:click|dblclick)$/i.test(node.name.getText(source).replaceAll(/['"]/g, ""))
    ) {
      record("raw-discrete", node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}
