import ts from "typescript";

type ResolveDeclaration = (node: ts.Expression) => ts.Declaration | undefined;

function binary(node: ts.Expression | undefined, operator: ts.SyntaxKind) {
  return node && ts.isBinaryExpression(node) && node.operatorToken.kind === operator
    ? node
    : undefined;
}

function expression(statement: ts.Statement | undefined) {
  return statement && ts.isExpressionStatement(statement) ? statement.expression : undefined;
}

function singleVariable(statement: ts.Statement | undefined, kind: ts.NodeFlags) {
  if (!statement || !ts.isVariableStatement(statement) || statement.modifiers?.length) {
    return undefined;
  }
  const { declarations, flags } = statement.declarationList;
  return declarations.length === 1 && flags & kind && ts.isIdentifier(declarations[0]!.name)
    ? declarations[0]
    : undefined;
}

function member(node: ts.Expression | undefined, name: string) {
  return node && ts.isPropertyAccessExpression(node) && node.name.text === name ? node : undefined;
}

function memberCall(statement: ts.Statement, name: string) {
  const call = expression(statement);
  return call && ts.isCallExpression(call) && !call.questionDotToken && !call.arguments.length
    ? member(call.expression, name)
    : undefined;
}

function privateReferences(
  source: ts.SourceFile,
  resolve: ResolveDeclaration,
  identifiers: ReadonlyMap<ts.VariableDeclaration, ReadonlySet<ts.Expression>>,
) {
  const names = new Set(
    [...identifiers.keys()].flatMap(({ name }) => (ts.isIdentifier(name) ? [name.text] : [])),
  );
  const unsafe = (node: ts.Node): true | undefined => {
    if (ts.isWithStatement(node) || (ts.isIdentifier(node) && node.text === "eval")) {
      return true;
    }
    if (ts.isIdentifier(node) && names.has(node.text)) {
      // Shorthand properties and exports can resolve to the alias rather than the local value.
      if (ts.isShorthandPropertyAssignment(node.parent) || ts.isExportSpecifier(node.parent)) {
        return true;
      }
      const declaration = resolve(node);
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        identifiers.has(declaration) &&
        declaration.name !== node &&
        !identifiers.get(declaration)?.has(node)
      ) {
        return true;
      }
    }
    return ts.forEachChild(node, unsafe);
  };
  return !unsafe(source);
}

/**
 * An opaque call may reach teardown. The last two checks must therefore read the private
 * slot and the captured record immediately before invoking the record's own assertion.
 */
export function guardedRecoveryAssertion(
  call: ts.CallExpression,
  access: ts.PropertyAccessExpression,
  resolve: ResolveDeclaration,
  isRecoveryFactory: (call: ts.CallExpression) => boolean,
): boolean {
  const root = member(access.expression, "root");
  const statement = call.parent;
  const assertionBlock = statement.parent;
  const guard = assertionBlock.parent;
  if (
    !root ||
    root.questionDotToken ||
    access.questionDotToken ||
    call.questionDotToken ||
    call.arguments.length ||
    !ts.isExpressionStatement(statement) ||
    !ts.isBlock(assertionBlock) ||
    assertionBlock.statements.length !== 1 ||
    !ts.isIfStatement(guard) ||
    guard.thenStatement !== assertionBlock ||
    guard.elseStatement ||
    !ts.isBlock(guard.parent)
  ) {
    return false;
  }
  const body = guard.parent;
  const captured = resolve(root.expression);
  if (!captured || !ts.isVariableDeclaration(captured) || !captured.initializer) {
    return false;
  }
  const capture = captured.parent.parent;
  if (
    captured !== singleVariable(capture, ts.NodeFlags.Const) ||
    capture.parent !== body ||
    capture.end >= guard.getStart()
  ) {
    return false;
  }
  const fromSlot = captured.initializer;
  const slot = resolve(fromSlot);
  const source = call.getSourceFile();
  if (
    !slot ||
    !ts.isVariableDeclaration(slot) ||
    slot !== singleVariable(slot.parent.parent, ts.NodeFlags.Let) ||
    slot.parent.parent.parent !== source ||
    slot.initializer ||
    !ts.isExternalModule(source)
  ) {
    return false;
  }

  const suffix = binary(guard.expression, ts.SyntaxKind.AmpersandAmpersandToken);
  const prefix = binary(suffix?.left, ts.SyntaxKind.AmpersandAmpersandToken);
  const same = binary(prefix?.right, ts.SyntaxKind.EqualsEqualsEqualsToken);
  const live = member(suffix?.right, "live");
  if (
    !same ||
    resolve(same.left) !== slot ||
    resolve(same.right) !== captured ||
    !live ||
    live.questionDotToken ||
    resolve(live.expression) !== captured
  ) {
    return false;
  }

  const captureIndex = body.statements.indexOf(capture);
  const initialize = body.statements[captureIndex - 1];
  const rejectHost = body.statements[captureIndex - 2];
  if (
    !initialize ||
    !ts.isIfStatement(initialize) ||
    initialize.elseStatement ||
    !ts.isPrefixUnaryExpression(initialize.expression) ||
    initialize.expression.operator !== ts.SyntaxKind.ExclamationToken ||
    resolve(initialize.expression.operand) !== slot ||
    !ts.isBlock(initialize.thenStatement) ||
    !rejectHost ||
    !ts.isIfStatement(rejectHost) ||
    rejectHost.elseStatement ||
    !ts.isBlock(rejectHost.thenStatement) ||
    rejectHost.thenStatement.statements.length !== 1 ||
    !ts.isThrowStatement(rejectHost.thenStatement.statements[0]!)
  ) {
    return false;
  }
  const initialized = binary(
    expression(initialize.thenStatement.statements[0]),
    ts.SyntaxKind.EqualsToken,
  );
  const hostGuard = binary(rejectHost.expression, ts.SyntaxKind.AmpersandAmpersandToken);
  const differentHost = binary(hostGuard?.right, ts.SyntaxKind.ExclamationEqualsEqualsToken);
  const rememberedHost = member(differentHost?.left, "host");
  if (
    !initialized ||
    resolve(initialized.left) !== slot ||
    !ts.isObjectLiteralExpression(initialized.right) ||
    !hostGuard ||
    resolve(hostGuard.left) !== slot ||
    !differentHost ||
    !rememberedHost ||
    rememberedHost.questionDotToken ||
    resolve(rememberedHost.expression) !== slot
  ) {
    return false;
  }

  const properties = initialized.right.properties;
  const find = (name: string) => properties.find((part) => part.name?.getText(source) === name);
  const rootField = find("root");
  const hostField = find("host");
  const bindField = find("bind");
  const liveField = find("live");
  if (
    properties.length !== 4 ||
    !rootField ||
    !ts.isPropertyAssignment(rootField) ||
    !hostField ||
    !ts.isShorthandPropertyAssignment(hostField) ||
    !bindField ||
    !ts.isPropertyAssignment(bindField) ||
    !liveField ||
    !ts.isPropertyAssignment(liveField) ||
    liveField.initializer.kind !== ts.SyntaxKind.TrueKeyword
  ) {
    return false;
  }
  const factory = rootField.initializer;
  const host = resolve(differentHost.right);
  if (
    !host ||
    !ts.isVariableDeclaration(host) ||
    host !== singleVariable(host.parent.parent, ts.NodeFlags.Const) ||
    host.parent.parent.parent !== body ||
    host.end >= rejectHost.getStart(source) ||
    !ts.isIdentifier(differentHost.right) ||
    hostField.name.text !== differentHost.right.text ||
    !ts.isCallExpression(factory) ||
    factory.arguments.length !== 2 ||
    factory.arguments.some(ts.isSpreadElement) ||
    resolve(factory.arguments[1]!) !== host ||
    !isRecoveryFactory(factory)
  ) {
    return false;
  }

  // The bind callable is read from the record and called without the record as its receiver.
  const detached = singleVariable(body.statements[captureIndex + 1], ts.NodeFlags.Const);
  const binding = member(detached?.initializer, "bind");
  if (!binding || binding.questionDotToken || resolve(binding.expression) !== captured) {
    return false;
  }

  // The only other slot capture retires the record before any call can dispose it.
  const retirements = source.statements.flatMap((item) => {
    const callback = singleVariable(item, ts.NodeFlags.Const)?.initializer;
    if (!callback || !ts.isArrowFunction(callback) || !ts.isBlock(callback.body)) {
      return [];
    }
    const statements = callback.body.statements;
    const retired = singleVariable(statements[0], ts.NodeFlags.Const);
    return retired?.initializer && resolve(retired.initializer) === slot
      ? [{ fromSlot: retired.initializer, retired, statements }]
      : [];
  });
  if (retirements.length !== 1) {
    return false;
  }
  const { fromSlot: retireSlot, retired, statements } = retirements[0]!;
  const retire = statements[1];
  if (
    !retire ||
    !ts.isIfStatement(retire) ||
    retire.elseStatement ||
    resolve(retire.expression) !== retired ||
    !ts.isBlock(retire.thenStatement) ||
    retire.thenStatement.statements.length !== 1
  ) {
    return false;
  }
  const clearLive = binary(
    expression(retire.thenStatement.statements[0]),
    ts.SyntaxKind.EqualsToken,
  );
  const retiringLive = member(clearLive?.left, "live");
  const invalidated =
    statements[2] && member(memberCall(statements[2], "invalidate")?.expression, "root");
  const disposed = statements.flatMap((item) => {
    const receiver = member(memberCall(item, "dispose")?.expression, "root");
    return receiver && resolve(receiver.expression) === retired ? [receiver] : [];
  });
  const reset = statements.flatMap((item) => {
    const assignment = binary(expression(item), ts.SyntaxKind.EqualsToken);
    return assignment &&
      resolve(assignment.left) === slot &&
      ts.isIdentifier(assignment.right) &&
      assignment.right.text === "undefined" &&
      !resolve(assignment.right)
      ? [assignment]
      : [];
  });
  if (
    !clearLive ||
    clearLive.right.kind !== ts.SyntaxKind.FalseKeyword ||
    !retiringLive ||
    retiringLive.questionDotToken ||
    resolve(retiringLive.expression) !== retired ||
    !invalidated ||
    resolve(invalidated.expression) !== retired ||
    disposed.length !== 1 ||
    reset.length !== 1 ||
    disposed[0]!.end >= reset[0]!.pos
  ) {
    return false;
  }

  const slotUses = new Set([
    hostGuard.left,
    rememberedHost.expression,
    initialize.expression.operand,
    initialized.left,
    fromSlot,
    same.left,
    retireSlot,
    reset[0]!.left,
  ]);
  const capturedUses = new Set([root.expression, same.right, live.expression, binding.expression]);
  // A caller may release an incompletely bound action before adding it to its cleanup list.
  for (const item of body.statements.slice(captureIndex + 1, body.statements.indexOf(guard))) {
    const early = ts.isIfStatement(item) && binary(item.expression, ts.SyntaxKind.BarBarToken);
    const changed = early && binary(early.left, ts.SyntaxKind.ExclamationEqualsEqualsToken);
    const inactive =
      early &&
      ts.isPrefixUnaryExpression(early.right) &&
      early.right.operator === ts.SyntaxKind.ExclamationToken &&
      member(early.right.operand, "live");
    if (
      changed &&
      resolve(changed.left) === slot &&
      resolve(changed.right) === captured &&
      inactive &&
      !inactive.questionDotToken &&
      resolve(inactive.expression) === captured
    ) {
      slotUses.add(changed.left);
      capturedUses.add(changed.right);
      capturedUses.add(inactive.expression);
    }
  }
  return privateReferences(
    source,
    resolve,
    new Map([
      [slot, slotUses],
      [captured, capturedUses],
      [
        retired,
        new Set([
          retire.expression,
          retiringLive.expression,
          invalidated.expression,
          disposed[0]!.expression,
        ]),
      ],
    ]),
  );
}
