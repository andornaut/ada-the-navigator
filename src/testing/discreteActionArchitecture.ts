import ts from "typescript";

export interface ActionBindingFinding {
  readonly kind:
    | "raw-discrete"
    | "gesture-review"
    | "unresolved-event"
    | "legacy-root"
    | "unbound-discrete"
    | "non-action";
  readonly classification?: "suppressor" | "drag-state" | "editing-state" | "unclassified";
  readonly evidence?: string;
  readonly line: number;
  readonly path: string;
  readonly source: string;
}

/** Reports bypasses without grandfathering existing consumer files. */
export function scanDiscreteActionBindings(path: string, text: string): ActionBindingFinding[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
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
      const declared = declaration(node);
      const value =
        declared && ts.isVariableDeclaration(declared)
          ? (declared.initializer ??
            (ts.isForOfStatement(declared.parent.parent)
              ? declared.parent.parent.expression
              : undefined))
          : undefined;
      if (value) {
        return strings(value, new Set([...seen, node.text]));
      }
    }
    return [];
  };
  const declarations: ts.NamedDeclaration[] = [];
  const index = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isBindingElement(node) ||
      ts.isParameter(node) ||
      ts.isFunctionDeclaration(node)
    ) {
      declarations.push(node);
    }
    ts.forEachChild(node, index);
  };
  index(source);
  const scope = (node: ts.Node): ts.Node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (
        ts.isBlock(parent) ||
        ts.isForOfStatement(parent) ||
        ts.isForInStatement(parent) ||
        ts.isForStatement(parent) ||
        ts.isFunctionLike(parent) ||
        ts.isSourceFile(parent)
      ) {
        return parent;
      }
    }
    return source;
  };
  const declaration = (node: ts.Identifier): ts.NamedDeclaration | undefined => {
    for (let at: ts.Node | undefined = node; at; at = at.parent) {
      const found = declarations.find(
        (entry) =>
          entry.name &&
          ts.isIdentifier(entry.name) &&
          entry.name.text === node.text &&
          (scope(entry) === at || (ts.isParameter(entry) && entry.parent === at)),
      );
      if (found) {
        return found;
      }
    }
    return undefined;
  };
  const reference = (node: ts.Expression): string => {
    if (
      ts.isAsExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      return reference(node.expression);
    }
    if (ts.isIdentifier(node)) {
      return `${declaration(node)?.pos ?? `external@${scope(node).pos}`}:${node.text}`;
    }
    if (ts.isPropertyAccessExpression(node)) {
      return `${reference(node.expression)}.${node.name.text}`;
    }
    return `expression:${node.pos}`;
  };
  const bound = new Set<string>();
  const wrappers = new Map<string, Set<number>>();
  const collectBindings = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "bindAdaAction" &&
      node.arguments[1]
    ) {
      bound.add(reference(node.arguments[1]));
      for (let owner: ts.Node | undefined = node.parent; owner; owner = owner.parent) {
        if (
          !ts.isArrowFunction(owner) &&
          !ts.isFunctionExpression(owner) &&
          !ts.isFunctionDeclaration(owner)
        ) {
          continue;
        }
        const position = owner.parameters.findIndex(
          (parameter) =>
            ts.isIdentifier(parameter.name) &&
            ts.isIdentifier(node.arguments[1]!) &&
            reference(parameter.name) === reference(node.arguments[1]!),
        );
        const name = ts.isFunctionDeclaration(owner)
          ? owner.name
          : ts.isVariableDeclaration(owner.parent)
            ? owner.parent.name
            : undefined;
        if (position >= 0 && name && ts.isIdentifier(name)) {
          const ports = wrappers.get(reference(name)) ?? new Set<number>();
          ports.add(position);
          wrappers.set(reference(name), ports);
        }
        break;
      }
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(source);
  const collectWrapperCalls = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      for (const position of wrappers.get(reference(node.expression)) ?? []) {
        const argument = node.arguments[position];
        if (argument) {
          bound.add(reference(argument));
        }
      }
    }
    ts.forEachChild(node, collectWrapperCalls);
  };
  collectWrapperCalls(source);
  // These categories prove only local callback effects. Unresolved helper calls stay reviewable.
  const callbackFacts = (argument: ts.Expression | undefined) => {
    const declared = argument && ts.isIdentifier(argument) ? declaration(argument) : undefined;
    const callback =
      argument && ts.isIdentifier(argument)
        ? declared && ts.isFunctionDeclaration(declared)
          ? declared
          : declared && ts.isVariableDeclaration(declared)
            ? declared.initializer
            : undefined
        : argument;
    if (
      !callback ||
      (!ts.isArrowFunction(callback) &&
        !ts.isFunctionExpression(callback) &&
        !ts.isFunctionDeclaration(callback)) ||
      !callback.body
    ) {
      return undefined;
    }
    let writesOuter = false;
    let unknown = false,
      suppression = false,
      coordinates = false,
      editing = false;
    const inspect = (node: ts.Node): void => {
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        if (!ts.isIdentifier(node.left)) {
          unknown = true;
        } else {
          const target = declaration(node.left);
          if (!target || target.pos < callback.pos || target.end > callback.end) {
            writesOuter = true;
          }
        }
      }
      if (
        ts.isNewExpression(node) ||
        ts.isPostfixUnaryExpression(node) ||
        ts.isDeleteExpression(node) ||
        ts.isAwaitExpression(node)
      ) {
        unknown = true;
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (
          ts.isPropertyAccessExpression(callee) &&
          ["preventDefault", "stopPropagation", "stopImmediatePropagation"].includes(
            callee.name.text,
          ) &&
          callback.parameters.some(
            (parameter) =>
              ts.isIdentifier(parameter.name) &&
              reference(parameter.name) === reference(callee.expression),
          )
        ) {
          suppression = true;
        } else {
          unknown = true;
        }
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        callback.parameters.some(
          (parameter) =>
            ts.isIdentifier(parameter.name) &&
            reference(parameter.name) === reference(node.expression),
        )
      ) {
        if (
          ["clientX", "clientY", "pageX", "pageY", "movementX", "movementY"].includes(
            node.name.text,
          )
        ) {
          coordinates = true;
        }
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "value" &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "target" &&
        callback.parameters.some(
          (parameter) =>
            ts.isIdentifier(parameter.name) &&
            reference(parameter.name) ===
              reference((node.expression as ts.PropertyAccessExpression).expression),
        )
      ) {
        editing = true;
      }
      // Nested callbacks and dynamic calls must not disappear behind a non-action classification.
      if (node !== callback && (ts.isArrowFunction(node) || ts.isFunctionExpression(node))) {
        unknown = true;
      }
      ts.forEachChild(node, inspect);
    };
    inspect(callback.body);
    return { coordinates, editing, suppression, unknown, writesOuter };
  };
  const findings: ActionBindingFinding[] = [];
  const record = (
    kind: ActionBindingFinding["kind"],
    node: ts.Node,
    classification?: ActionBindingFinding["classification"],
    evidence?: string,
  ) => {
    findings.push({
      kind,
      ...(classification ? { classification } : {}),
      ...(evidence ? { evidence } : {}),
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      path,
      source: node.getText(source),
    });
  };
  const nativeBridge = (node: ts.Node) => {
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
      if (ts.isIdentifier(callee) && callee.text === "bindAdaHoldActions") {
        record("legacy-root", node);
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ["addEventListener", "on", "addListener"].includes(callee.name.text)
      ) {
        const event = node.arguments[0];
        const names = event ? strings(event) : [];
        const facts = callbackFacts(node.arguments[1]);
        const discrete = names.some((name) => ["click", "dblclick"].includes(name));
        const pointer = names.some((name) =>
          /^(pointer|touch|mouse|wheel|keydown|keyup)/.test(name),
        );
        const editing = names.some((name) => ["input", "change", "beforeinput"].includes(name));
        if (
          (discrete || pointer || editing) &&
          facts &&
          !facts.unknown &&
          facts.suppression &&
          !facts.writesOuter &&
          !facts.coordinates &&
          !facts.editing
        ) {
          record(
            "non-action",
            node,
            "suppressor",
            "Only event suppression and local statements; no action/helper call",
          );
        } else if (discrete) {
          if (!nativeBridge(node)) {
            record("raw-discrete", node);
          }
        } else if (pointer) {
          record(
            "gesture-review",
            node,
            facts && !facts.unknown && facts.coordinates ? "drag-state" : "unclassified",
            "Pointer callbacks remain blocking until their state/effects and discrete release paths are resolved",
          );
        } else if (editing) {
          record(
            facts && !facts.unknown && facts.editing ? "non-action" : "unresolved-event",
            node,
            facts && !facts.unknown && facts.editing ? "editing-state" : "unclassified",
          );
        } else if (!names.length) {
          record("unresolved-event", node);
        }
      }
      const createsButton =
        (ts.isIdentifier(callee) && callee.text === "createButton") ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === "createButton") ||
        (ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "createElement" &&
          node.arguments[0] &&
          strings(node.arguments[0]).includes("button"));
      if (createsButton) {
        const target =
          ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)
            ? node.parent.name
            : node;
        if (!bound.has(reference(target))) {
          record(
            "unbound-discrete",
            node,
            "unclassified",
            "Native button lacks local binding proof; factory/cross-module association needs review",
          );
        }
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "setAttribute" &&
        node.arguments[0] &&
        node.arguments[1] &&
        strings(node.arguments[0]).includes("role") &&
        strings(node.arguments[1]).includes("button") &&
        !bound.has(reference(callee.expression))
      ) {
        record(
          "unbound-discrete",
          node,
          "unclassified",
          "Role-button has no local canonical binding proof",
        );
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "setAttribute" &&
        node.arguments[0] &&
        node.arguments[1] &&
        !bound.has(reference(callee.expression))
      ) {
        const names = strings(node.arguments[0]);
        const values = strings(node.arguments[1]);
        if (
          names.includes("data-action") ||
          (names.includes("type") &&
            values.some((value) => ["button", "submit", "reset"].includes(value)))
        ) {
          record(
            "unbound-discrete",
            node,
            "unclassified",
            "Action-bearing attribute lacks local binding proof",
          );
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
      if (ts.isPropertyAccessExpression(node.left)) {
        const left = node.left;
        const isActionType =
          left.name.text === "type" &&
          strings(node.right).some((value) => ["button", "submit", "reset"].includes(value));
        const isActionId =
          left.name.text === "action" &&
          ts.isPropertyAccessExpression(left.expression) &&
          left.expression.name.text === "dataset";
        const target =
          isActionId && ts.isPropertyAccessExpression(left.expression)
            ? left.expression.expression
            : left.expression;
        if ((isActionType || isActionId) && !bound.has(reference(target))) {
          record(
            "unbound-discrete",
            node,
            "unclassified",
            "Action-bearing property lacks local binding proof",
          );
        }
      }
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
