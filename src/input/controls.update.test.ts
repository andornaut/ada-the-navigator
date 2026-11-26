import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { expect, it, vi } from "vitest";

import { createUpdateOffer, type UpdateOffer } from "../pwa/updateOffer.ts";
import { ControlState } from "./state.ts";

const source = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("./controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const factory = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "createControls",
)!;
const setup = factory.body!.statements.filter((statement) => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some((declaration) =>
      [
        "creatingUpdate",
        "modalOpen",
        "navigationCovered",
        "syncNavigationEntry",
        "update",
      ].includes(declaration.name.getText(source)),
    );
  }
  if (ts.isFunctionDeclaration(statement)) {
    return statement.name?.text === "syncModal";
  }
  return (
    ts.isExpressionStatement(statement) &&
    ts.isBinaryExpression(statement.expression) &&
    statement.expression.left.getText(source) === "creatingUpdate"
  );
});
const adapter = ts.transpileModule(
  [
    "let disposed = false;",
    ...setup.map((statement) => statement.getText(source)),
    "({ dispose() { disposed = true; update?.dispose(); } })",
  ].join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2023 } },
).outputText;

function harness(cached: boolean) {
  const state = new ControlState();
  const save = vi.fn();
  const offer = createUpdateOffer({ save });
  const next = { dismiss: vi.fn(), updateNow: vi.fn(async () => {}), version: "next" };
  if (cached) {
    offer.offer(next);
  }
  let owned = false;
  const onPauseChange = vi.fn<(paused: boolean) => void>(() => expect(owned).toBe(true));
  const pauseButton = { hidden: true, inert: false };
  const closed = { isOpen: () => false };
  const owner = runInNewContext(adapter, {
    HTMLElement: class {},
    achievements: closed,
    cheats: closed,
    createUpdateDialog(
      _root: unknown,
      _host: unknown,
      _labels: unknown,
      bridge: UpdateOffer,
      _restoreFocus: unknown,
      sync: () => void,
    ) {
      let open = false;
      const dispose = bridge.subscribe((visible) => {
        if (open !== visible) {
          open = visible;
          sync();
        }
      });
      return { dispose, isOpen: () => open };
    },
    desktop: { reset: vi.fn() },
    document: { activeElement: null },
    enabled: true,
    exitButton: undefined,
    host: undefined,
    inCurrentView: () => true,
    menu: closed,
    navigation: { setMode: vi.fn() },
    options: { onPauseChange, update: { offer } },
    pausable: true,
    pause: { ...closed, mapOpen: () => false },
    pauseButton,
    queueMicrotask,
    resource: closed,
    returnToMenu: undefined,
    returnToPause: undefined,
    returningToParent: false,
    settings: { ...closed, root: { classList: { toggle: vi.fn() } } },
    state,
    status: { setShown: vi.fn() },
    weaponDetail: closed,
    weapons: { setEnabled: vi.fn() },
  }) as { dispose(): void };
  owned = true;
  return { next, offer, onPauseChange, owner, pauseButton, save, state };
}

it("synchronizes a cached ready offer once the scene owns its controls", async () => {
  const f = harness(true);
  expect(f.onPauseChange).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(f.onPauseChange.mock.calls).toEqual([[true]]);
  expect(f.pauseButton.inert).toBe(true);
  expect(f.state.accepts()).toBe(false);
  f.offer.defer();
  expect(f.onPauseChange.mock.calls).toEqual([[true], [false]]);
  expect(f.pauseButton.inert).toBe(false);
  expect(f.state.accepts()).toBe(true);
  expect(f.next.dismiss).toHaveBeenCalledOnce();
  expect(f.next.updateNow).not.toHaveBeenCalled();
  expect(f.save).not.toHaveBeenCalled();
});

it("pauses active controls synchronously when the verified offer arrives", async () => {
  const f = harness(false);
  expect(f.state.accepts()).toBe(true);
  f.offer.offer(f.next);
  expect(f.onPauseChange.mock.calls).toEqual([[true]]);
  expect(f.state.accepts()).toBe(false);
  expect(f.next.updateNow).not.toHaveBeenCalled();
  f.offer.accept();
  expect(f.next.updateNow).toHaveBeenCalledExactlyOnceWith(f.save);
  await Promise.resolve();
  expect(f.onPauseChange.mock.calls).toEqual([[true], [false]]);
});

it("ignores a queued cached replay after its controls have been disposed", async () => {
  const f = harness(true);
  f.owner.dispose();
  await Promise.resolve();
  expect(f.onPauseChange).not.toHaveBeenCalled();
});
