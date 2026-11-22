import { posix } from "node:path";

import ts from "typescript";

export interface ActionBindingFinding {
  readonly kind:
    | "raw-discrete"
    | "gesture-review"
    | "unresolved-event"
    | "legacy-root"
    | "unbound-discrete"
    | "non-action"
    | "registered-action";
  readonly classification?:
    | "suppressor"
    | "drag-state"
    | "editing-state"
    | "unclassified"
    | "keyboard-focus"
    | "registered-keyboard"
    | "continuous-state";
  readonly evidence?: string;
  readonly line: number;
  readonly path: string;
  readonly source: string;
}

export interface DiscreteActionSource {
  readonly path: string;
  readonly text: string;
}

export interface FactoryAssociation {
  readonly exportName: string;
  readonly line: number;
  readonly members: readonly string[];
  readonly path: string;
}

type RuntimeAssertionKind = "live-root" | "metadata";

interface AssertionSite {
  readonly line: number;
  readonly path: string;
  readonly source: string;
}

interface ScanContext {
  readonly assertions: ReadonlyMap<ts.FunctionDeclaration, RuntimeAssertionKind>;
  readonly actionBinding: ts.FunctionDeclaration | undefined;
  readonly lexicalDeclarations: (node: ts.Identifier) => readonly ts.Declaration[] | undefined;
  readonly factories: Map<string, ReadonlySet<string>>;
  readonly sources: ReadonlyMap<string, ts.SourceFile>;
}

function localValueImport(
  context: ScanContext,
  node: ts.Identifier,
): { readonly name: string; readonly target: ts.SourceFile } | undefined {
  const declarations = context.lexicalDeclarations(node);
  const item = declarations?.length === 1 ? declarations[0] : undefined;
  if (!item || !ts.isImportSpecifier(item)) {
    return undefined;
  }
  const clause = item.parent.parent;
  const statement = clause.parent;
  if (
    item.isTypeOnly ||
    clause.isTypeOnly ||
    !ts.isImportDeclaration(statement) ||
    !ts.isStringLiteral(statement.moduleSpecifier)
  ) {
    return undefined;
  }
  const specifier = statement.moduleSpecifier.text;
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return undefined;
  }
  const path = posix.normalize(posix.join(posix.dirname(node.getSourceFile().fileName), specifier));
  const target = context.sources.get(path);
  if (!target || target.isDeclarationFile) {
    return undefined;
  }
  return { name: item.propertyName?.text ?? item.name.text, target };
}

function importedEventLiteral(context: ScanContext, node: ts.Identifier): string | undefined {
  const imported = localValueImport(context, node);
  if (!imported) {
    return undefined;
  }
  const { name, target } = imported;
  for (const variable of target.statements) {
    if (
      !ts.isVariableStatement(variable) ||
      !(variable.declarationList.flags & ts.NodeFlags.Const) ||
      !variable.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) ||
      variable.modifiers.some(({ kind }) => kind === ts.SyntaxKind.DeclareKeyword)
    ) {
      continue;
    }
    for (const declaration of variable.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) {
        continue;
      }
      let value = declaration.initializer;
      while (value && (ts.isAsExpression(value) || ts.isParenthesizedExpression(value))) {
        value = value.expression;
      }
      return value && ts.isStringLiteralLike(value) ? value.text : undefined;
    }
  }
  return undefined;
}

/** Resolve lexical identities only within the supplied project scan. */
function localDeclarations(
  sources: ScanContext["sources"],
): NonNullable<ScanContext["lexicalDeclarations"]> {
  let checker: ts.TypeChecker | undefined;
  return (node) => {
    checker ??= ts
      .createProgram({
        host: {
          fileExists: (path) => sources.has(path),
          getCanonicalFileName: (path) => path,
          getCurrentDirectory: () => "/",
          getDefaultLibFileName: () => "",
          getNewLine: () => "\n",
          getSourceFile: (path) => sources.get(path),
          readFile: (path) => sources.get(path)?.text,
          useCaseSensitiveFileNames: () => true,
          writeFile: () => undefined,
        },
        options: { noLib: true, noResolve: true },
        rootNames: [...sources.keys()],
      })
      .getTypeChecker();
    return checker.getSymbolAtLocation(node)?.declarations;
  };
}

/** An options literal may close over the node, but evaluating it must not publish the node. */
function inertRegistrationOptions(node: ts.Expression): boolean {
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every(
      (property) =>
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
        property.name.text !== "__proto__" &&
        property.name.text !== "nativeClickOwner" &&
        inertRegistrationOptions(property.initializer),
    );
  }
  return (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  );
}

function scanContext(sources: ScanContext["sources"]): ScanContext {
  const registry = sources.get("src/ui/actionBinding.ts");
  const directExport = (name: string): ts.FunctionDeclaration | undefined => {
    const declarations = registry?.statements.filter(
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) &&
        node.name?.text === name &&
        node.body !== undefined &&
        node.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) === true &&
        !node.modifiers.some(
          ({ kind }) =>
            kind === ts.SyntaxKind.DeclareKeyword ||
            kind === ts.SyntaxKind.DefaultKeyword ||
            kind === ts.SyntaxKind.AsyncKeyword,
        ) &&
        !node.asteriskToken,
    );
    return declarations?.length === 1 ? declarations[0] : undefined;
  };
  const assertions = new Map<ts.FunctionDeclaration, RuntimeAssertionKind>();
  const live = directExport("assertAdaActionBindings");
  const metadata = directExport("assertAdaActionMetadata");
  if (live) {
    assertions.set(live, "live-root");
  }
  if (metadata) {
    assertions.set(metadata, "metadata");
  }
  return {
    actionBinding: directExport("bindAdaAction"),
    assertions,
    factories: new Map(),
    lexicalDeclarations: localDeclarations(sources),
    sources,
  };
}

function scanSource(context: ScanContext, path: string, text: string) {
  const source =
    context.sources.get(path) ?? ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const lexicalDeclaration = (node: ts.Expression): ts.Declaration | undefined => {
    const declarations = ts.isIdentifier(node) ? context.lexicalDeclarations(node) : undefined;
    return declarations?.length === 1 ? declarations[0] : undefined;
  };
  const lexicalIdentity = (node: ts.Expression, expected: ts.Declaration): boolean =>
    lexicalDeclaration(node) === expected;
  const exported = new Map<string, ts.FunctionDeclaration>();
  for (const item of [context.actionBinding, ...context.assertions.keys()]) {
    if (item?.name) {
      exported.set(item.name.text, item);
    }
  }
  const candidates = new Map(exported);
  for (const statement of source.statements) {
    const bindings = ts.isImportDeclaration(statement)
      ? statement.importClause?.namedBindings
      : undefined;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) {
        const target = exported.get(item.propertyName?.text ?? item.name.text);
        if (target) {
          candidates.set(item.name.text, target);
        }
      }
    }
  }
  const canonicalCall = (call: ts.CallExpression): ts.FunctionDeclaration | undefined => {
    const callee = call.expression;
    if (call.questionDotToken || !ts.isIdentifier(callee)) {
      return undefined;
    }
    const target = candidates.get(callee.text);
    if (!target) {
      return undefined;
    }
    if (lexicalIdentity(callee, target)) {
      return target;
    }
    const imported = localValueImport(context, callee);
    return imported?.target === target.getSourceFile() && imported.name === target.name?.text
      ? target
      : undefined;
  };
  const canonicalBindingCall = (call: ts.CallExpression): boolean =>
    context.actionBinding !== undefined &&
    call.arguments[1] !== undefined &&
    canonicalCall(call) === context.actionBinding;
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
      ts.isImportSpecifier(node) ||
      ts.isImportClause(node) ||
      ts.isNamespaceImport(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isEnumDeclaration(node) ||
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
    const functionScoped =
      ts.isVariableDeclaration(node) &&
      ts.isVariableDeclarationList(node.parent) &&
      !(node.parent.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let));
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (functionScoped && !ts.isFunctionLike(parent) && !ts.isSourceFile(parent)) {
        continue;
      }
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
  const eventNames = (event: ts.Expression): string[] => {
    let node = event;
    while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) {
      node = node.expression;
    }
    if (ts.isIdentifier(node)) {
      const item = declaration(node);
      if (item && ts.isImportSpecifier(item)) {
        const name = importedEventLiteral(context, node);
        return name === undefined ? [] : [name];
      }
    }
    return strings(event);
  };
  const reference = (node: ts.Expression, seen = new Set<ts.Node>()): string => {
    if (
      ts.isAsExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      return reference(node.expression, seen);
    }
    if (ts.isIdentifier(node)) {
      const value = declaration(node);
      if (
        value &&
        !seen.has(value) &&
        ts.isVariableDeclaration(value) &&
        value.initializer &&
        ts.isVariableDeclarationList(value.parent) &&
        value.parent.flags & ts.NodeFlags.Const &&
        (ts.isIdentifier(value.initializer) || ts.isPropertyAccessExpression(value.initializer))
      ) {
        return reference(value.initializer, new Set([...seen, value]));
      }
      return `${value?.pos ?? `external@${scope(node).pos}`}:${node.text}`;
    }
    if (ts.isPropertyAccessExpression(node)) {
      return `${reference(node.expression, seen)}.${node.name.text}`;
    }
    if (ts.isElementAccessExpression(node) && node.argumentExpression) {
      const keys = strings(node.argumentExpression);
      if (keys.length === 1) {
        return `${reference(node.expression, seen)}.${keys[0]}`;
      }
    }
    return `expression:${node.pos}`;
  };
  const phase = (node: ts.Node): ts.Node => {
    for (let at = node.parent; at; at = at.parent) {
      if (ts.isFunctionLike(at)) {
        return at;
      }
    }
    return source;
  };
  const writes = new Set<string>();
  const invalidLifetimes = new Set<string>();
  const lifecycleCalls: { readonly key: string; readonly phase: ts.Node }[] = [];
  const effects = (node: ts.Node): void => {
    let target: ts.Expression | undefined;
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      target = node.left;
    }
    if (ts.isDeleteExpression(node)) {
      target = node.expression;
    }
    if (
      ts.isPostfixUnaryExpression(node) ||
      (ts.isPrefixUnaryExpression(node) &&
        [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))
    ) {
      target = node.operand;
    }
    if (target) {
      writes.add(reference(target));
      if (ts.isElementAccessExpression(target) && !strings(target.argumentExpression).length) {
        writes.add(reference(target.expression));
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      !(node.parent.flags & ts.NodeFlags.Const) &&
      (ts.isIdentifier(node.initializer) || ts.isPropertyAccessExpression(node.initializer))
    ) {
      writes.add(reference(node.initializer));
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const key = reference(node.expression);
      if (/\.(dispose|remove)$/.test(key)) {
        lifecycleCalls.push({ key: key.replace(/\.(dispose|remove)$/, ""), phase: phase(node) });
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const callee = node.expression;
      if (["dispose", "remove"].includes(callee.name.text)) {
        lifecycleCalls.push({ key: reference(callee.expression), phase: phase(node) });
      }
      if (
        ts.isIdentifier(callee.expression) &&
        ["Object", "Reflect"].includes(callee.expression.text) &&
        ["assign", "defineProperty", "set", "setPrototypeOf"].includes(callee.name.text) &&
        node.arguments[0]
      ) {
        writes.add(reference(node.arguments[0]));
      }
    }
    ts.forEachChild(node, effects);
  };
  effects(source);
  const overlaps = (key: string, changed: string, descendants = false) =>
    key === changed ||
    key.startsWith(`${changed}.`) ||
    (descendants && changed.startsWith(`${key}.`));
  const clean = (key: string, descendants = false): boolean =>
    ![...writes, ...invalidLifetimes].some((changed) => overlaps(key, changed, descendants));
  const origin = (
    node: ts.Expression,
    seen = new Set<ts.Node>(),
  ): ts.NamedDeclaration | undefined => {
    if (!ts.isIdentifier(node)) {
      return undefined;
    }
    const value = declaration(node);
    if (
      value &&
      !seen.has(value) &&
      ts.isVariableDeclaration(value) &&
      value.initializer &&
      ts.isVariableDeclarationList(value.parent) &&
      value.parent.flags & ts.NodeFlags.Const &&
      ts.isIdentifier(value.initializer)
    ) {
      return origin(value.initializer, new Set([...seen, value]));
    }
    return value;
  };
  const stable = (node: ts.Expression, descendants = false): boolean => {
    if (!clean(reference(node), descendants)) {
      return false;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      return stable(node.expression);
    }
    if (ts.isIdentifier(node)) {
      const alias = declaration(node);
      if (
        alias &&
        ts.isVariableDeclaration(alias) &&
        alias.initializer &&
        ts.isPropertyAccessExpression(alias.initializer) &&
        !stable(alias.initializer)
      ) {
        return false;
      }
    }
    const value = origin(node);
    return Boolean(
      value &&
      (ts.isImportSpecifier(value) ||
        ts.isFunctionDeclaration(value) ||
        ts.isParameter(value) ||
        (ts.isVariableDeclaration(value) &&
          ts.isVariableDeclarationList(value.parent) &&
          value.parent.flags & ts.NodeFlags.Const)),
    );
  };
  const carries = (node: ts.Expression, key: string): boolean => {
    if (reference(node) === key) {
      return true;
    }
    if (
      ts.isAsExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      return carries(node.expression, key);
    }
    if (ts.isObjectLiteralExpression(node)) {
      return node.properties.some((property) =>
        ts.isPropertyAssignment(property)
          ? carries(property.initializer, key)
          : ts.isShorthandPropertyAssignment(property)
            ? carries(property.name, key)
            : ts.isSpreadAssignment(property)
              ? carries(property.expression, key)
              : false,
      );
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.some((element) =>
        ts.isSpreadElement(element) ? carries(element.expression, key) : carries(element, key),
      );
    }
    if (ts.isConditionalExpression(node)) {
      return carries(node.whenTrue, key) || carries(node.whenFalse, key);
    }
    return false;
  };
  const escaped = (key: string): boolean => {
    let found = false;
    const inspect = (node: ts.Node): void => {
      if (
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        node.arguments?.some((argument) => carries(argument, key))
      ) {
        found = true;
      }
      if (ts.isReturnStatement(node) && node.expression && carries(node.expression, key)) {
        found = true;
      }
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        carries(node.initializer, key) &&
        !(
          ts.isIdentifier(node.name) &&
          ts.isIdentifier(node.initializer) &&
          ts.isVariableDeclarationList(node.parent) &&
          node.parent.flags & ts.NodeFlags.Const
        )
      ) {
        found = true;
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        carries(node.right, key)
      ) {
        found = true;
      }
      ts.forEachChild(node, inspect);
    };
    inspect(source);
    return found;
  };
  const importedFactories = new Map<string, ReadonlySet<string>>();
  const focusFunctions = new Set<string>();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@andornaut/game-kit/runtime/web/ui/dom/focusModality"
    ) {
      continue;
    }
    const imports = statement.importClause?.namedBindings;
    if (imports && ts.isNamedImports(imports)) {
      for (const item of imports.elements) {
        if ((item.propertyName?.text ?? item.name.text) === "focusTarget") {
          focusFunctions.add(reference(item.name));
        }
      }
    }
  }
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith(".")
    ) {
      continue;
    }
    const importedPath = posix.normalize(
      posix.join(posix.dirname(path), statement.moduleSpecifier.text),
    );
    const imports = statement.importClause?.namedBindings;
    if (!imports || !ts.isNamedImports(imports)) {
      continue;
    }
    for (const item of imports.elements) {
      const proof = context.factories.get(
        `${importedPath}#${item.propertyName?.text ?? item.name.text}`,
      );
      if (proof) {
        importedFactories.set(reference(item.name), proof);
      }
    }
  }
  const synchronousCallable = (
    node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction,
  ): boolean =>
    !node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) &&
    !((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.asteriskToken);
  const immediateWrapperCall = (
    call: ts.CallExpression,
    owner: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.SourceFile,
  ): boolean => {
    if (!ts.isSourceFile(owner) && (!synchronousCallable(owner) || !owner.body)) {
      return false;
    }
    const body = ts.isSourceFile(owner) ? owner : owner.body!;
    const deferred = (node: ts.Node): boolean =>
      ts.isFunctionLike(node) ||
      ts.isClassLike(node) ||
      ts.isConditionalExpression(node) ||
      ts.isIfStatement(node) ||
      ts.isIterationStatement(node, false) ||
      ts.isSwitchStatement(node) ||
      ts.isTryStatement(node) ||
      ts.isAwaitExpression(node) ||
      ts.isYieldExpression(node) ||
      Boolean(node.flags & ts.NodeFlags.OptionalChain) ||
      (ts.isBinaryExpression(node) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind));
    if (!(ts.isBlock(body) || ts.isSourceFile(body)) && deferred(body)) {
      return false;
    }
    let current: ts.Node = call;
    while (current !== body && current.parent !== body) {
      if (current === owner || deferred(current) || !current.parent) {
        return false;
      }
      current = current.parent;
    }
    if (deferred(current)) {
      return false;
    }
    if (ts.isBlock(body) || ts.isSourceFile(body)) {
      const index = body.statements.findIndex((statement) => statement === current);
      if (
        index < 0 ||
        !(
          ts.isVariableStatement(current) ||
          ts.isExpressionStatement(current) ||
          ts.isReturnStatement(current)
        )
      ) {
        return false;
      }
      let exits = false;
      const inspectExit = (node: ts.Node): void => {
        if (ts.isFunctionLike(node)) {
          return;
        }
        if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) {
          exits = true;
        }
        ts.forEachChild(node, inspectExit);
      };
      for (const statement of body.statements.slice(0, index)) {
        inspectExit(statement);
      }
      if (exits) {
        return false;
      }
    }
    return true;
  };
  const factoryFor = (callee: ts.Identifier): ReadonlySet<string> | undefined => {
    if (!stable(callee)) {
      return undefined;
    }
    const value = origin(callee);
    if (value && ts.isImportSpecifier(value)) {
      return importedFactories.get(reference(callee));
    }
    return value &&
      ts.isFunctionDeclaration(value) &&
      synchronousCallable(value) &&
      value.parent === source &&
      value.name
      ? context.factories.get(`${path}#${value.name.text}`)
      : undefined;
  };
  type BindingProof = { readonly owner: ts.Node; readonly end: number };
  const bound = new Map<string, BindingProof[]>();
  const immediateInvocation = (call: ts.CallExpression): boolean => {
    const owner = phase(call);
    if (ts.isSourceFile(owner)) {
      return immediateWrapperCall(call, owner);
    }
    return (
      (ts.isFunctionDeclaration(owner) ||
        ts.isFunctionExpression(owner) ||
        ts.isArrowFunction(owner)) &&
      immediateWrapperCall(call, owner)
    );
  };
  const createsButton = (call: ts.CallExpression): boolean => {
    const callee = call.expression;
    return (
      (ts.isIdentifier(callee) && callee.text === "createButton") ||
      (ts.isPropertyAccessExpression(callee) && callee.name.text === "createButton") ||
      (ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "createElement" &&
        call.arguments[0] !== undefined &&
        strings(call.arguments[0]).includes("button"))
    );
  };
  const stagedMetadata = (node: ts.Identifier): boolean => {
    const access = node.parent;
    if (!ts.isPropertyAccessExpression(access) || access.expression !== node) {
      return false;
    }
    const name = access.name.text;
    const field = name === "dataset" ? access.parent : access;
    const assignment = field.parent;
    return (
      ts.isBinaryExpression(assignment) &&
      assignment.left === field &&
      ts.isExpressionStatement(assignment.parent) &&
      assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ((name === "dataset" &&
        ts.isPropertyAccessExpression(field) &&
        field.expression === access &&
        field.name.text === "action" &&
        ts.isStringLiteralLike(assignment.right)) ||
        (["type", "className", "title"].includes(name) &&
          ts.isStringLiteralLike(assignment.right)) ||
        (["hidden", "disabled"].includes(name) &&
          (assignment.right.kind === ts.SyntaxKind.TrueKeyword ||
            assignment.right.kind === ts.SyntaxKind.FalseKeyword)))
    );
  };
  // Any opaque use of the fresh node may publish it, even on a path which throws.
  const privateUntilBinding = (
    control: ts.VariableDeclaration | ts.ParameterDeclaration,
    target: ts.Expression,
    call: ts.CallExpression,
  ): boolean => {
    if (!ts.isIdentifier(control.name)) {
      return false;
    }
    const owner = phase(call);
    const options = canonicalBindingCall(call) ? call.arguments[0] : undefined;
    const inert = options && inertRegistrationOptions(options) ? options : undefined;
    const name = control.name.text;
    const mentionsBeforeBind = (node: ts.Node, hoisted = false): boolean => {
      if (node === target || node === inert || node === control.name) {
        return false;
      }
      // A declaration below the call can still be invoked before it.
      const mayRunEarly = hoisted || (node !== owner && ts.isFunctionDeclaration(node));
      if (!mayRunEarly && node.pos >= call.end) {
        return false;
      }
      if (
        ts.isIdentifier(node) &&
        node.text === name &&
        (lexicalIdentity(node, control) ||
          (ts.isShorthandPropertyAssignment(node.parent) && declaration(node) === control))
      ) {
        return !stagedMetadata(node);
      }
      return (
        ts.forEachChild(node, (child) => mentionsBeforeBind(child, mayRunEarly) || undefined) ===
        true
      );
    };
    return !mentionsBeforeBind(owner);
  };
  const trackedRegistration = (call: ts.CallExpression): boolean =>
    ts.isExpressionStatement(call.parent) ||
    (ts.isVariableDeclaration(call.parent) &&
      ts.isIdentifier(call.parent.name) &&
      call.parent.initializer === call);
  const addBinding = (key: string, call: ts.CallExpression, target?: ts.Expression): void => {
    if (!immediateInvocation(call)) {
      return;
    }
    let subject = target;
    while (
      subject &&
      (ts.isAsExpression(subject) ||
        ts.isParenthesizedExpression(subject) ||
        ts.isNonNullExpression(subject))
    ) {
      subject = subject.expression;
    }
    const control = subject && origin(subject);
    if (
      control &&
      ts.isVariableDeclaration(control) &&
      control.initializer &&
      ts.isCallExpression(control.initializer) &&
      createsButton(control.initializer) &&
      (!trackedRegistration(call) ||
        call.pos < control.end ||
        !privateUntilBinding(control, target!, call))
    ) {
      return;
    }
    const proofs = bound.get(key) ?? [];
    proofs.push({ end: call.end, owner: phase(call) });
    bound.set(key, proofs);
  };
  const wrappers = new Map<ts.Declaration, Set<number>>();
  const lexicalValue = (node: ts.Expression): ts.Declaration | undefined => {
    let value = lexicalDeclaration(node);
    const visited = new Set<ts.Declaration>();
    while (
      value &&
      !visited.has(value) &&
      ts.isVariableDeclaration(value) &&
      ts.isVariableDeclarationList(value.parent) &&
      value.parent.flags & ts.NodeFlags.Const &&
      value.initializer &&
      ts.isIdentifier(value.initializer)
    ) {
      visited.add(value);
      value = lexicalDeclaration(value.initializer);
    }
    return value;
  };
  const wrapperPorts = (callee: ts.Expression): ReadonlySet<number> | undefined => {
    const value = ts.isIdentifier(callee) && stable(callee) ? lexicalValue(callee) : undefined;
    return value && wrappers.get(value);
  };
  const collectBindings = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && canonicalBindingCall(node) && node.arguments[1]) {
      addBinding(reference(node.arguments[1]), node, node.arguments[1]);
      for (let owner: ts.Node | undefined = node.parent; owner; owner = owner.parent) {
        if (
          !ts.isArrowFunction(owner) &&
          !ts.isFunctionExpression(owner) &&
          !ts.isFunctionDeclaration(owner)
        ) {
          continue;
        }
        if (!immediateWrapperCall(node, owner)) {
          break;
        }
        const position = owner.parameters.findIndex(
          (parameter) =>
            ts.isIdentifier(parameter.name) &&
            ts.isIdentifier(node.arguments[1]!) &&
            lexicalIdentity(node.arguments[1]!, parameter),
        );
        const name = ts.isFunctionDeclaration(owner)
          ? owner.name
          : ts.isVariableDeclaration(owner.parent)
            ? owner.parent.name
            : undefined;
        const declaration = name && ts.isIdentifier(name) ? lexicalDeclaration(name) : undefined;
        if (
          position >= 0 &&
          declaration &&
          name &&
          ts.isIdentifier(name) &&
          stable(name) &&
          stable(node.arguments[1]!) &&
          privateUntilBinding(owner.parameters[position]!, node.arguments[1]!, node) &&
          (owner.body === node ||
            (owner.body &&
              ts.isBlock(owner.body) &&
              owner.body.statements.at(-1) === node.parent &&
              (ts.isExpressionStatement(node.parent) || ts.isReturnStatement(node.parent))))
        ) {
          const ports = wrappers.get(declaration) ?? new Set<number>();
          ports.add(position);
          wrappers.set(declaration, ports);
        }
        break;
      }
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(source);
  const collectWrapperCalls = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      for (const position of wrapperPorts(node.expression) ?? []) {
        const argument = node.arguments[position];
        if (argument) {
          addBinding(reference(argument), node, argument);
        }
      }
    }
    ts.forEachChild(node, collectWrapperCalls);
  };
  collectWrapperCalls(source);
  const bindingControls = new Map<string, string[]>();
  const bindingOwners = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression)
    ) {
      const call = node.initializer;
      const positions = canonicalBindingCall(call)
        ? [1]
        : [...(wrapperPorts(call.expression) ?? [])];
      bindingControls.set(
        reference(node.name),
        positions.flatMap((position) =>
          call.arguments[position] ? [reference(call.arguments[position]!)] : [],
        ),
      );
    }
    ts.forEachChild(node, bindingOwners);
  };
  bindingOwners(source);
  for (const [entry, controls] of bindingControls) {
    if (controls.length && escaped(entry)) {
      invalidLifetimes.add(entry);
      for (const control of controls) {
        invalidLifetimes.add(control);
      }
    }
  }
  const callers = new Map<ts.Node, Set<ts.Node>>();
  const storedWithoutInvocation = (call: ts.CallExpression): boolean => {
    if (!ts.isPropertyAccessExpression(call.expression)) {
      return false;
    }
    const callee = call.expression;
    const value = origin(callee.expression);
    if (
      !value ||
      !ts.isVariableDeclaration(value) ||
      !value.initializer ||
      !stable(callee.expression) ||
      !clean(`${reference(callee.expression)}.${callee.name.text}`, true)
    ) {
      return false;
    }
    if (
      ts.isNewExpression(value.initializer) &&
      ts.isIdentifier(value.initializer.expression) &&
      ["Map", "WeakMap"].includes(value.initializer.expression.text) &&
      !declaration(value.initializer.expression) &&
      callee.name.text === "set"
    ) {
      return true;
    }
    return (
      ts.isArrayLiteralExpression(value.initializer) &&
      ["push", "unshift"].includes(callee.name.text)
    );
  };
  const callbackValue = (expression: ts.Expression, parent: ts.Node): void => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
      callbackValue(expression.expression, parent);
      return;
    }
    const value = origin(expression);
    const fn =
      ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)
        ? expression
        : value && ts.isFunctionDeclaration(value)
          ? value
          : value &&
              ts.isVariableDeclaration(value) &&
              value.initializer &&
              (ts.isArrowFunction(value.initializer) || ts.isFunctionExpression(value.initializer))
            ? value.initializer
            : undefined;
    if (fn) {
      const parents = callers.get(fn) ?? new Set<ts.Node>();
      parents.add(parent);
      callers.set(fn, parents);
    }
    const key = reference(expression);
    if (/\.(dispose|remove)$/.test(key)) {
      lifecycleCalls.push({ key: key.replace(/\.(dispose|remove)$/, ""), phase: parent });
    }
    if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        if (ts.isPropertyAssignment(property)) {
          callbackValue(property.initializer, parent);
        }
        if (ts.isShorthandPropertyAssignment(property)) {
          callbackValue(property.name, parent);
        }
      }
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        callbackValue(element, parent);
      }
    }
  };
  const localCalls = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      callbackValue(node.expression, phase(node));
      if (!storedWithoutInvocation(node)) {
        for (const argument of node.arguments) {
          callbackValue(argument, phase(node));
        }
      }
    }
    ts.forEachChild(node, localCalls);
  };
  localCalls(source);
  const reaches = (from: ts.Node, to: ts.Node, seen = new Set<ts.Node>()): boolean => {
    if (from === to) {
      return true;
    }
    if (seen.has(from)) {
      return false;
    }
    return [...(callers.get(from) ?? [])].some((parent) =>
      reaches(parent, to, new Set([...seen, from])),
    );
  };
  for (const call of lifecycleCalls) {
    const position = /^(-?\d+):/.exec(call.key)?.[1];
    const owner =
      position === undefined
        ? undefined
        : declarations.find((value) => value.pos === Number(position));
    if (!owner || reaches(call.phase, phase(owner))) {
      invalidLifetimes.add(call.key);
      for (const control of bindingControls.get(call.key) ?? []) {
        invalidLifetimes.add(control);
      }
    }
  }
  const hasBinding = (
    node: ts.Expression,
    construction = false,
    owner = phase(node),
    position = node.pos,
  ): boolean =>
    stable(node) &&
    (bound.get(reference(node)) ?? []).some(
      (proof) => proof.owner === owner && (construction || proof.end <= position),
    );
  const immediateButtonRegistration = (
    metadata: ts.BinaryExpression,
    target: ts.Expression,
  ): boolean => {
    if (
      !ts.isIdentifier(target) ||
      !ts.isExpressionStatement(metadata.parent) ||
      !ts.isBlock(metadata.parent.parent) ||
      !hasBinding(target, true)
    ) {
      return false;
    }
    const declarations = context.lexicalDeclarations(target);
    const fresh = declarations?.length === 1 ? declarations[0] : undefined;
    if (
      !fresh ||
      !ts.isVariableDeclaration(fresh) ||
      !ts.isVariableDeclarationList(fresh.parent) ||
      !fresh.initializer
    ) {
      return false;
    }
    const { initializer, parent: list } = fresh;
    const creation = list.parent;
    const block = metadata.parent.parent;
    if (
      !ts.isVariableStatement(creation) ||
      creation.parent !== block ||
      !(list.flags & ts.NodeFlags.Const) ||
      list.declarations.length !== 1 ||
      !ts.isCallExpression(initializer) ||
      initializer.questionDotToken ||
      initializer.arguments.length !== 1 ||
      !ts.isStringLiteralLike(initializer.arguments[0]!) ||
      initializer.arguments[0]!.text !== "button" ||
      !ts.isPropertyAccessExpression(initializer.expression) ||
      initializer.expression.questionDotToken ||
      initializer.expression.name.text !== "createElement" ||
      !ts.isIdentifier(initializer.expression.expression) ||
      initializer.expression.expression.text !== "document" ||
      context.lexicalDeclarations(initializer.expression.expression)?.length
    ) {
      return false;
    }
    const ownNode = (node: ts.Expression): boolean => lexicalIdentity(node, fresh);
    const isMetadata = (statement: ts.Statement): boolean => {
      if (!ts.isExpressionStatement(statement)) {
        return false;
      }
      const node = statement.expression;
      if (
        !ts.isBinaryExpression(node) ||
        node.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
        !ts.isPropertyAccessExpression(node.left) ||
        node.left.questionDotToken ||
        !ts.isStringLiteralLike(node.right)
      ) {
        return false;
      }
      const { expression, name } = node.left;
      return (
        (name.text === "type" && node.right.text === "button" && ownNode(expression)) ||
        (name.text === "action" &&
          ts.isPropertyAccessExpression(expression) &&
          !expression.questionDotToken &&
          expression.name.text === "dataset" &&
          ownNode(expression.expression))
      );
    };
    const following = block.statements.slice(block.statements.indexOf(creation) + 1);
    const code = following.findIndex((statement) => !isMetadata(statement));
    if (code < 0 || !following.slice(0, code).includes(metadata.parent)) {
      return false;
    }
    const next = following[code]!;
    const call = ts.isExpressionStatement(next)
      ? next.expression
      : ts.isVariableStatement(next) &&
          next.declarationList.flags & ts.NodeFlags.Const &&
          next.declarationList.declarations.length === 1 &&
          ts.isIdentifier(next.declarationList.declarations[0]!.name)
        ? next.declarationList.declarations[0]!.initializer
        : undefined;
    if (
      !call ||
      !ts.isCallExpression(call) ||
      call.questionDotToken ||
      !ts.isIdentifier(call.expression) ||
      call.arguments.length !== 2 ||
      !ownNode(call.arguments[1]!) ||
      !ts.isObjectLiteralExpression(call.arguments[0]!) ||
      !inertRegistrationOptions(call.arguments[0]!) ||
      !immediateInvocation(call)
    ) {
      return false;
    }
    return canonicalBindingCall(call);
  };
  const inheritFactoryBindings = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression)
    ) {
      const factory = factoryFor(node.initializer.expression);
      if (factory && ts.isIdentifier(node.name)) {
        for (const member of factory) {
          addBinding(`${reference(node.name)}${member ? `.${member}` : ""}`, node.initializer);
        }
      }
      if (factory && ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (
            ts.isIdentifier(element.name) &&
            factory.has(element.propertyName?.getText(source) ?? element.name.text)
          ) {
            addBinding(reference(element.name), node.initializer);
          }
        }
      }
    }
    ts.forEachChild(node, inheritFactoryBindings);
  };
  inheritFactoryBindings(source);
  const factoryAssociations: FactoryAssociation[] = [];
  for (const statement of source.statements) {
    if (
      !ts.isFunctionDeclaration(statement) ||
      !synchronousCallable(statement) ||
      !statement.name ||
      !statement.body ||
      !clean(reference(statement.name)) ||
      !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ||
      !statement.body.statements.length ||
      !ts.isReturnStatement(statement.body.statements.at(-1)!)
    ) {
      continue;
    }
    const guaranteed = new Map<string, number>();
    const unconditional = (node: ts.Node, end: number): void => {
      if (
        ts.isFunctionLike(node) ||
        ts.isConditionalExpression(node) ||
        (ts.isBinaryExpression(node) &&
          [
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(node.operatorToken.kind)) ||
        (ts.isCallExpression(node) && node.questionDotToken)
      ) {
        return;
      }
      if (ts.isCallExpression(node) && canonicalBindingCall(node) && node.arguments[1]) {
        guaranteed.set(reference(node.arguments[1]), end);
      }
      ts.forEachChild(node, (child) => unconditional(child, end));
    };
    for (const item of statement.body.statements) {
      if (ts.isVariableStatement(item)) {
        for (const declaration of item.declarationList.declarations) {
          if (declaration.initializer) {
            unconditional(declaration.initializer, item.end);
          }
          if (
            item.declarationList.flags & ts.NodeFlags.Const &&
            ts.isIdentifier(declaration.name) &&
            declaration.initializer &&
            ts.isCallExpression(declaration.initializer) &&
            ts.isIdentifier(declaration.initializer.expression)
          ) {
            const factory = factoryFor(declaration.initializer.expression);
            for (const member of factory ?? []) {
              guaranteed.set(
                `${reference(declaration.name)}${member ? `.${member}` : ""}`,
                item.end,
              );
            }
          }
        }
      } else if (ts.isExpressionStatement(item)) {
        unconditional(item.expression, item.end);
      }
    }
    const returns: ts.ReturnStatement[] = [];
    let disposed = false;
    const collectReturns = (node: ts.Node): void => {
      if (node !== statement && ts.isFunctionLike(node)) {
        return;
      }
      if (ts.isReturnStatement(node)) {
        returns.push(node);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ["dispose", "remove"].includes(node.expression.name.text)
      ) {
        disposed = true;
      }
      ts.forEachChild(node, collectReturns);
    };
    collectReturns(statement.body);
    if (disposed || !returns.length) {
      continue;
    }
    const stableReturn = (expression: ts.Expression): boolean => {
      if (ts.isIdentifier(expression)) {
        const value = declaration(expression);
        return Boolean(
          value &&
          ts.isVariableDeclaration(value) &&
          ts.isVariableDeclarationList(value.parent) &&
          value.parent.flags & ts.NodeFlags.Const,
        );
      }
      return false;
    };
    const returnedBinding = (expression: ts.Expression, position: number): boolean =>
      hasBinding(expression, false, statement, position) &&
      (guaranteed.get(reference(expression)) ?? Infinity) <= position;
    const members = (expression: ts.Expression | undefined, position: number): Set<string> => {
      if (!expression) {
        return new Set();
      }
      if (stableReturn(expression) && returnedBinding(expression, position)) {
        return new Set([""]);
      }
      if (ts.isIdentifier(expression) && stableReturn(expression) && stable(expression)) {
        const prefix = `${reference(expression)}.`;
        return new Set(
          [...guaranteed.keys()].flatMap((key) => {
            if (!key.startsWith(prefix)) {
              return [];
            }
            const member = key.slice(prefix.length);
            if (member.includes(".")) {
              return [];
            }
            const value = ts.factory.createElementAccessExpression(
              expression,
              ts.factory.createStringLiteral(member),
            );
            return returnedBinding(value, position) ? [member] : [];
          }),
        );
      }
      if (ts.isObjectLiteralExpression(expression)) {
        if (
          expression.properties.some(
            (property) =>
              ts.isSpreadAssignment(property) ||
              (property.name && ts.isComputedPropertyName(property.name)),
          )
        ) {
          return new Set();
        }
        const result = new Set<string>();
        for (const property of expression.properties) {
          const name = property.name;
          if (
            !name ||
            (!ts.isIdentifier(name) && !ts.isStringLiteralLike(name) && !ts.isNumericLiteral(name))
          ) {
            return new Set();
          }
          const key = ts.isNumericLiteral(name) ? String(Number(name.text)) : name.text;
          // An explicit later property replaces an earlier data value, including accessors and methods.
          result.delete(key);
          const value = ts.isShorthandPropertyAssignment(property)
            ? property.name
            : ts.isPropertyAssignment(property)
              ? property.initializer
              : undefined;
          if (value && returnedBinding(value, position)) {
            result.add(key);
          }
        }
        return result;
      }
      return new Set();
    };
    const candidates = returns.map((value) => members(value.expression, value.pos));
    const common = [...candidates[0]!].filter((member) =>
      candidates.every((candidate) => candidate.has(member)),
    );
    if (common.length) {
      factoryAssociations.push({
        exportName: statement.name.text,
        line: source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1,
        members: common.sort(),
        path,
      });
    }
  }
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
    let focus = false,
      registered = false,
      sampled = false;
    const arrayValue = (node: ts.Expression): boolean => {
      if (ts.isArrayLiteralExpression(node)) {
        return true;
      }
      const value = origin(node);
      return Boolean(
        stable(node, true) &&
        !escaped(reference(node)) &&
        value &&
        ts.isVariableDeclaration(value) &&
        value.initializer &&
        ts.isArrayLiteralExpression(value.initializer),
      );
    };
    const setValue = (node: ts.Expression): boolean => {
      const value = origin(node);
      return Boolean(
        stable(node, true) &&
        !escaped(reference(node)) &&
        value &&
        ts.isVariableDeclaration(value) &&
        value.initializer &&
        ts.isNewExpression(value.initializer) &&
        ts.isIdentifier(value.initializer.expression) &&
        value.initializer.expression.text === "Set",
      );
    };
    const registeredValue = (node: ts.Expression): boolean => {
      const value = lexicalValue(node);
      return Boolean(
        !escaped(reference(node)) &&
        stable(node, true) &&
        value &&
        ts.isVariableDeclaration(value) &&
        value.initializer &&
        ts.isCallExpression(value.initializer) &&
        canonicalBindingCall(value.initializer) &&
        immediateInvocation(value.initializer),
      );
    };
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
        (ts.isPrefixUnaryExpression(node) &&
          [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) ||
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
        } else if (ts.isIdentifier(callee) && focusFunctions.has(reference(callee))) {
          focus = true;
        } else if (
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "focus" &&
          hasBinding(callee.expression) &&
          clean(`${reference(callee.expression)}.focus`, true)
        ) {
          focus = true;
        } else if (
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "activate" &&
          registeredValue(callee.expression)
        ) {
          registered = true;
        } else if (
          ts.isPropertyAccessExpression(callee) &&
          ["indexOf", "at", "includes"].includes(callee.name.text) &&
          arrayValue(callee.expression)
        ) {
          // Read-only native array operations do not invoke an action callback.
        } else if (
          ts.isPropertyAccessExpression(callee) &&
          ["add", "delete", "clear"].includes(callee.name.text) &&
          setValue(callee.expression)
        ) {
          sampled = true;
          writesOuter = true;
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
    return { coordinates, editing, focus, registered, sampled, suppression, unknown, writesOuter };
  };
  // A compatibility click may consume a private pointer latch and suppress the browser click.
  // Prove the whole click body and every use of its slot, independently of the handler's name.
  const consumesPointerLatch = (call: ts.CallExpression): boolean => {
    const click = call.arguments[1];
    if (
      call.arguments.length !== 3 ||
      call.arguments[2]?.kind !== ts.SyntaxKind.TrueKeyword ||
      !click ||
      !ts.isArrowFunction(click) ||
      !ts.isBlock(click.body)
    ) {
      return false;
    }

    // Require the local DOM element (or a const iteration over such elements), not an
    // arbitrary object with an addEventListener method.
    const fixed = (node: ts.Expression) =>
      ![...writes].some((value) => overlaps(reference(node), value));
    const domElement = (node: ts.Expression): boolean => {
      const entry = lexicalDeclaration(node);
      if (
        !entry ||
        !ts.isVariableDeclaration(entry) ||
        !(entry.parent.flags & ts.NodeFlags.Const) ||
        !fixed(node)
      ) {
        return false;
      }
      const init = entry.initializer;
      return (
        init !== undefined &&
        ts.isCallExpression(init) &&
        ts.isPropertyAccessExpression(init.expression) &&
        init.expression.name.text === "createElement" &&
        ts.isIdentifier(init.expression.expression) &&
        init.expression.expression.text === "document" &&
        !lexicalDeclaration(init.expression.expression) &&
        init.arguments.length === 1 &&
        ts.isStringLiteral(init.arguments[0]!)
      );
    };
    const target = ts.isPropertyAccessExpression(call.expression)
      ? call.expression.expression
      : undefined;
    const receiver = target && lexicalDeclaration(target);
    if (
      !target ||
      !receiver ||
      !ts.isVariableDeclaration(receiver) ||
      !(receiver.parent.flags & ts.NodeFlags.Const) ||
      !fixed(target)
    ) {
      return false;
    }
    const loop = receiver.parent.parent;
    if (
      !domElement(target) &&
      !(
        ts.isForOfStatement(loop) &&
        loop.initializer === receiver.parent &&
        ts.isArrayLiteralExpression(loop.expression) &&
        loop.expression.elements.length &&
        loop.expression.elements.every(domElement)
      )
    ) {
      return false;
    }
    const method = `${reference(target)}.addEventListener`;
    // Disposal is irrelevant to proving the method's identity. Method/receiver writes are not.
    if ([...writes].some((value) => overlaps(method, value, true))) {
      return false;
    }
    const listener = (handler: ts.ArrowFunction, events: readonly string[]) => {
      const registration = handler.parent;
      if (
        !ts.isCallExpression(registration) ||
        registration.arguments[1] !== handler ||
        !ts.isPropertyAccessExpression(registration.expression) ||
        registration.expression.name.text !== "addEventListener" ||
        !lexicalIdentity(registration.expression.expression, receiver) ||
        !registration.arguments[0] ||
        handler.modifiers?.length ||
        handler.parameters.length !== 1
      ) {
        return undefined;
      }
      const name = registration.arguments[0];
      if (ts.isIdentifier(name) && !stable(name)) {
        return undefined;
      }
      const names = eventNames(name);
      const [parameter] = handler.parameters;
      return names.length &&
        names.every((name) => events.includes(name)) &&
        parameter &&
        ts.isIdentifier(parameter.name) &&
        !parameter.initializer &&
        !parameter.dotDotDotToken
        ? parameter
        : undefined;
    };
    const event = listener(click, ["click"]);
    if (!event) {
      return false;
    }
    const property = (node: ts.Expression, parameter: ts.ParameterDeclaration, name: string) =>
      ts.isPropertyAccessExpression(node) &&
      !node.questionDotToken &&
      node.name.text === name &&
      lexicalIdentity(node.expression, parameter);
    const assignment = (statement: ts.Statement | undefined) =>
      statement &&
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ? statement.expression
        : undefined;
    const comparison = (node: ts.Node, operator: ts.SyntaxKind) =>
      ts.isBinaryExpression(node) && node.operatorToken.kind === operator ? node : undefined;
    const terms = (expression: ts.Expression, join: ts.SyntaxKind): ts.Expression[] => {
      if (ts.isParenthesizedExpression(expression)) {
        return terms(expression.expression, join);
      }
      const tree = comparison(expression, join);
      return tree ? [...terms(tree.left, join), ...terms(tree.right, join)] : [expression];
    };
    const zero = (node: ts.Expression) => ts.isNumericLiteral(node) && Number(node.text) === 0;
    const empty = (node: ts.Expression) =>
      node.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(node) && node.text === "undefined" && !lexicalDeclaration(node));
    const scalar = (name: ts.Expression) => {
      const slot = lexicalDeclaration(name);
      if (
        !slot ||
        !ts.isVariableDeclaration(slot) ||
        !ts.isIdentifier(slot.name) ||
        !ts.isVariableDeclarationList(slot.parent) ||
        !(slot.parent.flags & ts.NodeFlags.Let) ||
        !ts.isVariableStatement(slot.parent.parent) ||
        !ts.isBlock(slot.parent.parent.parent) ||
        slot.pos >= click.pos ||
        phase(slot) === source ||
        phase(slot) !== phase(click)
      ) {
        return undefined;
      }
      const types = slot.type && ts.isUnionTypeNode(slot.type) ? slot.type.types : [];
      if (types.length !== 2 || !types.some((item) => item.kind === ts.SyntaxKind.NumberKeyword)) {
        return undefined;
      }
      if (
        slot.initializer?.kind === ts.SyntaxKind.NullKeyword &&
        types.some(
          (item) => ts.isLiteralTypeNode(item) && item.literal.kind === ts.SyntaxKind.NullKeyword,
        )
      ) {
        return { sentinel: ts.SyntaxKind.NullKeyword, slot };
      }
      return types.some((item) => item.kind === ts.SyntaxKind.UndefinedKeyword) &&
        (!slot.initializer || (ts.isIdentifier(slot.initializer) && empty(slot.initializer)))
        ? { sentinel: ts.SyntaxKind.Identifier, slot }
        : undefined;
    };
    const isEmpty = (node: ts.Expression, sentinel: ts.SyntaxKind) =>
      node.kind === sentinel && empty(node);

    const statements = [...click.body.statements];
    const local = statements[0];
    let compatibility: ts.VariableDeclaration | undefined;
    if (local && ts.isVariableStatement(local)) {
      if (
        !(local.declarationList.flags & ts.NodeFlags.Const) ||
        local.declarationList.declarations.length !== 1
      ) {
        return false;
      }
      [compatibility] = local.declarationList.declarations;
      statements.shift();
    }
    const gate = statements.shift();
    if (!gate || !ts.isIfStatement(gate) || gate.elseStatement || !ts.isBlock(gate.thenStatement)) {
      return false;
    }
    const earlyReturn =
      gate.thenStatement.statements.length === 1 ? gate.thenStatement.statements[0] : undefined;
    const rejects =
      earlyReturn !== undefined && ts.isReturnStatement(earlyReturn) && !earlyReturn.expression;
    if (!rejects && statements.length) {
      return false;
    }
    const effects = rejects ? statements : gate.thenStatement.statements;
    const reset = assignment(effects[0]);
    const latch = reset && scalar(reset.left);
    if (!reset || !latch || !isEmpty(reset.right, latch.sentinel) || effects.length !== 3) {
      return false;
    }
    const suppresses = (statement: ts.Statement | undefined, method: string) =>
      statement &&
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      !statement.expression.questionDotToken &&
      statement.expression.arguments.length === 0 &&
      property(statement.expression.expression, event, method);
    if (
      !suppresses(effects[1], "preventDefault") ||
      !(
        suppresses(effects[2], "stopPropagation") ||
        suppresses(effects[2], "stopImmediatePropagation")
      )
    ) {
      return false;
    }

    let latest: ReturnType<typeof scalar>;
    let fallbackRead: ts.Expression | undefined;
    if (compatibility) {
      const value = compatibility.initializer;
      const check =
        value && ts.isConditionalExpression(value)
          ? comparison(value.condition, ts.SyntaxKind.EqualsEqualsEqualsToken)
          : undefined;
      if (
        !value ||
        !ts.isConditionalExpression(value) ||
        !check ||
        !ts.isTypeOfExpression(check.left) ||
        !property(check.left.expression, event, "pointerId") ||
        !ts.isStringLiteral(check.right) ||
        check.right.text !== "number" ||
        !property(value.whenTrue, event, "pointerId")
      ) {
        return false;
      }
      fallbackRead = value.whenFalse;
      latest = scalar(fallbackRead);
      if (!latest || latest.slot === latch.slot || latest.sentinel !== ts.SyntaxKind.Identifier) {
        return false;
      }
    }
    const clauses = terms(
      gate.expression,
      rejects ? ts.SyntaxKind.BarBarToken : ts.SyntaxKind.AmpersandAmpersandToken,
    );
    const predicate = rejects
      ? ts.SyntaxKind.ExclamationEqualsEqualsToken
      : ts.SyntaxKind.EqualsEqualsEqualsToken;
    const detail = clauses.find((node) => {
      const expr = comparison(
        node,
        rejects
          ? ts.SyntaxKind.EqualsEqualsEqualsToken
          : ts.SyntaxKind.ExclamationEqualsEqualsToken,
      );
      return expr && property(expr.left, event, "detail") && zero(expr.right);
    });
    const matches = clauses.find((node) => {
      const expr = comparison(node, predicate);
      return (
        expr &&
        [expr.left, expr.right].some(
          (side, index) =>
            lexicalIdentity(side, latch.slot) &&
            (compatibility
              ? lexicalIdentity(index ? expr.left : expr.right, compatibility)
              : property(index ? expr.left : expr.right, event, "pointerId")),
        )
      );
    });
    const armed = clauses.find((node) => {
      const expr = comparison(
        node,
        rejects
          ? ts.SyntaxKind.EqualsEqualsEqualsToken
          : ts.SyntaxKind.ExclamationEqualsEqualsToken,
      );
      return expr && lexicalIdentity(expr.left, latch.slot) && isEmpty(expr.right, latch.sentinel);
    });
    if (!detail || !matches || (compatibility && !armed) || clauses.length !== (armed ? 3 : 2)) {
      return false;
    }

    // Other uses can arm the slot from a pointer listener or clear it. A read outside
    // click may only gate another clear, so changing the slot cannot enable an action.
    const accesses = (value: NonNullable<ReturnType<typeof scalar>>, fallback: boolean) => {
      const { sentinel, slot } = value;
      let armedFromPointer = false;
      let valid = true;
      const inspect = (node: ts.Node): void => {
        if (!valid) {
          return;
        }
        if (ts.isWithStatement(node) || (ts.isIdentifier(node) && node.text === "eval")) {
          valid = false;
          return;
        }
        if (
          ts.isIdentifier(slot.name) &&
          ts.isIdentifier(node) &&
          node.text === slot.name.text &&
          node !== slot.name
        ) {
          const parent = node.parent;
          // A shorthand property's symbol may be the property rather than the local value.
          const shorthand = ts.isShorthandPropertyAssignment(parent) && parent.name === node;
          if (shorthand || lexicalIdentity(node, slot)) {
            if (node === fallbackRead || (!fallback && (parent === matches || parent === armed))) {
              return;
            }
            const write = comparison(parent, ts.SyntaxKind.EqualsToken);
            if (write?.left === node && ts.isExpressionStatement(write.parent)) {
              if (isEmpty(write.right, sentinel)) {
                return;
              }
              const handler = phase(write);
              const parameter = ts.isArrowFunction(handler)
                ? listener(handler, fallback ? ["pointerdown"] : ["pointerdown", "pointermove"])
                : undefined;
              if (parameter && property(write.right, parameter, "pointerId")) {
                armedFromPointer = true;
                return;
              }
            }
            if (!fallback) {
              const read = comparison(parent, ts.SyntaxKind.EqualsEqualsEqualsToken);
              if (read && (read.left === node || read.right === node)) {
                for (
                  let guard: ts.Node = read;
                  guard && !ts.isStatement(guard);
                  guard = guard.parent
                ) {
                  if (!ts.isIfStatement(guard.parent) || guard.parent.expression !== guard) {
                    continue;
                  }
                  const branch = guard.parent;
                  const handler = phase(branch);
                  const parameter = ts.isArrowFunction(handler)
                    ? listener(handler, ["pointerdown", "pointerup", "pointercancel"])
                    : undefined;
                  const body = ts.isBlock(branch.thenStatement)
                    ? branch.thenStatement.statements
                    : [];
                  const clear = body.length === 1 && assignment(body[0]);
                  if (
                    parameter &&
                    !branch.elseStatement &&
                    terms(branch.expression, ts.SyntaxKind.AmpersandAmpersandToken).at(-1) ===
                      read &&
                    property(read.left === node ? read.right : read.left, parameter, "pointerId") &&
                    clear &&
                    lexicalIdentity(clear.left, slot) &&
                    isEmpty(clear.right, sentinel)
                  ) {
                    return;
                  }
                }
              }
            }
            valid = false;
            return;
          }
        }
        ts.forEachChild(node, inspect);
      };
      ts.forEachChild(slot.parent.parent.parent, inspect);
      return valid && armedFromPointer;
    };
    return accesses(latch, false) && (!latest || accesses(latest, true));
  };
  const findings: ActionBindingFinding[] = [];
  const runtimeAssertions: (AssertionSite & { readonly kind: RuntimeAssertionKind })[] = [];
  const unresolvedRuntimeAssertions: AssertionSite[] = [];
  const assertionSite = (node: ts.CallExpression): AssertionSite => ({
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    path,
    source: node.getText(source),
  });
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
  const nativeBridgeCandidate = (call: ts.CallExpression): boolean => {
    const registry = context.actionBinding;
    const callee = call.expression;
    const listener = call.arguments[1];
    const block = call.parent.parent;
    if (
      !registry ||
      phase(call) !== registry ||
      !ts.isPropertyAccessExpression(callee) ||
      callee.name.text !== "addEventListener" ||
      !registry.parameters[1] ||
      !lexicalIdentity(callee.expression, registry.parameters[1]) ||
      call.arguments.length !== 2 ||
      !ts.isStringLiteralLike(call.arguments[0]!) ||
      call.arguments[0]!.text !== "click" ||
      !listener ||
      !ts.isIdentifier(listener) ||
      !ts.isExpressionStatement(call.parent) ||
      !ts.isBlock(block) ||
      block.statements.length !== 1 ||
      !ts.isIfStatement(block.parent) ||
      block.parent.thenStatement !== block ||
      block.parent.parent !== registry.body
    ) {
      return false;
    }
    const guard = block.parent.expression;
    if (
      !ts.isBinaryExpression(guard) ||
      guard.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
      !ts.isIdentifier(guard.left) ||
      !ts.isStringLiteralLike(guard.right) ||
      guard.right.text !== "registry"
    ) {
      return false;
    }
    const owner = origin(guard.left);
    const callback = origin(listener);
    if (
      !owner ||
      !ts.isVariableDeclaration(owner) ||
      !owner.initializer ||
      !ts.isBinaryExpression(owner.initializer) ||
      owner.initializer.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken ||
      !ts.isStringLiteralLike(owner.initializer.right) ||
      owner.initializer.right.text !== "registry" ||
      !stable(guard.left) ||
      !callback ||
      !ts.isVariableDeclaration(callback) ||
      !callback.initializer ||
      !ts.isArrowFunction(callback.initializer) ||
      phase(callback) !== registry ||
      !stable(listener)
    ) {
      return false;
    }
    const configuredOwner = owner.initializer.left;
    return (
      ts.isPropertyAccessExpression(configuredOwner) &&
      configuredOwner.name.text === "nativeClickOwner" &&
      registry.parameters[0] !== undefined &&
      lexicalIdentity(configuredOwner.expression, registry.parameters[0])
    );
  };
  const bridgeCalls = (
    context.actionBinding?.getSourceFile() === source
      ? (context.actionBinding.body?.statements ?? [])
      : []
  )
    .flatMap((statement) =>
      ts.isIfStatement(statement) && ts.isBlock(statement.thenStatement)
        ? statement.thenStatement.statements
        : [],
    )
    .filter(
      (
        statement,
      ): statement is ts.ExpressionStatement & { readonly expression: ts.CallExpression } =>
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression) &&
        nativeBridgeCandidate(statement.expression),
    );
  const nativeBridge = bridgeCalls.length === 1 ? bridgeCalls[0]!.expression : undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === "assertBindings") {
        unresolvedRuntimeAssertions.push(assertionSite(node));
      } else if (node.arguments.length === 1 && !ts.isSpreadElement(node.arguments[0]!)) {
        const target = canonicalCall(node);
        const kind = target && context.assertions.get(target);
        if (kind) {
          runtimeAssertions.push({ ...assertionSite(node), kind });
        }
      }
      if (ts.isIdentifier(callee) && callee.text === "bindAdaHoldActions") {
        record("legacy-root", node);
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ["addEventListener", "on", "addListener"].includes(callee.name.text)
      ) {
        const event = node.arguments[0];
        const names = event ? eventNames(event) : [];
        const facts = callbackFacts(node.arguments[1]);
        const discrete = names.some((name) => ["click", "dblclick"].includes(name));
        const pointer = names.some((name) =>
          /^(pointer|touch|mouse|wheel|keydown|keyup)/.test(name),
        );
        const editing = names.some((name) => ["input", "change", "beforeinput"].includes(name));
        const keyboard =
          names.length > 0 && names.every((name) => ["keydown", "keyup"].includes(name));
        if (keyboard && facts && !facts.unknown && !facts.writesOuter && facts.registered) {
          record(
            "registered-action",
            node,
            "registered-keyboard",
            "Keyboard dispatch invokes the actual canonical binding entry",
          );
        } else if (
          keyboard &&
          facts &&
          !facts.unknown &&
          !facts.writesOuter &&
          facts.focus &&
          !facts.registered
        ) {
          record(
            "non-action",
            node,
            "keyboard-focus",
            "Only native focus/public focusTarget and event suppression; no action callback",
          );
        } else if (
          (discrete || pointer || editing) &&
          facts &&
          !facts.unknown &&
          facts.suppression &&
          !facts.writesOuter &&
          !facts.coordinates &&
          !facts.editing &&
          !facts.focus &&
          !facts.registered &&
          !facts.sampled
        ) {
          record(
            "non-action",
            node,
            "suppressor",
            "Only event suppression and local statements; no action/helper call",
          );
        } else if (discrete && consumesPointerLatch(node)) {
          record(
            "non-action",
            node,
            "suppressor",
            "Capture click only clears a private pointer latch used for suppression and cancels the browser event",
          );
        } else if (discrete) {
          if (node !== nativeBridge) {
            record("raw-discrete", node);
          }
        } else if (pointer) {
          record(
            "gesture-review",
            node,
            facts && !facts.unknown && facts.coordinates
              ? "drag-state"
              : facts && !facts.unknown && facts.sampled
                ? "continuous-state"
                : "unclassified",
            "Pointer callbacks remain blocking until their state/effects and discrete release paths are resolved",
          );
        } else if (editing) {
          record(
            facts && !facts.unknown && facts.editing && !facts.registered && !facts.sampled
              ? "non-action"
              : "unresolved-event",
            node,
            facts && !facts.unknown && facts.editing && !facts.registered && !facts.sampled
              ? "editing-state"
              : "unclassified",
          );
        } else if (!names.length) {
          record("unresolved-event", node);
        }
      }
      if (createsButton(node)) {
        const target =
          ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)
            ? node.parent.name
            : node;
        if (!hasBinding(target, true)) {
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
        !hasBinding(callee.expression)
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
        !hasBinding(callee.expression)
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
        if (
          (isActionType || isActionId) &&
          !hasBinding(target) &&
          !immediateButtonRegistration(node, target)
        ) {
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
  return { factoryAssociations, findings, runtimeAssertions, unresolvedRuntimeAssertions };
}

/** Reports bypasses without grandfathering existing consumer files. */
export function scanDiscreteActionBindings(path: string, text: string): ActionBindingFinding[] {
  const sources = new Map([[path, ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)]]);
  return scanSource(scanContext(sources), path, text).findings;
}

/** Only exported returned nodes with actual binding associations propagate across module imports. */
export function scanDiscreteActionProject(inputs: readonly DiscreteActionSource[]) {
  const sources = new Map(
    inputs.map(({ path, text }) => [
      path,
      ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true),
    ]),
  );
  const context = scanContext(sources);
  for (let pass = 0; pass <= inputs.length; pass++) {
    let changed = false;
    for (const input of inputs) {
      for (const proof of scanSource(context, input.path, input.text).factoryAssociations) {
        const key = `${proof.path}#${proof.exportName}`;
        const previous = context.factories.get(key);
        if (!previous || proof.members.some((member) => !previous.has(member))) {
          context.factories.set(key, new Set([...(previous ?? []), ...proof.members]));
          changed = true;
        }
      }
    }
    if (!changed) {
      break;
    }
  }
  const scans = inputs.map((input) => scanSource(context, input.path, input.text));
  return {
    factoryAssociations: scans.flatMap((scan) => scan.factoryAssociations),
    findings: scans.flatMap((scan) => scan.findings),
    runtimeAssertions: scans.flatMap((scan) => scan.runtimeAssertions),
    unresolvedRuntimeAssertions: scans.flatMap((scan) => scan.unresolvedRuntimeAssertions),
  };
}
