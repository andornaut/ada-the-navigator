import { posix } from "node:path";

import ts from "typescript";

import { guardedRecoveryAssertion } from "./discrete-action-architecture-recovery.ts";

export interface ActionBindingFinding {
  readonly kind:
    | "raw-discrete"
    | "raw-standard-button"
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
  readonly recoveryRoot: ts.FunctionDeclaration | undefined;
  readonly lexicalDeclarations: (node: ts.Identifier) => readonly ts.Declaration[] | undefined;
  readonly factories: Map<string, ReadonlySet<string>>;
  readonly sources: ReadonlyMap<string, ts.SourceFile>;
}

function localModule(
  sources: ScanContext["sources"],
  source: ts.SourceFile,
  specifier: string,
): ts.SourceFile | undefined {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return undefined;
  }
  const path = posix.normalize(posix.join(posix.dirname(source.fileName), specifier));
  const target = sources.get(path);
  return target?.isDeclarationFile ? undefined : target;
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
  const target = localModule(context.sources, node.getSourceFile(), statement.moduleSpecifier.text);
  return target && { name: item.propertyName?.text ?? item.name.text, target };
}

// These pinned Phaser exports are library lifecycle notifications, outside the input lifecycle.
const PHASER_LIFECYCLE_EVENTS = new Map([
  ["Loader.Events.ADD", "addfile"],
  ["Loader.Events.FILE_COMPLETE", "filecomplete"],
  ["Renderer.Events.RESTORE_WEBGL", "restorewebgl"],
  ["Scale.Events.RESIZE", "resize"],
  ["Scenes.Events.PRE_RENDER", "prerender"],
]);

function phaserLifecycleEvent(context: ScanContext, node: ts.Expression): string | undefined {
  if (
    !ts.isPropertyAccessExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== "Events" ||
    !ts.isIdentifier(node.expression.expression)
  ) {
    return undefined;
  }
  const declarations = context.lexicalDeclarations(node.expression.expression);
  const item = declarations?.length === 1 ? declarations[0] : undefined;
  if (!item || !ts.isImportSpecifier(item) || item.isTypeOnly || item.parent.parent.isTypeOnly) {
    return undefined;
  }
  const statement = item.parent.parent.parent;
  if (
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    statement.moduleSpecifier.text !== "phaser"
  ) {
    return undefined;
  }
  return PHASER_LIFECYCLE_EVENTS.get(
    `${item.propertyName?.text ?? item.name.text}.Events.${node.name.text}`,
  );
}

function importedEventLiteral(context: ScanContext, node: ts.Identifier): string | undefined {
  const imported = localValueImport(context, node);
  return (
    imported && exportedEventLiteral(context.sources, imported.target, imported.name, new Set())
  );
}

function exportedEventLiteral(
  sources: ScanContext["sources"],
  target: ts.SourceFile,
  name: string,
  seen: Set<ts.SourceFile>,
): string | undefined {
  if (seen.has(target)) {
    return undefined;
  }
  seen.add(target);
  for (const statement of target.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const item = statement.exportClause.elements.find(
        (element) => !element.isTypeOnly && element.name.text === name,
      );
      if (item) {
        const next = localModule(sources, target, statement.moduleSpecifier.text);
        return next && exportedEventLiteral(sources, next, item.propertyName?.text ?? name, seen);
      }
    }
    if (
      !ts.isVariableStatement(statement) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const) ||
      !statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) ||
      statement.modifiers.some(({ kind }) => kind === ts.SyntaxKind.DeclareKeyword)
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
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
function inertRegistrationOptions(
  node: ts.Expression,
  localRead: (node: ts.Identifier) => boolean = () => false,
  factoryOwned = false,
): boolean {
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every(
      (property) =>
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
        property.name.text !== "__proto__" &&
        (property.name.text === "nativeClickOwner"
          ? factoryOwned &&
            ts.isStringLiteral(property.initializer) &&
            property.initializer.text === "factory"
          : inertRegistrationOptions(property.initializer, localRead)),
    );
  }
  return (
    (ts.isIdentifier(node) && localRead(node)) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  );
}

/** Follow a binding through direct reads. Reject writes, aliases and opaque syntax. */
function directRecoveryReads(
  context: ScanContext,
  scope: ts.Node,
  binding: ts.FunctionDeclaration | ts.ParameterDeclaration | ts.VariableDeclaration,
): boolean {
  const name = binding.name;
  if (!name || !ts.isIdentifier(name)) {
    return false;
  }
  const unsafe = (node: ts.Node): true | undefined => {
    if (ts.isWithStatement(node) || (ts.isIdentifier(node) && node.text === "eval")) {
      return true;
    }
    if (ts.isIdentifier(node) && node !== name && node.text === name.text) {
      const parent = node.parent;
      if (ts.isShorthandPropertyAssignment(parent)) {
        const literal = parent.parent;
        const call = literal.parent;
        // At a call argument the shorthand is a read. In a destructuring target it is a write.
        if (!ts.isCallExpression(call) || !call.arguments.some((arg) => arg === literal)) {
          return true;
        }
      }
      if (context.lexicalDeclarations(node)?.includes(binding)) {
        const read =
          (ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
          (ts.isCallExpression(parent) &&
            (parent.expression === node || parent.arguments.some((arg) => arg === node))) ||
          (ts.isParameter(parent) && parent.initializer === node);
        if (!read) {
          return true;
        }
      }
    }
    return ts.forEachChild(node, unsafe);
  };
  return !unsafe(scope);
}

/**
 * The adapter must return a live root. Its private registrar cleanup and disposed flag
 * may be written by the returned disposer only.
 */
function privateAdapterLifetime(
  context: ScanContext,
  implementation: ts.FunctionDeclaration,
  properties: ts.NodeArray<ts.ObjectLiteralElementLike>,
  flag: ts.VariableDeclaration,
  registration: ts.CallExpression,
): boolean {
  const unregister = registration.parent;
  const methods = properties.filter((property) => property.name?.getText() === "dispose");
  const dispose = methods[0];
  if (
    !ts.isIdentifier(flag.name) ||
    flag.initializer?.kind !== ts.SyntaxKind.FalseKeyword ||
    !ts.isVariableDeclaration(unregister) ||
    !(unregister.parent.flags & ts.NodeFlags.Const) ||
    !ts.isIdentifier(unregister.name) ||
    methods.length !== 1 ||
    !dispose ||
    !ts.isMethodDeclaration(dispose) ||
    dispose.asteriskToken ||
    dispose.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.AsyncKeyword) ||
    !dispose.body
  ) {
    return false;
  }
  const flagName = flag.name.text;
  const unregisterName = unregister.name.text;
  let writes = 0;
  let cleanups = 0;
  const unsafe = (node: ts.Node): true | undefined => {
    if (ts.isIdentifier(node) && (node.text === flagName || node.text === unregisterName)) {
      const parent = node.parent;
      if (ts.isShorthandPropertyAssignment(parent)) {
        return true;
      }
      const declarations = context.lexicalDeclarations(node);
      if (declarations?.includes(flag) && node !== flag.name) {
        if (
          (ts.isIfStatement(parent) && parent.expression === node) ||
          (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken)
        ) {
          return undefined;
        }
        if (
          ts.isBinaryExpression(parent) &&
          parent.left === node &&
          parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          parent.right.kind === ts.SyntaxKind.TrueKeyword &&
          ts.isExpressionStatement(parent.parent) &&
          parent.parent.parent === dispose.body
        ) {
          writes++;
          return undefined;
        }
        return true;
      }
      if (declarations?.includes(unregister) && node !== unregister.name) {
        if (
          ts.isCallExpression(parent) &&
          parent.expression === node &&
          !parent.questionDotToken &&
          !parent.arguments.length &&
          ts.isExpressionStatement(parent.parent) &&
          parent.parent.parent === dispose.body
        ) {
          cleanups++;
          return undefined;
        }
        return true;
      }
    }
    return ts.forEachChild(node, unsafe);
  };
  return !unsafe(implementation) && writes === 1 && cleanups === 1;
}

/** Authenticate the actual returned method and its default subtree, through the local wrapper. */
function recoveryAssertionFactory(
  context: ScanContext,
  factory: ts.FunctionDeclaration,
  live: ts.FunctionDeclaration,
): boolean {
  const lexical = (node: ts.Expression | undefined) => {
    const declarations = node && ts.isIdentifier(node) && context.lexicalDeclarations(node);
    return declarations && declarations.length === 1 ? declarations[0] : undefined;
  };
  const forward = factory.body?.statements[0];
  if (
    factory.body?.statements.length !== 1 ||
    !forward ||
    !ts.isReturnStatement(forward) ||
    !forward.expression ||
    !ts.isCallExpression(forward.expression) ||
    !factory.parameters[1]
  ) {
    return false;
  }
  const call = forward.expression;
  const implementation = lexical(call.expression);
  if (
    call.questionDotToken ||
    call.arguments.length !== 2 ||
    lexical(call.arguments[1]) !== factory.parameters[1] ||
    !implementation ||
    !ts.isFunctionDeclaration(implementation) ||
    implementation.parent !== factory.parent ||
    !implementation.body ||
    implementation.asteriskToken ||
    implementation.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.AsyncKeyword)
  ) {
    return false;
  }
  const root = implementation.parameters[1];
  if (
    !root ||
    !directRecoveryReads(context, factory, factory.parameters[1]) ||
    !directRecoveryReads(context, implementation.getSourceFile(), implementation) ||
    !directRecoveryReads(context, implementation, root)
  ) {
    return false;
  }
  const registry = context.sources.get("src/ui/actionRegistry.ts");
  const registrations = implementation.body.statements
    .flatMap((statement) =>
      ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [],
    )
    .flatMap(({ initializer }) => {
      if (
        !initializer ||
        !ts.isCallExpression(initializer) ||
        !ts.isIdentifier(initializer.expression)
      ) {
        return [];
      }
      const target = localValueImport(context, initializer.expression);
      return target?.name === "registerAdaActionRoot" && target.target === registry
        ? [initializer]
        : [];
    });
  if (
    registrations.length !== 1 ||
    registrations[0]!.questionDotToken ||
    registrations[0]!.arguments.length !== 2 ||
    lexical(registrations[0]!.arguments[1]) !== root
  ) {
    return false;
  }
  const returned = implementation.body.statements.at(-1);
  if (
    !returned ||
    !ts.isReturnStatement(returned) ||
    !returned.expression ||
    !ts.isObjectLiteralExpression(returned.expression)
  ) {
    return false;
  }
  let otherReturn = false;
  const inspect = (node: ts.Node): void => {
    if (!ts.isFunctionLike(node)) {
      otherReturn ||= ts.isReturnStatement(node) && node !== returned;
      ts.forEachChild(node, inspect);
    }
  };
  inspect(implementation.body);
  const properties = returned.expression.properties;
  if (
    otherReturn ||
    properties.some((property) => !property.name || !ts.isIdentifier(property.name))
  ) {
    return false;
  }
  const methods = properties.filter((property) => property.name?.getText() === "assertBindings");
  const method = methods.length === 1 ? methods[0] : undefined;
  if (
    !method ||
    !ts.isMethodDeclaration(method) ||
    method.asteriskToken ||
    method.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.AsyncKeyword) ||
    method.parameters.length !== 1 ||
    lexical(method.parameters[0]?.initializer) !== root
  ) {
    return false;
  }
  const [lifetimeGuard, rootGuard, tail] = method.body?.statements ?? [];
  if (
    method.body?.statements.length !== 3 ||
    !tail ||
    !ts.isExpressionStatement(tail) ||
    !ts.isCallExpression(tail.expression)
  ) {
    return false;
  }
  const throwCondition = (statement: ts.Statement | undefined) =>
    statement &&
    ts.isIfStatement(statement) &&
    !statement.elseStatement &&
    ts.isBlock(statement.thenStatement) &&
    statement.thenStatement.statements.length === 1 &&
    ts.isThrowStatement(statement.thenStatement.statements[0]!)
      ? statement.expression
      : undefined;
  const flag = lexical(throwCondition(lifetimeGuard));
  const outside = throwCondition(rootGuard);
  const contains =
    outside &&
    ts.isPrefixUnaryExpression(outside) &&
    outside.operator === ts.SyntaxKind.ExclamationToken
      ? outside.operand
      : undefined;
  // Only the scalar lifetime read and the original root/argument containment check can reach
  // the assertion. An arbitrary condition could redirect its argument before it falls through.
  if (
    !flag ||
    !ts.isVariableDeclaration(flag) ||
    flag.parent.parent.parent !== implementation.body ||
    !privateAdapterLifetime(context, implementation, properties, flag, registrations[0]!) ||
    !contains ||
    !ts.isCallExpression(contains) ||
    contains.questionDotToken ||
    !ts.isPropertyAccessExpression(contains.expression) ||
    contains.expression.questionDotToken ||
    contains.expression.name.text !== "contains" ||
    lexical(contains.expression.expression) !== root ||
    contains.arguments.length !== 1 ||
    lexical(contains.arguments[0]) !== method.parameters[0]
  ) {
    return false;
  }
  const delegated = tail.expression;
  const target =
    ts.isIdentifier(delegated.expression) && localValueImport(context, delegated.expression);
  return Boolean(
    !delegated.questionDotToken &&
    delegated.arguments.length === 1 &&
    lexical(delegated.arguments[0]) === method.parameters[0] &&
    target &&
    target.target === live.getSourceFile() &&
    target.name === live.name?.text,
  );
}

function scanContext(sources: ScanContext["sources"]): ScanContext {
  const registry = sources.get("src/ui/actionBinding.ts");
  const adapter = sources.get("src/ui/holdActionsAdapter.ts");
  const lexicalDeclarations = localDeclarations(sources);
  const directExport = (module: ts.SourceFile | undefined, name: string) => {
    const declarations = module?.statements.filter(
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
  const live = directExport(registry, "assertAdaActionBindings");
  const metadata = directExport(registry, "assertAdaActionMetadata");
  if (live) {
    assertions.set(live, "live-root");
  }
  if (metadata) {
    assertions.set(metadata, "metadata");
  }
  const context: ScanContext = {
    actionBinding: directExport(registry, "bindAdaAction"),
    assertions,
    factories: new Map(),
    lexicalDeclarations,
    recoveryRoot: undefined,
    sources,
  };
  const factory = directExport(adapter, "bindAdaRecoveryActionRoot");
  return {
    ...context,
    recoveryRoot:
      live && factory && recoveryAssertionFactory(context, factory, live) ? factory : undefined,
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
  for (const item of [context.actionBinding, context.recoveryRoot, ...context.assertions.keys()]) {
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
  // Keep the first declaration in source order for each name at each scope, as the lexical
  // lookup does when it walks outward. Parameters also match their owning function.
  const declarations: ts.NamedDeclaration[] = [];
  const declarationsByScope = new Map<ts.Node, Map<string, ts.NamedDeclaration>>();
  const declare = (owner: ts.Node, name: string, node: ts.NamedDeclaration): void => {
    let names = declarationsByScope.get(owner);
    if (!names) {
      names = new Map();
      declarationsByScope.set(owner, names);
    }
    if (!names.has(name)) {
      names.set(name, node);
    }
  };
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
      if (node.name && ts.isIdentifier(node.name)) {
        declare(scope(node), node.name.text, node);
        if (ts.isParameter(node)) {
          declare(node.parent, node.name.text, node);
        }
      }
    }
    ts.forEachChild(node, index);
  };
  index(source);
  const declaration = (node: ts.Identifier): ts.NamedDeclaration | undefined => {
    for (let at: ts.Node | undefined = node; at; at = at.parent) {
      const found = declarationsByScope.get(at)?.get(node.text);
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
    const lifecycle = phaserLifecycleEvent(context, node);
    return lifecycle === undefined ? strings(event) : [lifecycle];
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
  const constructionLifetimes = new Set<string>();
  const lifecycleCalls: {
    readonly key: string;
    readonly phase: ts.Node;
    readonly site: ts.Node;
  }[] = [];
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
        lifecycleCalls.push({
          key: key.replace(/\.(dispose|remove)$/, ""),
          phase: phase(node),
          site: node,
        });
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const callee = node.expression;
      if (["dispose", "remove"].includes(callee.name.text)) {
        lifecycleCalls.push({ key: reference(callee.expression), phase: phase(node), site: node });
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
  const clean = (key: string, descendants = false, lifetimes = invalidLifetimes): boolean =>
    ![...writes, ...lifetimes].some((changed) => overlaps(key, changed, descendants));
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
  const stable = (
    node: ts.Expression,
    descendants = false,
    lifetimes = invalidLifetimes,
  ): boolean => {
    if (!clean(reference(node), descendants, lifetimes)) {
      return false;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      return stable(node.expression, false, lifetimes);
    }
    if (ts.isIdentifier(node)) {
      const alias = declaration(node);
      if (
        alias &&
        ts.isVariableDeclaration(alias) &&
        alias.initializer &&
        ts.isPropertyAccessExpression(alias.initializer) &&
        !stable(alias.initializer, false, lifetimes)
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
  type SynchronousCallable =
    ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration;
  const synchronousCallable = (node: SynchronousCallable): boolean =>
    !node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) &&
    !(!ts.isArrowFunction(node) && node.asteriskToken);
  const immediateWrapperCall = (
    site: ts.Node,
    owner: SynchronousCallable | ts.SourceFile,
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
    let current = site;
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
        ts.isArrowFunction(owner) ||
        ts.isMethodDeclaration(owner)) &&
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
      constructionLifetimes.add(entry);
      for (const control of controls) {
        invalidLifetimes.add(control);
        constructionLifetimes.add(control);
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
      lifecycleCalls.push({
        key: key.replace(/\.(dispose|remove)$/, ""),
        phase: parent,
        site: expression,
      });
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
  // A direct catch that only cleans up and rethrows cannot reach a later publication site.
  const failureCleanup = (site: ts.Node, localCleanup?: ts.VariableDeclaration): boolean => {
    const call = ts.isCallExpression(site)
      ? site
      : ts.isCallExpression(site.parent) && site.parent.expression === site
        ? site.parent
        : undefined;
    const statement = call?.parent;
    const block = statement?.parent;
    const clause = block?.parent;
    const attempt = clause?.parent;
    if (
      !statement ||
      !ts.isExpressionStatement(statement) ||
      !block ||
      !ts.isBlock(block) ||
      !clause ||
      !ts.isCatchClause(clause) ||
      !attempt ||
      !ts.isTryStatement(attempt) ||
      attempt.finallyBlock ||
      !ts.isBlock(attempt.parent) ||
      attempt.parent.parent !== phase(site)
    ) {
      return false;
    }
    const rethrow = block.statements.at(-1);
    return Boolean(
      clause.variableDeclaration &&
      rethrow &&
      ts.isThrowStatement(rethrow) &&
      rethrow.expression &&
      lexicalIdentity(rethrow.expression, clause.variableDeclaration) &&
      block.statements.slice(0, -1).every((step) => {
        if (
          localCleanup &&
          ts.isExpressionStatement(step) &&
          ts.isCallExpression(step.expression) &&
          !step.expression.questionDotToken &&
          !step.expression.arguments.length &&
          lexicalIdentity(step.expression.expression, localCleanup)
        ) {
          return true;
        }
        return (
          ts.isExpressionStatement(step) &&
          ts.isCallExpression(step.expression) &&
          !step.expression.questionDotToken &&
          ts.isPropertyAccessExpression(step.expression.expression) &&
          !step.expression.expression.questionDotToken &&
          ts.isIdentifier(step.expression.expression.expression) &&
          lexicalDeclaration(step.expression.expression.expression) &&
          ["dispose", "remove"].includes(step.expression.expression.name.text) &&
          step.expression.arguments.length === 0
        );
      }),
    );
  };
  for (const call of lifecycleCalls) {
    const position = /^(-?\d+):/.exec(call.key)?.[1];
    const owner =
      position === undefined
        ? undefined
        : declarations.find((value) => value.pos === Number(position));
    if (!owner || reaches(call.phase, phase(owner))) {
      for (const key of [call.key, ...(bindingControls.get(call.key) ?? [])]) {
        invalidLifetimes.add(key);
        if (!failureCleanup(call.site)) {
          constructionLifetimes.add(key);
        }
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
  // A constructor may configure a detached native subtree before binding its root.
  const freshElement = (node: ts.Expression): boolean =>
    ts.isCallExpression(node) &&
    !node.questionDotToken &&
    node.arguments.length === 1 &&
    ts.isStringLiteralLike(node.arguments[0]!) &&
    ["button", "div", "span"].includes(node.arguments[0]!.text) &&
    ts.isPropertyAccessExpression(node.expression) &&
    !node.expression.questionDotToken &&
    node.expression.name.text === "createElement" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "document" &&
    !context.lexicalDeclarations(node.expression.expression)?.length;

  const singleLocal = (statement: ts.Node): ts.VariableDeclaration | undefined =>
    ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1
      ? statement.declarationList.declarations[0]
      : undefined;
  const isConst = (node: ts.VariableDeclaration): boolean =>
    ts.isVariableDeclarationList(node.parent) && Boolean(node.parent.flags & ts.NodeFlags.Const);

  const capturedRegistrar = (
    expression: ts.Expression,
    control: ts.VariableDeclaration,
    factoryOwned: boolean,
  ) => {
    if (
      !ts.isArrowFunction(expression) ||
      !synchronousCallable(expression) ||
      expression.parameters.length
    ) {
      return false;
    }
    const body = expression.body;
    const tail = ts.isBlock(body) ? body.statements.at(-1) : undefined;
    const call = ts.isBlock(body)
      ? tail && ts.isReturnStatement(tail)
        ? tail.expression
        : undefined
      : body;
    return Boolean(
      call &&
      ts.isCallExpression(call) &&
      canonicalBindingCall(call) &&
      call.arguments.length === 2 &&
      ts.isObjectLiteralExpression(call.arguments[0]!) &&
      (!factoryOwned || literal(fields(call.arguments[0]!)?.get("nativeClickOwner"), "factory")) &&
      lexicalIdentity(call.arguments[1]!, control) &&
      inertRegistrationOptions(
        call.arguments[0]!,
        (node) => Boolean(lexicalDeclaration(node)),
        factoryOwned,
      ) &&
      (!ts.isBlock(body) ||
        body.statements.slice(0, -1).every((statement) => {
          const local = singleLocal(statement);
          return Boolean(
            local &&
            isConst(local) &&
            ts.isIdentifier(local.name) &&
            local.initializer &&
            ts.isIdentifier(local.initializer) &&
            lexicalDeclaration(local.initializer),
          );
        })),
    );
  };

  const privateDomEdit = (
    statement: ts.Statement,
    privateNodes: ReadonlySet<ts.Declaration>,
    allowReplace = false,
  ) => {
    if (!ts.isExpressionStatement(statement)) {
      return false;
    }
    const owns = (node: ts.Expression) => {
      const value = lexicalDeclaration(node);
      return value !== undefined && privateNodes.has(value);
    };
    const expression = statement.expression;
    if (ts.isCallExpression(expression) && !expression.questionDotToken) {
      const method = expression.expression;
      return (
        ts.isPropertyAccessExpression(method) &&
        !method.questionDotToken &&
        owns(method.expression) &&
        (((method.name.text === "append" ||
          (allowReplace && method.name.text === "replaceChildren")) &&
          expression.arguments.every(owns)) ||
          (method.name.text === "setAttribute" &&
            expression.arguments.length === 2 &&
            expression.arguments.every(ts.isStringLiteralLike) &&
            !/^on/i.test((expression.arguments[0] as ts.StringLiteralLike).text)))
      );
    }
    if (
      !ts.isBinaryExpression(expression) ||
      expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
      !ts.isPropertyAccessExpression(expression.left)
    ) {
      return false;
    }
    const { left, right } = expression;
    return (
      (owns(left.expression) &&
        ((["type", "className"].includes(left.name.text) && ts.isStringLiteralLike(right)) ||
          (left.name.text === "hidden" &&
            [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(right.kind)))) ||
      (left.name.text === "action" &&
        ts.isStringLiteralLike(right) &&
        ts.isPropertyAccessExpression(left.expression) &&
        left.expression.name.text === "dataset" &&
        owns(left.expression.expression))
    );
  };

  // A method on the directly returned object cannot execute during construction.
  const returnedMethod = (site: ts.Node, owner: ts.Node): boolean => {
    const method = phase(site);
    const property = method.parent;
    const object = ts.isMethodDeclaration(method)
      ? property
      : (ts.isArrowFunction(method) || ts.isFunctionExpression(method)) &&
          ts.isPropertyAssignment(property) &&
          property.initializer === method
        ? property.parent
        : undefined;
    return Boolean(
      object &&
      ts.isObjectLiteralExpression(object) &&
      ts.isReturnStatement(object.parent) &&
      phase(object.parent) === owner,
    );
  };

  const captureCall = (statement: ts.Statement | undefined) => {
    const expression = statement && ts.isExpressionStatement(statement) && statement.expression;
    return expression &&
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ? expression
      : undefined;
  };
  const capturedKitFactory = (element: ts.VariableDeclaration, block: ts.Block) => {
    if (!dot(element.initializer, "element") || !unwritten(element.initializer)) {
      return undefined;
    }
    const kit = lexicalDeclaration(element.initializer.expression);
    const call = kit && ts.isVariableDeclaration(kit) && kit.initializer;
    if (
      !kit ||
      !ts.isVariableDeclaration(kit) ||
      !isConst(kit) ||
      !call ||
      !ts.isCallExpression(call) ||
      call.questionDotToken ||
      singleLocal(kit.parent.parent) !== kit ||
      block.statements[block.statements.indexOf(kit.parent.parent as ts.Statement) + 1] !==
        element.parent.parent ||
      kit.parent.parent.parent !== block ||
      !kitDomImport("createButton", "button", call.expression) ||
      !unwritten(call.expression) ||
      call.arguments.length !== 2 ||
      !nativeDocument(call.arguments[0]!) ||
      !clean(`${reference(call.arguments[0]!)}.createElement`, false, writesOnly)
    ) {
      return undefined;
    }
    const options = fields(call.arguments[1]);
    const content = fields(options?.get("content"));
    const getAction = options?.get("getAction");
    if (
      !literal(fields(options?.get("appearance"))?.get("layout"), "caller") ||
      !literal(content?.get("kind"), "text") ||
      content?.size !== 2 ||
      !ts.isStringLiteral(content.get("label") ?? source) ||
      !readsButtonAvailability(options?.get("getState")) ||
      !getAction ||
      !ts.isArrowFunction(getAction) ||
      !synchronousCallable(getAction) ||
      getAction.parameters.length ||
      !ts.isParenthesizedExpression(getAction.body) ||
      !ts.isObjectLiteralExpression(getAction.body.expression) ||
      getAction.body.expression.properties.length !== 1
    ) {
      return undefined;
    }
    const method = namedProperty(getAction.body.expression, "activate");
    const assignment =
      method &&
      ts.isMethodDeclaration(method) &&
      synchronousCallable(method) &&
      !method.parameters.length &&
      method.body?.statements.length === 1 &&
      captureCall(method.body.statements[0]);
    if (
      !assignment ||
      !ts.isCallExpression(assignment.right) ||
      assignment.right.questionDotToken ||
      assignment.right.arguments.length ||
      !dot(assignment.right.expression, "activate")
    ) {
      return undefined;
    }
    const latch = lexicalDeclaration(assignment.left);
    return latch &&
      ts.isVariableDeclaration(latch) &&
      ts.isIdentifier(latch.name) &&
      latch.parent.flags & ts.NodeFlags.Let &&
      latch.initializer?.kind === ts.SyntaxKind.FalseKeyword &&
      latch.parent.parent.parent === block &&
      latch.end < kit.pos
      ? { call, kit, latch, set: assignment.left, action: assignment.right.expression.expression }
      : undefined;
  };
  const capturedSuppressors = new Set<ts.CallExpression>();
  const capturedKitCleanup = (
    block: ts.Block,
    element: ts.VariableDeclaration,
    action: ts.VariableDeclaration,
    factory: NonNullable<ReturnType<typeof capturedKitFactory>>,
  ) => {
    if (!lexicalIdentity(factory.action, action)) {
      return undefined;
    }
    const listenerCall = (call: ts.CallExpression | undefined, method: string) =>
      call &&
      !call.questionDotToken &&
      dot(call.expression, method) &&
      unwritten(call.expression) &&
      lexicalIdentity(call.expression.expression, element) &&
      call.arguments.length === 2 &&
      literal(call.arguments[0], "click");
    const listeners = block.statements
      .map(callStatement)
      .filter((call): call is ts.CallExpression =>
        Boolean(call && call.pos > action.end && listenerCall(call, "addEventListener")),
      );
    if (listeners.length !== 1) {
      return undefined;
    }
    const [listener] = listeners;
    const handler = lexicalDeclaration(listener!.arguments[1]!);
    const fn = handler && ts.isVariableDeclaration(handler) && handler.initializer;
    if (
      !handler ||
      !ts.isVariableDeclaration(handler) ||
      !isConst(handler) ||
      handler.parent.parent.parent !== block ||
      !fn ||
      !ts.isArrowFunction(fn) ||
      !synchronousCallable(fn) ||
      fn.parameters.length !== 1 ||
      !ts.isIdentifier(fn.parameters[0]!.name) ||
      fn.parameters[0]!.initializer ||
      fn.parameters[0]!.dotDotDotToken ||
      !ts.isBlock(fn.body) ||
      fn.body.statements.length !== 1
    ) {
      return undefined;
    }
    const guard = fn.body.statements[0]!;
    if (
      !ts.isIfStatement(guard) ||
      guard.elseStatement ||
      !ts.isBlock(guard.thenStatement) ||
      guard.thenStatement.statements.length !== 2 ||
      !lexicalIdentity(guard.expression, factory.latch)
    ) {
      return undefined;
    }
    const [reset, stop] = guard.thenStatement.statements;
    const clear = captureCall(reset);
    const suppress = callStatement(stop);
    if (
      !clear ||
      !lexicalIdentity(clear.left, factory.latch) ||
      clear.right.kind !== ts.SyntaxKind.FalseKeyword ||
      !suppress ||
      suppress.questionDotToken ||
      suppress.arguments.length ||
      !dot(suppress.expression, "stopPropagation") ||
      !lexicalIdentity(suppress.expression.expression, fn.parameters[0]!)
    ) {
      return undefined;
    }
    const localUses = (site: ts.Node): true | undefined => {
      if (ts.isIdentifier(site)) {
        const local = ts.isShorthandPropertyAssignment(site.parent)
          ? declaration(site)
          : lexicalDeclaration(site);
        if (
          local === factory.latch &&
          ![factory.latch.name, factory.set, guard.expression, clear.left].includes(site)
        ) {
          return true;
        }
      }
      return ts.forEachChild(site, localUses);
    };
    if (localUses(block)) {
      return undefined;
    }
    for (const statement of block.statements) {
      const cleanup = singleLocal(statement);
      const fn = cleanup?.initializer;
      if (
        !cleanup ||
        !isConst(cleanup) ||
        !fn ||
        !ts.isArrowFunction(fn) ||
        !synchronousCallable(fn) ||
        fn.parameters.length ||
        !ts.isBlock(fn.body) ||
        fn.body.statements.length !== 3
      ) {
        continue;
      }
      const [retire, dispose, remove] = fn.body.statements.map(callStatement);
      const disposes = (call: ts.CallExpression | undefined, declaration: ts.VariableDeclaration) =>
        call &&
        !call.questionDotToken &&
        !call.arguments.length &&
        dot(call.expression, "dispose") &&
        lexicalIdentity(call.expression.expression, declaration);
      if (
        disposes(retire, action) &&
        disposes(dispose, factory.kit) &&
        remove &&
        listenerCall(remove, "removeEventListener") &&
        lexicalIdentity(remove.arguments[1]!, handler)
      ) {
        return {
          cleanup,
          handler,
          listener: listener!,
          retire: retire!,
          dispose: dispose!,
          remove,
        };
      }
    }
    return undefined;
  };
  const capturedProofs = new Map<ts.VariableDeclaration, number>();
  const proveCapturedConstruction = (control: ts.VariableDeclaration): number => {
    const creation = control.parent.parent;
    const block = creation.parent;
    if (
      !isConst(control) ||
      !ts.isIdentifier(control.name) ||
      !control.initializer ||
      singleLocal(creation) !== control ||
      !ts.isVariableStatement(creation) ||
      !ts.isBlock(block) ||
      !ts.isFunctionLike(block.parent)
    ) {
      return -1;
    }
    const factory = capturedKitFactory(control, block);
    if (
      (!factory && !freshElement(control.initializer)) ||
      !stable(control.name, false, factory ? writesOnly : constructionLifetimes)
    ) {
      return -1;
    }
    const privateNodes = new Set<ts.Declaration>([control]);
    let registrar: ts.VariableDeclaration | undefined;
    const invokes = (node: ts.Node): node is ts.CallExpression =>
      Boolean(
        registrar &&
        ts.isCallExpression(node) &&
        !node.questionDotToken &&
        node.arguments.length === 0 &&
        lexicalIdentity(node.expression, registrar),
      );
    for (const statement of block.statements.slice(block.statements.indexOf(creation) + 1)) {
      const local = singleLocal(statement);
      if (!local?.initializer || !ts.isIdentifier(local.name)) {
        if (!privateDomEdit(statement, privateNodes, Boolean(factory))) {
          return -1;
        }
        continue;
      }
      const value = local.initializer;
      if (invokes(value)) {
        const owner = phase(value);
        const kit = factory && capturedKitCleanup(block, control, local, factory);
        if (factory && !kit) {
          return -1;
        }
        const reads = (node: ts.Identifier, expected: ts.VariableDeclaration): boolean =>
          lexicalIdentity(node, expected) ||
          (ts.isShorthandPropertyAssignment(node.parent) && declaration(node) === expected);
        const unsafe = (node: ts.Node): true | undefined => {
          if (ts.isIdentifier(node) && node !== local.name && reads(node, local)) {
            if (factory && (node === factory.action || node.parent.parent === kit?.retire)) {
              return undefined;
            }
            const access = node.parent;
            const use = access.parent;
            const dispose =
              ts.isPropertyAccessExpression(access) &&
              access.expression === node &&
              access.name.text === "dispose" &&
              !access.questionDotToken &&
              ts.isCallExpression(use) &&
              use.expression === access &&
              !use.questionDotToken &&
              use.arguments.length === 0;
            const replace =
              ts.isBinaryExpression(access) &&
              access.left === node &&
              access.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
              invokes(access.right);
            return (!dispose && !replace) || (!returnedMethod(node, owner) && !failureCleanup(use))
              ? true
              : undefined;
          }
          if (ts.isIdentifier(node) && kit && factory) {
            if (node !== kit.cleanup.name && reads(node, kit.cleanup)) {
              const use = node.parent;
              if (
                !ts.isCallExpression(use) ||
                use.expression !== node ||
                use.questionDotToken ||
                use.arguments.length ||
                (!returnedMethod(node, owner) && !failureCleanup(use, kit.cleanup))
              ) {
                return true;
              }
            }
            if (
              node !== kit.handler.name &&
              reads(node, kit.handler) &&
              node !== kit.listener.arguments[1] &&
              node !== kit.remove.arguments[1]
            ) {
              return true;
            }
            if (
              node !== factory.kit.name &&
              reads(node, factory.kit) &&
              node.parent !== control.initializer &&
              node.parent.parent !== kit.dispose
            ) {
              return true;
            }
          }
          if (
            ts.isIdentifier(node) &&
            registrar &&
            node !== registrar.name &&
            reads(node, registrar) &&
            (!invokes(node.parent) ||
              node.parent.expression !== node ||
              (node.parent !== value && !returnedMethod(node, owner)))
          ) {
            return true;
          }
          return ts.forEachChild(node, unsafe);
        };
        if (!immediateInvocation(value) || unsafe(block)) {
          return -1;
        }
        if (kit) {
          capturedSuppressors.add(kit.listener);
        }
        return value.end;
      }
      if (isConst(local) && freshElement(value)) {
        privateNodes.add(local);
      } else if (
        !registrar &&
        isConst(local) &&
        capturedRegistrar(value, control, Boolean(factory))
      ) {
        registrar = local;
      } else if (
        !inertRegistrationOptions(value) ||
        ts.isFunctionLike(value) ||
        ts.isObjectLiteralExpression(value)
      ) {
        return -1;
      }
    }
    return -1;
  };
  const capturedEnd = (control: ts.VariableDeclaration) => {
    let end = capturedProofs.get(control);
    if (end === undefined) {
      end = proveCapturedConstruction(control);
      capturedProofs.set(control, end);
    }
    return end;
  };
  const capturedConstruction = (node: ts.Expression, metadata?: ts.BinaryExpression): boolean => {
    const control = lexicalDeclaration(node);
    if (!control || !ts.isVariableDeclaration(control) || phase(node) !== phase(control)) {
      return false;
    }
    const end = capturedEnd(control);
    return end >= 0 && (!metadata || metadata.end <= end);
  };

  const kitDomImport = (name: string, module: string, callee: ts.Expression): boolean => {
    const item = lexicalDeclaration(callee);
    if (!item || !ts.isImportSpecifier(item) || item.isTypeOnly || item.parent.parent.isTypeOnly) {
      return false;
    }
    const statement = item.parent.parent.parent;
    return (
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === `@andornaut/game-kit/runtime/web/ui/dom/${module}` &&
      (item.propertyName?.text ?? item.name.text) === name
    );
  };
  const fields = (node: ts.Expression | undefined) => {
    if (!node || !ts.isObjectLiteralExpression(node)) {
      return undefined;
    }
    const result = new Map<string, ts.Expression>();
    for (const property of node.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !ts.isIdentifier(property.name) ||
        property.name.text === "__proto__" ||
        result.has(property.name.text)
      ) {
        return undefined;
      }
      result.set(property.name.text, property.initializer);
    }
    return result;
  };
  const dot = (
    node: ts.Expression | undefined,
    name: string,
  ): node is ts.PropertyAccessExpression =>
    Boolean(
      node &&
      ts.isPropertyAccessExpression(node) &&
      !node.questionDotToken &&
      node.name.text === name,
    );
  const literal = (node: ts.Expression | undefined, value: string) =>
    Boolean(node && ts.isStringLiteral(node) && node.text === value);
  const callStatement = (node: ts.Statement | undefined) =>
    node && ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
      ? node.expression
      : undefined;
  const namedProperty = (object: ts.ObjectLiteralExpression, name: string) =>
    object.properties.find(
      (property) => property.name && ts.isIdentifier(property.name) && property.name.text === name,
    );
  const writesOnly = new Set<string>();
  const unwritten = (node: ts.Expression) => clean(reference(node), false, writesOnly);
  const domHost = (node: ts.Expression) => {
    const owner = lexicalDeclaration(node);
    const type = owner && ts.isParameter(owner) ? owner.type : undefined;
    return Boolean(
      type &&
      ts.isTypeReferenceNode(type) &&
      ts.isIdentifier(type.typeName) &&
      type.typeName.text === "HTMLElement" &&
      !context.lexicalDeclarations(type.typeName)?.length,
    );
  };
  const nativeDocument = (node: ts.Expression) => {
    const local = lexicalDeclaration(node);
    if (
      local &&
      ts.isVariableDeclaration(local) &&
      isConst(local) &&
      dot(local.initializer, "ownerDocument")
    ) {
      return domHost(local.initializer.expression) && unwritten(local.initializer);
    }
    return ts.isIdentifier(node) && node.text === "document" && !local;
  };
  const createsNative = (node: ts.Expression | undefined, tag: string) =>
    Boolean(
      node &&
      ts.isCallExpression(node) &&
      !node.questionDotToken &&
      dot(node.expression, "createElement") &&
      nativeDocument(node.expression.expression) &&
      unwritten(node.expression) &&
      node.arguments.length === 1 &&
      literal(node.arguments[0], tag),
    );

  const createdHostDocument = (node: ts.Expression): boolean => {
    if (!dot(node, "ownerDocument") || !unwritten(node)) {
      return false;
    }
    const host = lexicalDeclaration(node.expression);
    if (
      !host ||
      !ts.isVariableDeclaration(host) ||
      !isConst(host) ||
      !host.initializer ||
      !ts.isCallExpression(host.initializer) ||
      host.initializer.questionDotToken ||
      !dot(host.initializer.expression, "createElement") ||
      !unwritten(host.initializer.expression) ||
      host.initializer.arguments.length !== 1 ||
      !literal(host.initializer.arguments[0], "div")
    ) {
      return false;
    }
    const receiver = host.initializer.expression.expression;
    const parameter = lexicalDeclaration(receiver);
    const type = parameter && ts.isParameter(parameter) ? parameter.type : undefined;
    const sourceType = type && ts.isTypeReferenceNode(type) ? type.typeArguments?.[0] : undefined;
    const keys = type && ts.isTypeReferenceNode(type) ? type.typeArguments?.[1] : undefined;
    const globalType = (name: string, candidate: ts.TypeNode | undefined) =>
      candidate &&
      ts.isTypeReferenceNode(candidate) &&
      ts.isIdentifier(candidate.typeName) &&
      candidate.typeName.text === name &&
      !context.lexicalDeclarations(candidate.typeName)?.length;
    return Boolean(
      globalType("Pick", type) &&
      globalType("Document", sourceType) &&
      keys &&
      (ts.isUnionTypeNode(keys) ? keys.types : [keys]).some(
        (key) => ts.isLiteralTypeNode(key) && literal(key.literal, "createElement"),
      ),
    );
  };

  // The factory calls getState before handing its element to the caller. A field-only
  // availability projection cannot publish the fresh element or invoke a callback with it.
  const readsButtonAvailability = (state: ts.Expression | undefined): boolean => {
    if (
      !state ||
      !ts.isArrowFunction(state) ||
      !synchronousCallable(state) ||
      state.parameters.length !== 1 ||
      !ts.isIdentifier(state.parameters[0]!.name) ||
      state.parameters[0]!.initializer ||
      state.parameters[0]!.dotDotDotToken
    ) {
      return false;
    }
    const body = ts.isParenthesizedExpression(state.body) ? state.body.expression : state.body;
    const result = ts.isObjectLiteralExpression(body) && fields(body);
    const readsAvailability = (value: ts.Expression): boolean => {
      if (ts.isConditionalExpression(value)) {
        const test = value.condition;
        return (
          (dot(test, "hidden") || dot(test, "disabled")) &&
          lexicalIdentity(test.expression, state.parameters[0]!) &&
          readsAvailability(value.whenTrue) &&
          readsAvailability(value.whenFalse)
        );
      }
      const availability = fields(value);
      const kind = availability?.get("kind");
      return (
        availability?.size === 1 &&
        ["available", "disabled", "omitted"].some((name) => literal(kind, name))
      );
    };
    const availability = result && result.get("availability");
    return Boolean(result && result.size === 1 && availability && readsAvailability(availability));
  };

  // LayoutTree invokes create synchronously and inserts the returned element. Resolve the
  // actual Kit import and a private, literal component table before using that boundary.
  const layoutPublishesComponent = (constructor: SynchronousCallable): boolean => {
    const createsComponent = (port: ts.ObjectLiteralElementLike): boolean => {
      const create = ts.isMethodDeclaration(port)
        ? port
        : ts.isPropertyAssignment(port) && ts.isArrowFunction(port.initializer)
          ? port.initializer
          : undefined;
      if (!create || !synchronousCallable(create)) {
        return false;
      }
      if (create === constructor) {
        return true;
      }
      const body = create.body;
      const call =
        body && ts.isBlock(body) && body.statements.length === 1
          ? ts.isReturnStatement(body.statements[0]!) && body.statements[0]!.expression
          : body;
      return Boolean(
        call &&
        ts.isCallExpression(call) &&
        !call.questionDotToken &&
        lexicalIdentity(call.expression, constructor) &&
        unwritten(call.expression),
      );
    };
    const isLayoutMount = (node: ts.Node): boolean => {
      if (
        !ts.isCallExpression(node) ||
        node.questionDotToken ||
        !kitDomImport("mountLayout", "layoutTree", node.expression) ||
        !unwritten(node.expression) ||
        node.arguments.length !== 2
      ) {
        return false;
      }
      const config = node.arguments[0]!;
      if (!ts.isObjectLiteralExpression(config) || config.properties.length !== 2) {
        return false;
      }
      const components = namedProperty(config, "components");
      const host = namedProperty(config, "host");
      if (
        !components ||
        !host ||
        (!ts.isShorthandPropertyAssignment(host) && !ts.isPropertyAssignment(host))
      ) {
        return false;
      }
      const value = ts.isShorthandPropertyAssignment(components)
        ? components.name
        : ts.isPropertyAssignment(components)
          ? components.initializer
          : undefined;
      if (!value) {
        return false;
      }
      const local =
        ts.isIdentifier(value) &&
        (ts.isShorthandPropertyAssignment(components)
          ? declaration(value)
          : lexicalDeclaration(value));
      if (local && (!ts.isVariableDeclaration(local) || !isConst(local) || local.end > node.pos)) {
        return false;
      }
      const table = local ? local.initializer : value;
      const ports = fields(table);
      if (!ports) {
        return false;
      }
      const otherUse = (site: ts.Node): true | undefined =>
        ts.isIdentifier(site) &&
        site !== value &&
        site !== (local && local.name) &&
        (ts.isShorthandPropertyAssignment(site.parent)
          ? declaration(site)
          : lexicalDeclaration(site)) === local
          ? true
          : ts.forEachChild(site, otherUse);
      if (local && otherUse(source)) {
        return false;
      }
      return [...ports.values()].some((component) => {
        if (!ts.isObjectLiteralExpression(component) || component.properties.length !== 2) {
          return false;
        }
        const create = namedProperty(component, "create");
        const slots = namedProperty(component, "slots");
        return Boolean(
          create &&
          slots &&
          ts.isPropertyAssignment(slots) &&
          ts.isArrayLiteralExpression(slots.initializer) &&
          slots.initializer.elements.length === 0 &&
          createsComponent(create),
        );
      });
    };
    const visit = (node: ts.Node): true | undefined =>
      isLayoutMount(node) ? true : ts.forEachChild(node, visit);
    return Boolean(visit(source));
  };

  // Prove first publication within the construction block, independently of when it runs.
  // The Kit caller-layout icon factory calls getState with the fresh element while creating it.
  const registeredKitElement = (call: ts.CallExpression): boolean => {
    const handle = call.parent;
    if (
      !ts.isVariableDeclaration(handle) ||
      !isConst(handle) ||
      call.questionDotToken ||
      call.arguments.length !== 2 ||
      !clean(`${reference(call.arguments[0]!)}.createElement`, false, writesOnly)
    ) {
      return false;
    }
    const creation = handle.parent.parent;
    if (singleLocal(creation) !== handle || !ts.isBlock(creation.parent)) {
      return false;
    }
    const block = creation.parent;
    const following = block.statements.slice(block.statements.indexOf(creation) + 1);
    const first = following[0];
    const alias = first && singleLocal(first);
    if (
      !alias ||
      !isConst(alias) ||
      !ts.isIdentifier(alias.name) ||
      !dot(alias.initializer, "element") ||
      !lexicalIdentity(alias.initializer.expression, handle) ||
      !unwritten(alias.initializer)
    ) {
      return false;
    }
    if (capturedKitFactory(alias, block)?.call === call && capturedEnd(alias) >= 0) {
      return true;
    }
    const options = fields(call.arguments[1]);
    const content = fields(options?.get("content"));
    const state = options?.get("getState");
    const native = nativeDocument(call.arguments[0]!);
    const stateWithoutElement = !state || (ts.isArrowFunction(state) && !state.parameters.length);
    if (
      !literal(fields(options?.get("appearance"))?.get("layout"), "caller") ||
      !literal(content?.get("kind"), "icon") ||
      content?.has("icon") ||
      (!native && !createdHostDocument(call.arguments[0]!)) ||
      (!stateWithoutElement && !readsButtonAvailability(state))
    ) {
      return false;
    }

    const children = new Set<ts.Declaration>();
    const deferred = new Set<ts.Declaration>();
    const reads = (node: ts.Identifier) =>
      ts.isShorthandPropertyAssignment(node.parent) ? declaration(node) : lexicalDeclaration(node);
    const isDeferred = (node: ts.Expression) => {
      const local = ts.isIdentifier(node) && reads(node);
      return Boolean(local && deferred.has(local));
    };
    const readsPrivate = (node: ts.Node): true | undefined => {
      if (ts.isIdentifier(node)) {
        const local = reads(node);
        if (
          node.text === "eval" ||
          local === handle ||
          local === alias ||
          (local && (children.has(local) || deferred.has(local)))
        ) {
          return true;
        }
      }
      return ts.forEachChild(node, readsPrivate);
    };
    const face = (node: ts.Expression) =>
      dot(node, "face") && lexicalIdentity(node.expression, handle);
    const localChild = (node: ts.Expression) => {
      const local = lexicalDeclaration(node);
      return local !== undefined && children.has(local);
    };
    const isDeferredDeclaration = (local: ts.VariableDeclaration | undefined) =>
      local && isConst(local) && local.initializer && ts.isArrowFunction(local.initializer);
    const staging = (statement: ts.Statement): boolean => {
      if (ts.isIfStatement(statement)) {
        return (
          !statement.elseStatement &&
          !readsPrivate(statement.expression) &&
          ts.isBlock(statement.thenStatement) &&
          statement.thenStatement.statements.every(staging)
        );
      }
      const local = singleLocal(statement);
      if (local) {
        if (isConst(local) && createsNative(local.initializer, "span")) {
          children.add(local);
          return true;
        }
        if (isDeferredDeclaration(local)) {
          deferred.add(local);
          return true;
        }
        return !local.initializer;
      }
      if (privateDomEdit(statement, children)) {
        return true;
      }
      const edit = ts.isExpressionStatement(statement) && statement.expression;
      if (!edit) {
        return false;
      }
      if (
        ts.isBinaryExpression(edit) &&
        edit.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(edit.left) &&
        dot(edit.left.expression, "dataset")
      ) {
        return lexicalIdentity(edit.left.expression.expression, alias) && !readsPrivate(edit.right);
      }
      const invocation = callStatement(statement);
      const method = invocation?.expression;
      if (
        !invocation ||
        invocation.questionDotToken ||
        !method ||
        !ts.isPropertyAccessExpression(method) ||
        method.questionDotToken ||
        !unwritten(method)
      ) {
        return false;
      }
      const { expression: target, name } = method;
      const args = invocation.arguments;
      switch (name.text) {
        case "append":
          return lexicalIdentity(target, alias) && args.every(localChild);
        case "addEventListener":
          return (
            lexicalIdentity(target, alias) &&
            args.length === 2 &&
            ts.isStringLiteral(args[0]!) &&
            isDeferred(args[1]!)
          );
        case "setAttribute":
          return (
            face(target) &&
            args.length === 2 &&
            args.every(ts.isStringLiteral) &&
            !/^on/i.test((args[0] as ts.StringLiteral).text)
          );
        case "setProperty":
          return (
            dot(target, "style") &&
            face(target.expression) &&
            args.length === 2 &&
            ts.isStringLiteral(args[0]!) &&
            !readsPrivate(args[1]!)
          );
        default:
          return false;
      }
    };
    const inertOptions = (node: ts.Expression): boolean => {
      if (!ts.isObjectLiteralExpression(node)) {
        return ts.isArrowFunction(node) || !readsPrivate(node) || isDeferred(node);
      }
      return node.properties.every((property) => {
        if (ts.isSpreadAssignment(property)) {
          const value = property.expression;
          const branch = ts.isParenthesizedExpression(value) ? value.expression : value;
          return (
            ts.isConditionalExpression(branch) &&
            !readsPrivate(branch.condition) &&
            [branch.whenTrue, branch.whenFalse].every((value) => {
              const branchFields = fields(value);
              return (
                branchFields &&
                [...branchFields.keys()].every((name) => name === "hold") &&
                inertOptions(value)
              );
            })
          );
        }
        return (
          (ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text !== "__proto__" &&
            inertOptions(property.initializer)) ||
          (ts.isShorthandPropertyAssignment(property) &&
            !property.objectAssignmentInitializer &&
            inertOptions(property.name))
        );
      });
    };
    const hoistedEscape = (node: ts.Node): true | undefined =>
      (ts.isFunctionDeclaration(node) && readsPrivate(node)) ||
      ts.forEachChild(node, hoistedEscape);

    const index = following.findIndex((statement) => {
      const value = singleLocal(statement)?.initializer;
      return value && ts.isCallExpression(value) && canonicalBindingCall(value);
    });
    const binding = following[index] && singleLocal(following[index]!);
    if (
      !binding ||
      !isConst(binding) ||
      !following.slice(1, index).every(staging) ||
      hoistedEscape(block)
    ) {
      return false;
    }
    const registration = binding.initializer as ts.CallExpression;
    const action = registration.arguments[0];
    if (
      registration.arguments.length !== 2 ||
      !lexicalIdentity(registration.arguments[1]!, alias) ||
      !action ||
      !ts.isObjectLiteralExpression(action) ||
      !inertOptions(action)
    ) {
      return false;
    }
    const owners = action.properties.filter(
      (property) => property.name?.getText(source) === "nativeClickOwner",
    );
    if (
      owners.length !== 1 ||
      !ts.isPropertyAssignment(owners[0]!) ||
      !literal(owners[0]!.initializer, "factory")
    ) {
      return false;
    }

    const tail = following.slice(index + 1);
    // A synchronous detached factory first gives its button away in this returned record.
    // Its cleanup is deferred to the record's consumer and can only dispose the local handles.
    const [makeRecord, returnRecord] = tail;
    const record = makeRecord && singleLocal(makeRecord);
    const value = record?.initializer;
    const owner = block.parent;
    if (
      tail.length === 2 &&
      record &&
      isConst(record) &&
      value &&
      ts.isObjectLiteralExpression(value) &&
      returnRecord &&
      ts.isReturnStatement(returnRecord) &&
      returnRecord.expression &&
      lexicalIdentity(returnRecord.expression, record) &&
      ts.isFunctionDeclaration(owner) &&
      synchronousCallable(owner)
    ) {
      const element = namedProperty(value, "element");
      const dispose = namedProperty(value, "dispose");
      if (
        element &&
        ts.isPropertyAssignment(element) &&
        lexicalIdentity(element.initializer, alias) &&
        dispose &&
        ts.isMethodDeclaration(dispose) &&
        synchronousCallable(dispose) &&
        !dispose.parameters.length &&
        dispose.body?.statements.length === 2 &&
        dispose.body.statements.every((statement, position) => {
          const cleanup = callStatement(statement);
          return (
            cleanup &&
            !cleanup.questionDotToken &&
            !cleanup.arguments.length &&
            dot(cleanup.expression, "dispose") &&
            lexicalIdentity(cleanup.expression.expression, position === 0 ? binding : handle)
          );
        }) &&
        value.properties.every(
          (property) =>
            property === element ||
            property === dispose ||
            (ts.isShorthandPropertyAssignment(property) &&
              !property.objectAssignmentInitializer &&
              !["dispose", "element", "__proto__"].includes(property.name.text) &&
              owner.parameters.some((parameter) => declaration(property.name) === parameter)),
        )
      ) {
        return true;
      }
    }
    if (!native || !stateWithoutElement) {
      return false;
    }

    const publishesLayout = (): boolean => {
      const constructor = block.parent;
      const [setup, initialize, publish] = tail;
      const update = setup && singleLocal(setup);
      const fn = update?.initializer;
      const invoke = callStatement(initialize);
      if (
        (!ts.isFunctionDeclaration(constructor) &&
          !ts.isMethodDeclaration(constructor) &&
          !ts.isArrowFunction(constructor) &&
          !ts.isFunctionExpression(constructor)) ||
        !synchronousCallable(constructor) ||
        tail.length !== 3 ||
        !update ||
        !isConst(update) ||
        !fn ||
        !ts.isArrowFunction(fn) ||
        !synchronousCallable(fn) ||
        !invoke ||
        invoke.questionDotToken ||
        !lexicalIdentity(invoke.expression, update) ||
        !invoke.arguments.every((argument) =>
          constructor.parameters.some((parameter) => lexicalIdentity(argument, parameter)),
        ) ||
        !publish ||
        !ts.isReturnStatement(publish) ||
        !publish.expression ||
        !ts.isObjectLiteralExpression(publish.expression) ||
        publish.expression.properties.length !== 4
      ) {
        return false;
      }
      const element = namedProperty(publish.expression, "element");
      const dispose = namedProperty(publish.expression, "dispose");
      const slots = namedProperty(publish.expression, "slots");
      const updatePort = namedProperty(publish.expression, "update");
      if (
        !element ||
        !ts.isPropertyAssignment(element) ||
        !lexicalIdentity(element.initializer, alias) ||
        !dispose ||
        !ts.isMethodDeclaration(dispose) ||
        !synchronousCallable(dispose) ||
        !slots ||
        !ts.isPropertyAssignment(slots) ||
        !ts.isObjectLiteralExpression(slots.initializer) ||
        slots.initializer.properties.length ||
        !updatePort ||
        !ts.isShorthandPropertyAssignment(updatePort) ||
        declaration(updatePort.name) !== update
      ) {
        return false;
      }
      // Only the initializer executes before the component is handed to Kit. Keep the
      // registration private and allow only local presentation operations on the fresh button.
      const unsafeUpdate = (site: ts.Node): true | undefined => {
        if (ts.isIdentifier(site)) {
          const local = reads(site);
          const member = site.parent;
          if (local === binding || site.text === "eval") {
            return true;
          }
          if (local === handle || local === alias) {
            if (
              !ts.isPropertyAccessExpression(member) ||
              member.expression !== site ||
              member.questionDotToken
            ) {
              return true;
            }
            const use = member.parent;
            const method = member.name.text;
            const call =
              ts.isCallExpression(use) && use.expression === member && !use.questionDotToken;
            const allowed =
              local === handle
                ? call && method === "refresh" && use.arguments.length === 0
                : (call && ["append", "replaceChildren", "setAttribute"].includes(method)) ||
                  ["className", "dataset", "tabIndex"].includes(method);
            if (!allowed) {
              return true;
            }
          }
        }
        return ts.forEachChild(site, unsafeUpdate);
      };
      return !unsafeUpdate(fn) && layoutPublishesComponent(constructor);
    };
    if (publishesLayout()) {
      return true;
    }
    const attempt = tail.find((statement) => !isDeferredDeclaration(singleLocal(statement)));
    if (
      !attempt ||
      !ts.isTryStatement(attempt) ||
      attempt.finallyBlock ||
      attempt.tryBlock.statements.length !== 3
    ) {
      return false;
    }
    const assertion = (step: ts.CallExpression | undefined, kind: RuntimeAssertionKind) => {
      const target = step && canonicalCall(step);
      return Boolean(
        target &&
        context.assertions.get(target) === kind &&
        step?.arguments.length === 1 &&
        lexicalIdentity(step.arguments[0]!, alias),
      );
    };
    const [metadata, mount, live] = attempt.tryBlock.statements.map(callStatement);
    if (
      !assertion(metadata, "metadata") ||
      !assertion(live, "live-root") ||
      !mount ||
      mount.questionDotToken ||
      !dot(mount.expression, "append") ||
      !unwritten(mount.expression) ||
      mount.arguments.length !== 1 ||
      !lexicalIdentity(mount.arguments[0]!, alias)
    ) {
      return false;
    }
    const host = lexicalDeclaration(mount.expression.expression);
    if (
      !domHost(mount.expression.expression) &&
      !(
        host &&
        ts.isVariableDeclaration(host) &&
        isConst(host) &&
        createsNative(host.initializer, "div")
      )
    ) {
      return false;
    }

    const failed = attempt.catchClause;
    const rethrow = failed?.block.statements.at(-1);
    if (
      !failed?.variableDeclaration ||
      !rethrow ||
      !ts.isThrowStatement(rethrow) ||
      !rethrow.expression ||
      !lexicalIdentity(rethrow.expression, failed.variableDeclaration)
    ) {
      return false;
    }
    // Failure may remove this button or dispose its private handles, then must rethrow.
    const rollback = (statement: ts.Statement, followLocal: boolean): boolean => {
      const invocation = callStatement(statement);
      if (!invocation) {
        return false;
      }
      const { arguments: args, expression: callee } = invocation;
      if (ts.isPropertyAccessExpression(callee)) {
        const target = lexicalDeclaration(callee.expression);
        return (
          unwritten(callee) &&
          ((target === alias &&
            ((dot(callee, "remove") && !args.length) ||
              (dot(callee, "removeEventListener") &&
                args.length === 2 &&
                ts.isStringLiteral(args[0]!) &&
                isDeferred(args[1]!)))) ||
            ((target === binding || target === handle) && dot(callee, "dispose") && !args.length))
        );
      }
      const local = lexicalDeclaration(callee);
      if (args.length || !local || !ts.isVariableDeclaration(local)) {
        return false;
      }
      if (!followLocal) {
        // A cancellation slot declared empty before registration cannot run on construction failure.
        return Boolean(
          invocation.questionDotToken &&
          !local.initializer &&
          local.pos > alias.pos &&
          local.pos < binding.pos,
        );
      }
      const cleanup = local.initializer;
      return (
        isConst(local) &&
        local.pos > binding.pos &&
        local.pos < attempt.pos &&
        Boolean(
          cleanup &&
          ts.isArrowFunction(cleanup) &&
          !cleanup.parameters.length &&
          ts.isBlock(cleanup.body) &&
          cleanup.body.statements.every((step) => rollback(step, false)),
        )
      );
    };
    return failed.block.statements.slice(0, -1).every((step) => rollback(step, true));
  };

  const certifiedMemberMetadata = (node: ts.Expression): boolean => {
    const alias = lexicalDeclaration(node);
    if (
      !alias ||
      !ts.isVariableDeclaration(alias) ||
      !isConst(alias) ||
      !alias.initializer ||
      !ts.isPropertyAccessExpression(alias.initializer) ||
      alias.initializer.questionDotToken ||
      alias.end > node.pos ||
      !stable(node, false, constructionLifetimes)
    ) {
      return false;
    }
    const { expression, name } = alias.initializer;
    const factoryResult = origin(expression);
    if (
      !factoryResult ||
      !ts.isVariableDeclaration(factoryResult) ||
      !isConst(factoryResult) ||
      !factoryResult.initializer ||
      !ts.isCallExpression(factoryResult.initializer) ||
      !ts.isIdentifier(factoryResult.initializer.expression) ||
      !factoryFor(factoryResult.initializer.expression)?.has(name.text) ||
      escaped(reference(expression))
    ) {
      return false;
    }
    const owner = phase(node);
    const key = reference(node);
    if (
      lifecycleCalls.some(
        ({ key: disposed, site }) =>
          overlaps(key, disposed) && !returnedMethod(site, owner) && !failureCleanup(site),
      )
    ) {
      return false;
    }
    return (bound.get(key) ?? []).some((proof) => proof.owner === owner && proof.end <= alias.pos);
  };

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
  const callbackFacts = (argument: ts.Expression | undefined, keyboard: boolean) => {
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
    const localConst = (node: ts.Expression) => {
      const value = lexicalDeclaration(node);
      return value &&
        ts.isVariableDeclaration(value) &&
        value.parent.flags & ts.NodeFlags.Const &&
        phase(value) === callback &&
        stable(node)
        ? value.initializer
        : undefined;
    };
    const nativeMethod = (callee: ts.PropertyAccessExpression, ...prototypes: string[]) =>
      !callee.questionDotToken &&
      clean(reference(callee), true) &&
      ![...writes].some((key) =>
        prototypes.some(
          (type) =>
            key.includes(`:${type}.prototype`) &&
            (key.endsWith(".prototype") || key.endsWith(`.${callee.name.text}`)),
        ),
      );
    const elementValue = (node: ts.Expression, throughHelper = false): boolean => {
      if (!ts.isIdentifier(node) || !stable(node) || !clean(`${reference(node)}.closest`)) {
        return false;
      }
      const value = origin(node);
      if (!value || !ts.isVariableDeclaration(value) || !value.initializer) {
        return false;
      }
      const init = value.initializer;
      if (
        ts.isPropertyAccessExpression(init) &&
        !init.questionDotToken &&
        ts.isIdentifier(value.name)
      ) {
        const factoryResult = origin(init.expression);
        const factory =
          factoryResult && ts.isVariableDeclaration(factoryResult) && factoryResult.initializer;
        return Boolean(
          factory &&
          ts.isCallExpression(factory) &&
          ts.isIdentifier(factory.expression) &&
          factoryFor(factory.expression)?.has(init.name.text) &&
          hasBinding(value.name, false, phase(value), value.end),
        );
      }
      if (!ts.isCallExpression(init) || init.questionDotToken) {
        return false;
      }
      const callee = init.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const receiver = callee.expression;
        return (
          callee.name.text === "createElement" &&
          ts.isIdentifier(receiver) &&
          receiver.text === "document" &&
          !lexicalDeclaration(receiver) &&
          nativeMethod(callee, "Document", "HTMLDocument") &&
          init.arguments.length === 1 &&
          ts.isStringLiteral(init.arguments[0]!)
        );
      }
      if (throughHelper || !ts.isIdentifier(callee) || !stable(callee)) {
        return false;
      }
      const helper = lexicalValue(callee);
      const fn = helper && ts.isVariableDeclaration(helper) ? helper.initializer : undefined;
      if (!fn || !ts.isArrowFunction(fn) || !synchronousCallable(fn) || !ts.isBlock(fn.body)) {
        return false;
      }
      const result = fn.body.statements.at(-1);
      return Boolean(
        result &&
        ts.isReturnStatement(result) &&
        result.expression &&
        immediateWrapperCall(result.expression, fn) &&
        elementValue(result.expression, true),
      );
    };
    const focusQuery = (node: ts.Expression): boolean =>
      ts.isCallExpression(node) &&
      !node.questionDotToken &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "querySelectorAll" &&
      nativeMethod(node.expression, "Element", "HTMLElement") &&
      elementValue(node.expression.expression) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]!);
    const visibilityPredicate = (node: ts.Expression): boolean => {
      if (
        !ts.isArrowFunction(node) ||
        !synchronousCallable(node) ||
        node.parameters.length !== 1 ||
        !ts.isIdentifier(node.parameters[0]!.name) ||
        node.parameters[0]!.initializer ||
        !ts.isBinaryExpression(node.body) ||
        node.body.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        return false;
      }
      const own = (value: ts.Expression, method: string): value is ts.PropertyAccessExpression =>
        ts.isPropertyAccessExpression(value) &&
        !value.questionDotToken &&
        value.name.text === method &&
        lexicalIdentity(value.expression, node.parameters[0]!);
      const { left, right } = node.body;
      if (
        !ts.isPrefixUnaryExpression(left) ||
        left.operator !== ts.SyntaxKind.ExclamationToken ||
        !ts.isCallExpression(left.operand) ||
        left.operand.questionDotToken ||
        !own(left.operand.expression, "closest") ||
        !nativeMethod(left.operand.expression, "Element", "HTMLElement") ||
        left.operand.arguments.length !== 1 ||
        !ts.isStringLiteral(left.operand.arguments[0]!) ||
        [...writes].some((key) => key.endsWith(".closest"))
      ) {
        return false;
      }
      return (
        ts.isPrefixUnaryExpression(right) &&
        right.operator === ts.SyntaxKind.ExclamationToken &&
        own(right.operand, "hidden")
      );
    };
    const focusFilter = (node: ts.CallExpression): boolean => {
      if (
        !keyboard ||
        node.questionDotToken ||
        !ts.isPropertyAccessExpression(node.expression) ||
        node.expression.name.text !== "filter" ||
        !nativeMethod(node.expression, "Array") ||
        node.arguments.length !== 1 ||
        !visibilityPredicate(node.arguments[0]!)
      ) {
        return false;
      }
      const order = localConst(node.expression.expression);
      return Boolean(
        order &&
        ts.isArrayLiteralExpression(order) &&
        order.elements.every((item) =>
          ts.isSpreadElement(item) ? focusQuery(item.expression) : elementValue(item),
        ),
      );
    };
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
        (ts.isArrayLiteralExpression(value.initializer) ||
          (localConst(node) &&
            ts.isCallExpression(value.initializer) &&
            focusFilter(value.initializer))),
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
        keyboard &&
        ts.isSpreadElement(node) &&
        ts.isArrayLiteralExpression(node.parent) &&
        focusQuery(node.expression)
      ) {
        return;
      }
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
        if (focusFilter(node)) {
          // The predicate was checked in full. Other nested callbacks remain unresolved.
          return;
        }
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
          (!keyboard || nativeMethod(callee, "Array")) &&
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
  // Registration proves input ownership. The standard skin also needs Kit construction.
  const checkStandardButtonClass = (
    site: ts.Node,
    target: ts.Expression,
    classes: readonly ts.Expression[],
  ) => {
    if (
      !classes.some((value) =>
        strings(value).some((text) => text.split(/\s+/u).includes("ada-button")),
      )
    ) {
      return;
    }
    const control = origin(target);
    if (
      control &&
      ts.isVariableDeclaration(control) &&
      ts.isIdentifier(control.name) &&
      unwritten(target) &&
      unwritten(control.name) &&
      createsNative(control.initializer, "button")
    ) {
      record(
        "raw-standard-button",
        site,
        undefined,
        "A native button uses the Ada standard text skin without Kit construction",
      );
    }
  };

  // Only eager construction in the handle's own block can precede its teardown.
  const recoveryAssertion = (call: ts.CallExpression, member: ts.PropertyAccessExpression) => {
    const handle = member.expression;
    const value = lexicalDeclaration(handle);
    if (
      call.questionDotToken ||
      member.questionDotToken ||
      call.arguments.length ||
      !value ||
      !ts.isVariableDeclaration(value) ||
      !(value.parent.flags & ts.NodeFlags.Const) ||
      !ts.isIdentifier(handle) ||
      !value.initializer ||
      !ts.isCallExpression(value.initializer) ||
      value.initializer.arguments.length !== 2 ||
      value.initializer.arguments.some(ts.isSpreadElement) ||
      !context.recoveryRoot ||
      canonicalCall(value.initializer) !== context.recoveryRoot ||
      !ts.isExpressionStatement(call.parent)
    ) {
      return false;
    }
    const declaration = value.parent.parent;
    const block = declaration.parent;
    if (!ts.isVariableStatement(declaration) || !ts.isBlock(block)) {
      return false;
    }
    const host = lexicalDeclaration(value.initializer.arguments[1]!);
    const created = host && ts.isVariableDeclaration(host) ? host.initializer : undefined;
    const creator = created && ts.isCallExpression(created) ? created.expression : undefined;
    const hostDocument =
      creator && ts.isPropertyAccessExpression(creator) ? creator.expression : undefined;
    const owner =
      hostDocument && ts.isPropertyAccessExpression(hostDocument)
        ? lexicalDeclaration(hostDocument.expression)
        : undefined;
    if (
      !host ||
      !ts.isVariableDeclaration(host) ||
      !(host.parent.flags & ts.NodeFlags.Const) ||
      host.parent.parent.parent !== block ||
      host.end >= declaration.getStart(source) ||
      !created ||
      !ts.isCallExpression(created) ||
      created.questionDotToken ||
      created.arguments.length !== 1 ||
      !ts.isStringLiteralLike(created.arguments[0]!) ||
      !creator ||
      !ts.isPropertyAccessExpression(creator) ||
      creator.questionDotToken ||
      creator.name.text !== "createElement" ||
      !hostDocument ||
      !ts.isPropertyAccessExpression(hostDocument) ||
      hostDocument.questionDotToken ||
      hostDocument.name.text !== "ownerDocument" ||
      !owner ||
      !ts.isParameter(owner) ||
      owner.parent !== block.parent ||
      !directRecoveryReads(context, block, host) ||
      !directRecoveryReads(context, block.parent, owner)
    ) {
      return false;
    }
    let statement: ts.Statement = call.parent;
    const tryBlock = statement.parent;
    const attempt = tryBlock.parent;
    const cleanup =
      ts.isBlock(tryBlock) && ts.isTryStatement(attempt) && attempt.tryBlock === tryBlock
        ? attempt.catchClause
        : undefined;
    if (ts.isBlock(tryBlock) && ts.isTryStatement(attempt) && attempt.tryBlock === tryBlock) {
      statement = attempt;
    }
    if (statement.parent !== block) {
      const body = statement.parent;
      const fn = body.parent;
      if (
        !ts.isBlock(body) ||
        !ts.isArrowFunction(fn) ||
        fn.body !== body ||
        fn.modifiers?.length ||
        fn.parameters.length ||
        !ts.isParenthesizedExpression(fn.parent)
      ) {
        return false;
      }
      const invoke = fn.parent.parent;
      const result = invoke.parent;
      if (
        !ts.isCallExpression(invoke) ||
        invoke.expression !== fn.parent ||
        invoke.questionDotToken ||
        invoke.arguments.length ||
        !ts.isVariableDeclaration(result) ||
        result.initializer !== invoke ||
        !ts.isVariableStatement(result.parent.parent)
      ) {
        return false;
      }
      statement = result.parent.parent;
    }
    if (statement.parent !== block || declaration.end >= statement.getStart(source)) {
      return false;
    }
    let safe = true;
    const inspect = (node: ts.Node): void => {
      if (!safe) {
        return;
      }
      if (ts.isWithStatement(node) || (ts.isIdentifier(node) && node.text === "eval")) {
        safe = false;
      } else if (
        ts.isIdentifier(node) &&
        node !== value.name &&
        node.text === handle.text &&
        (lexicalIdentity(node, value) || ts.isShorthandPropertyAssignment(node.parent))
      ) {
        const use = node.parent;
        if (
          !ts.isPropertyAccessExpression(use) ||
          use.expression !== node ||
          !ts.isCallExpression(use.parent) ||
          use.parent.expression !== use ||
          !["assertBindings", "invalidate", "dispose"].includes(use.name.text)
        ) {
          safe = false;
        } else if (use.name.text === "dispose") {
          // A sibling catch can only run after the attempt has thrown. Later closure
          // declarations may tear down the handle, but a hoisted function can run earlier.
          const inCatch = cleanup && node.pos >= cleanup.pos && node.end <= cleanup.end;
          const later = node.getStart(source) >= statement.end;
          let owner: ts.Node | undefined = node;
          while (owner && owner.parent !== block && !ts.isFunctionDeclaration(owner)) {
            owner = owner.parent;
          }
          safe = Boolean(inCatch || (later && owner && !ts.isFunctionDeclaration(owner)));
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(block);
    return safe;
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
        if (
          recoveryAssertion(node, callee) ||
          guardedRecoveryAssertion(
            node,
            callee,
            lexicalDeclaration,
            (factory) =>
              context.recoveryRoot !== undefined && canonicalCall(factory) === context.recoveryRoot,
          )
        ) {
          runtimeAssertions.push({ ...assertionSite(node), kind: "live-root" });
        } else {
          unresolvedRuntimeAssertions.push(assertionSite(node));
        }
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
        const discrete = names.some((name) => ["click", "dblclick"].includes(name));
        const pointer = names.some((name) =>
          /^(?:(?:got|lost)pointercapture$|pointer|touch|mouse|wheel|keydown|keyup)/.test(name),
        );
        const editing = names.some((name) => ["input", "change", "beforeinput"].includes(name));
        const keyboard =
          names.length > 0 && names.every((name) => ["keydown", "keyup"].includes(name));
        const facts = callbackFacts(node.arguments[1], keyboard);
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
        } else if (discrete && capturedSuppressors.has(node)) {
          record(
            "non-action",
            node,
            "suppressor",
            "Bubble listener only consumes the factory's accepted click and stops propagation",
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
      if (dot(callee, "add") && dot(callee.expression, "classList")) {
        checkStandardButtonClass(node, callee.expression.expression, node.arguments);
      }
      if (dot(callee, "setAttribute") && literal(node.arguments[0], "class") && node.arguments[1]) {
        checkStandardButtonClass(node, callee.expression, [node.arguments[1]]);
      }
      const kitButton = kitDomImport("createButton", "button", callee);
      if (kitButton || createsButton(node)) {
        const target =
          ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)
            ? node.parent.name
            : node;
        if (
          kitButton
            ? !registeredKitElement(node)
            : !hasBinding(target, true) && !capturedConstruction(target)
        ) {
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
        if (left.name.text === "className") {
          checkStandardButtonClass(node, left.expression, [node.right]);
        }
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
          !immediateButtonRegistration(node, target) &&
          !capturedConstruction(target, node) &&
          !(isActionId && certifiedMemberMetadata(target))
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
