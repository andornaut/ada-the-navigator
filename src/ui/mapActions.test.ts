import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";

import { bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { bindAdaHoldActions } from "./holdActionsAdapter.ts";
import { MAP_SCREEN } from "./layout/mapScreen.ts";
import { enterPressView, inCurrentView, rootPressGuard } from "./pressScope.ts";

const source = ts.createSourceFile(
  "mapScreen.ts",
  readFileSync(new URL("./mapScreen.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function actual(name: string): string {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      found = node.initializer;
    }
    if (
      name === "travel" &&
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "registerAction" &&
      node.arguments[1]?.getText(source) === "travel"
    ) {
      found = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) {
    throw new Error(`Missing actual Map action ${name}`);
  }
  return found.getText(source);
}
class Element extends EventTarget {
  parentElement: Element | null = null;
  hidden = false;
  inert = false;
  disabled = false;
  connected = true;
  readonly attributes = new Map<string, string>();
  readonly ownerDocument: FixtureDocument;
  constructor(ownerDocument: FixtureDocument) {
    super();
    this.ownerDocument = ownerDocument;
  }
  get isConnected(): boolean {
    return this.connected && (this.parentElement?.isConnected ?? true);
  }
  contains(node: unknown): boolean {
    return (
      node === this ||
      (node instanceof Element && Boolean(node.parentElement) && this.contains(node.parentElement))
    );
  }
  closest(selector: string): Element | null {
    return (selector.includes("hidden") && this.hidden) ||
      (selector.includes("inert") && this.inert)
      ? this
      : (this.parentElement?.closest(selector) ?? null);
  }
  matches(selector: string) {
    return selector === ":disabled" && this.disabled;
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
}
class FixtureDocument extends EventTarget {
  defaultView = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  });
}
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) {
    dispose();
  }
  vi.useRealTimers();
});
function fixture() {
  vi.useFakeTimers();
  const document = new FixtureDocument(),
    root = new Element(document),
    button = new Element(document);
  button.parentElement = root;
  const stop = bindAdaHoldActions(
    rootPressGuard(root as unknown as HTMLElement),
    root as unknown as HTMLElement,
  );
  const bindings = new Set<ReturnType<typeof bindAdaAction>>();
  cleanup.push(() => {
    for (const b of bindings) {
      b.dispose();
    }
    stop();
  });
  const context = createContext({
    MAP_SCREEN,
    actionBindings: bindings,
    bindAdaAction,
    disposed: false,
    inCurrentView,
    readViewUnit: () => 2,
    root,
    screen: root,
  });
  const execute = (code: string) =>
    runInContext(
      ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
      context,
    );
  execute(
    `const registerAction = ${actual("registerAction")}; const forgetAction = ${actual("forgetAction")};`,
  );
  const register = execute("registerAction") as (
    action: { run: () => void; availability?: () => { kind: "available" } },
    target: unknown,
  ) => ReturnType<typeof bindAdaAction>;
  const event = (type: string, detail = 1) => {
    const e = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({
      button: 0,
      clientX: 10,
      clientY: 10,
      detail,
      isPrimary: true,
      pointerId: 5,
      target: button,
    })) {
      Object.defineProperty(e, key, { value });
    }
    return e;
  };
  const down = () => {
    document.dispatchEvent(event("pointerdown"));
    root.dispatchEvent(event("pointerdown"));
  };
  const up = () => document.dispatchEvent(event("pointerup"));
  const click = (detail = 1) => {
    const e = event("click", detail);
    root.dispatchEvent(e);
    if (!e.defaultPrevented) {
      button.dispatchEvent(event("click", detail));
    }
    return e;
  };
  return { bindings, button, click, context, down, execute, register, root, up };
}

it("routes the actual Map binding through the public 500ms fallback once and suppresses release click", () => {
  const f = fixture(),
    run = vi.fn();
  f.register({ run }, f.button);
  const action = resolveAdaHoldAction(f.root as unknown as HTMLElement, f.button)!;
  expect(action.rule).toEqual({ holdMs: 500, slopPx: MAP_SCREEN.dragThreshold * 2 });
  f.down();
  vi.advanceTimersByTime(499);
  expect(run).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(run).toHaveBeenCalledOnce();
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(run).toHaveBeenCalledOnce();
  f.click(0);
  expect(run).toHaveBeenCalledTimes(2);
});
it("keeps the actual travel refusal and rechecks travel eligibility for click and hold", () => {
  const f = fixture(),
    onTravel = vi.fn(),
    refuse = vi.fn();
  let danger = true;
  Object.assign(f.context, {
    labels: { carryTravel: "Cargo", towTravel: "Tow", travelUnavailable: "Danger" },
    options: { onTravel, reducedMotion: () => true },
    refuse,
    selectedPlace: () => ({ id: "station" }),
    travel: f.button,
    travelNow: () => ({ offered: true, reason: danger ? "danger" : null }),
  });
  f.execute(actual("travel"));
  f.button.attributes.set("aria-disabled", "true");
  f.down();
  f.up();
  f.click();
  expect(refuse).toHaveBeenCalledOnce();
  expect(onTravel).not.toHaveBeenCalled();
  f.down();
  vi.advanceTimersByTime(600);
  f.up();
  expect(f.click().defaultPrevented).toBe(false);
  expect(refuse).toHaveBeenCalledTimes(2);
  expect(onTravel).not.toHaveBeenCalled();
  danger = false;
  f.button.attributes.delete("aria-disabled");
  f.click(0);
  expect(onTravel).toHaveBeenCalledExactlyOnceWith("station");
});
it("invalidates removed/rebuilt endpoint bindings and does not activate a disposed Map", () => {
  const f = fixture(),
    old = vi.fn(),
    next = vi.fn();
  const binding = f.register({ run: old }, f.button);
  f.context.binding = binding;
  f.execute("forgetAction(binding)");
  expect(f.bindings.size).toBe(0);
  f.click();
  expect(old).not.toHaveBeenCalled();
  f.register({ run: next }, f.button);
  f.click(0);
  expect(next).toHaveBeenCalledOnce();
  f.context.disposed = true;
  f.down();
  vi.advanceTimersByTime(600);
  f.up();
  f.click(0);
  expect(next).toHaveBeenCalledOnce();
});
it("rejects closed, disabled and covered Map controls without changing their business callbacks", () => {
  const f = fixture(),
    run = vi.fn();
  f.register({ run }, f.button);
  f.root.hidden = true;
  f.click(0);
  f.root.hidden = false;
  f.button.disabled = true;
  f.click(0);
  f.button.disabled = false;
  const dialog = new Element(f.button.ownerDocument);
  dialog.parentElement = f.root;
  const leave = enterPressView(f.root as unknown as HTMLElement, dialog as unknown as HTMLElement);
  f.click(0);
  expect(run).not.toHaveBeenCalled();
  leave();
  f.click(0);
  expect(run).toHaveBeenCalledOnce();
});
