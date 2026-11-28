import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { isMenuExitKey } from "./desktop.ts";
import { type ControlSample, ControlState } from "./state.ts";

const source = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("./controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function actual(name: string, method = false): string {
  let result: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (
      (method && ts.isMethodDeclaration(node) && node.name.getText(source) === name) ||
      (!method && ts.isVariableDeclaration(node) && node.name.getText(source) === name)
    ) {
      result = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!result) {
    throw new Error(`Missing actual controls adapter: ${name}`);
  }
  return result.getText(source);
}
function harness(required?: () => boolean) {
  const state = new ControlState();
  const exit = vi.fn();
  const back = vi.fn(() => false);
  const navigation = vi.fn();
  const desktop = {
    reset: vi.fn(),
    sample: vi.fn(() => ({ aim: { x: 1, y: 0 }, fire: true, move: { x: 0, y: 1 }, turn: 1 })),
  };
  const actionRoot = { invalidate: vi.fn() };
  const weapons = { setEnabled: vi.fn() };
  const editable = { closest: () => true };
  class Element {
    closest() {
      return false;
    }
  }
  Object.setPrototypeOf(editable, Element.prototype);
  const sandbox = createContext({
    CONTROL_KEYS: new Set(["KeyW", "Space"]),
    Element,
    HTMLElement: Element,
    actionRoot,
    backStack: { anyOpen: () => false, back },
    coarsePointer: () => true,
    consumeContextQuestUse: vi.fn(
      (_resolve: unknown, _open: unknown, sample: ControlSample) => sample,
    ),
    desktop,
    desktopBinding: { active: () => false, touchActive: () => false },
    disposed: false,
    document: { hidden: false },
    exit: {
      activate() {
        exit();
        return true;
      },
    },
    foregroundRoot: { closest: () => null, isConnected: true },
    isMenuExitKey,
    menuContext: "start",
    modalOpen: () => false,
    openNavigation: navigation,
    options: { requiredReady: required },
    pause: { openContextQuests: vi.fn() },
    state,
    weapons,
    window: {},
  });
  const text = [
    "let enabled = true;",
    `const ${actual("requiredReady")};`,
    `const ${actual("openContextQuests")};`,
    `const ${actual("reset")};`,
    `const ${actual("keyDown")};`,
    `const ${actual("keyUp")};`,
    `const ${actual("gameEscape")};`,
    `({keyDown, keyUp, gameEscape, ${actual("sample", true)}, ${actual("setEnabled", true)}})`,
  ].join("\n");
  const adapter = runInContext(
    ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
    sandbox,
  ) as {
    keyDown(event: object): void;
    keyUp(event: object): void;
    gameEscape(): (() => void) | undefined;
    sample(frame?: object): ControlSample;
    setEnabled(value: boolean): void;
  };
  const key = (
    code: string,
    repeat = false,
    target: object | null = null,
    flags: KeyboardEventInit = {},
  ) => {
    const event = { ...flags, code, preventDefault: vi.fn(), repeat, target };
    adapter.keyDown(event);
    return event;
  };
  return {
    actionRoot,
    adapter,
    back,
    desktop,
    editable,
    escape: adapter.gameEscape,
    exit,
    key,
    navigation,
    state,
    weapons,
  };
}

describe("required-entry controls fence", () => {
  it("blocks early Q and Escape before readiness even while gameplay accepts input", () => {
    const h = harness(() => false);
    expect(h.state.accepts()).toBe(true);
    expect(h.key("KeyQ").preventDefault).not.toHaveBeenCalled();
    expect(h.escape()).toBeUndefined();
    expect(h.exit).not.toHaveBeenCalled();
    expect(h.back).not.toHaveBeenCalled();
    expect(h.navigation).not.toHaveBeenCalled();
  });

  it.each([false, true])("preserves ready navigation with callback absent=%s", (absent) => {
    const h = harness(absent ? undefined : () => true);
    h.key("KeyQ");
    h.escape()?.();
    expect(h.exit).toHaveBeenCalledTimes(1);
    expect(h.back).toHaveBeenCalledTimes(1);
    expect(h.navigation).toHaveBeenCalledTimes(1);
    h.key("KeyQ", true);
    h.key("KeyQ", false, h.editable);
    expect(h.exit).toHaveBeenCalledTimes(1);
    expect(h.back).toHaveBeenCalledTimes(1);
  });

  it("uses the live predicate for navigation without requiring gameplay acceptance", () => {
    let ready = false;
    const h = harness(() => ready);
    h.adapter.setEnabled(false);
    h.escape()?.();
    ready = true;
    expect(h.state.accepts()).toBe(false);
    h.escape()?.();
    expect(h.back).toHaveBeenCalledTimes(1);
  });

  it("rejects preentry enabling and requires the existing enable commit after readiness", () => {
    let ready = false;
    const h = harness(() => ready);
    h.adapter.setEnabled(true);
    expect(h.state.accepts()).toBe(false);
    expect(h.weapons.setEnabled).toHaveBeenLastCalledWith(false);
    ready = true;
    expect(h.state.accepts()).toBe(false);
    h.adapter.setEnabled(true);
    expect(h.state.accepts()).toBe(true);
    expect(h.weapons.setEnabled).toHaveBeenLastCalledWith(true);
  });

  it("flushes pending touch, use and desktop input while sampling is not ready", () => {
    const h = harness(() => false);
    h.state.setUseAvailable(true);
    h.state.keyDown("KeyW");
    h.state.keyDown("Space");
    expect(h.adapter.sample({})).toEqual({ aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(h.desktop.sample).not.toHaveBeenCalled();
    expect(h.desktop.reset).toHaveBeenCalledTimes(1);
    expect(h.state.sample().use).toBe(false);
  });

  it("requires a fresh press after blocked keys and modal rearm, then preserves continuous sampling", () => {
    let ready = false;
    const h = harness(() => ready);
    h.key("KeyW");
    h.adapter.sample();
    ready = true;
    h.key("KeyW", true);
    expect(h.adapter.sample().move.y).toBe(0);
    h.key("KeyW");
    expect(h.adapter.sample().move.y).toBe(-1);
    expect(h.adapter.sample().move.y).toBe(-1);
    h.state.openModal();
    h.state.closeModal();
    h.key("KeyW", true);
    expect(h.adapter.sample().move.y).toBe(0);
    h.key("KeyW");
    expect(h.adapter.sample().move.y).toBe(-1);
  });
});

it.each(["altKey", "ctrlKey", "metaKey", "isComposing"] as const)(
  "passes %s through before bare Start Exit or coarse-pointer gameplay handling",
  (flag) => {
    const h = harness(() => true);
    h.state.setUseAvailable(true);
    const flags = { [flag]: true };
    const exit = h.key("KeyQ", false, null, flags);
    const move = h.key("KeyW", false, null, flags);
    const use = h.key("Space", false, null, flags);
    const sample = h.adapter.sample();
    expect({
      exit: h.exit.mock.calls.length,
      move: sample.move,
      prevented: [exit, move, use].map((event) => event.preventDefault.mock.calls.length),
      use: sample.use,
    }).toEqual({ exit: 0, move: { x: 0, y: 0 }, prevented: [0, 0, 0], use: false });
  },
);

it("keeps bare Q, Shift with movement, fresh Space Use and modifier-independent keyup", () => {
  const h = harness(() => true);
  h.state.setUseAvailable(true);
  expect(h.key("KeyQ").preventDefault).toHaveBeenCalledOnce();
  expect(h.exit).toHaveBeenCalledOnce();
  expect(h.key("KeyW", false, null, { shiftKey: true }).preventDefault).toHaveBeenCalledOnce();
  expect(h.key("Space").preventDefault).toHaveBeenCalledOnce();
  expect(h.adapter.sample()).toMatchObject({ move: { x: 0, y: -1 }, use: true });
  h.adapter.keyUp({ code: "KeyW", ctrlKey: true, isComposing: true });
  expect(h.adapter.sample()).toMatchObject({ move: { x: 0, y: 0 }, use: false });
});

it("attaches one UI-scoped root with the canonical readiness ports independently of gameplay acceptance", () => {
  let ready = false;
  const subscribe = vi.fn(() => () => {});
  const root = {};
  const uiGuard = {};
  const bind = vi.fn(() => ({}));
  const sandbox = createContext({
    bindAdaActionRoot: bind,
    document: {},
    options: { requiredReady: () => ready, subscribeRequired: subscribe },
    rootPressGuard: (element: unknown) => {
      expect(element).toBe(root);
      return uiGuard;
    },
    settings: { root },
    state: { accepts: () => false },
  });
  runInContext(
    ts.transpileModule(`const ${actual("requiredReady")}; const ${actual("actionRoot")};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    sandbox,
  );
  expect(bind).toHaveBeenCalledOnce();
  const [policy, element] = bind.mock.calls[0] as unknown as [
    { guard: unknown; requiredReady: () => boolean; subscribeRequired: typeof subscribe },
    unknown,
  ];
  expect(element).toBe(root);
  expect(policy.guard).toBe(uiGuard);
  expect(policy.subscribeRequired).toBe(subscribe);
  expect(policy.requiredReady()).toBe(false);
  ready = true;
  expect(policy.requiredReady()).toBe(true);
});

it("invalidates the existing UI capture scope on reset and enabled-state transitions", () => {
  const h = harness(() => true);
  h.adapter.setEnabled(false);
  expect(h.actionRoot.invalidate).toHaveBeenCalledOnce();
  h.adapter.setEnabled(false);
  expect(h.actionRoot.invalidate).toHaveBeenCalledOnce();
  h.adapter.setEnabled(true);
  expect(h.actionRoot.invalidate).toHaveBeenCalledTimes(2);
});
