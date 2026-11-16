import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";

import { bindAdaAction, resolveAdaHoldAction } from "../ui/actionBinding.ts";
import { bindAdaActionRoot } from "../ui/holdActionsAdapter.ts";
import { SCROLL } from "../ui/layout/contentCard.ts";
import { readViewUnit } from "../ui/layout/viewScale.ts";
import { enterPressView, inCurrentView, rootPressGuard } from "../ui/pressScope.ts";

const source = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("./controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function actualLeaves(): string {
  let statements: readonly ts.Statement[] = [];
  let disposal: ts.MethodDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "createControls") {
      statements = node.body!.statements;
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "controls" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      disposal = node.initializer.properties.find(
        (p) => ts.isMethodDeclaration(p) && p.name.getText(source) === "dispose",
      ) as ts.MethodDeclaration;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const variable = (node: ts.Statement, name: string) =>
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some((d) => d.name.getText(source) === name);
  const first = statements.findIndex((n) => variable(n, "achievementsButton"));
  const last = statements.findIndex((n) =>
    n.getText(source).startsWith("settings.openButton.before(achievementsButton)"),
  );
  const exit = statements.filter(
    (n) =>
      variable(n, "exitButton") ||
      variable(n, "exitAction") ||
      (ts.isIfStatement(n) && n.expression.getText(source) === "exitButton && options.exit"),
  );
  const cleanup =
    disposal?.body?.statements.filter((n) =>
      ["achievementsAction.dispose();", "exitAction?.dispose();"].includes(n.getText(source)),
    ) ?? [];
  if (first < 0 || last < first || exit.length !== 3 || cleanup.length !== 2) {
    throw Error("Missing actual top-button construction or owned disposal");
  }
  return [
    "let disposed = false;",
    ...statements.slice(first, last + 1).map((n) => n.getText(source)),
    ...exit.map((n) => n.getText(source)),
    "({achievementsButton, exitButton, dispose(){ disposed = true;",
    ...cleanup.map((n) => n.getText(source)),
    "}});",
  ].join("\n");
}
class Element extends EventTarget {
  parentElement: Element | null = null;
  connected = false;
  hidden = false;
  inert = false;
  disabled = false;
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly ownerDocument: FixtureDocument;
  constructor(document: FixtureDocument) {
    super();
    this.ownerDocument = document;
  }
  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? this.connected;
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      node.parentElement = this;
    }
  }
  before(node: Element) {
    node.parentElement = this.parentElement;
  }
  after(node: Element) {
    node.parentElement = this.parentElement;
  }
  contains(node: unknown): boolean {
    return (
      node === this ||
      (node instanceof Element && Boolean(node.parentElement && this.contains(node.parentElement)))
    );
  }
  closest(selector: string): Element | null {
    return (selector.includes("[hidden]") && this.hidden) ||
      (selector.includes("[inert]") && this.inert)
      ? this
      : (this.parentElement?.closest(selector) ?? null);
  }
  matches(selector: string) {
    return selector === ":disabled" && this.disabled;
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}
class FixtureDocument extends EventTarget {
  hidden = false;
  defaultView = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  });
  createElement() {
    return new Element(this);
  }
}
const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0).reverse()) {
    stop();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function fixture(exit = true) {
  vi.useFakeTimers();
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const document = new FixtureDocument(),
    root = document.createElement(),
    openButton = document.createElement();
  root.connected = true;
  root.append(openButton);
  let ready = true,
    notify = () => {};
  const host = root as unknown as HTMLElement;
  const binding = bindAdaActionRoot(
    {
      guard: rootPressGuard(host),
      requiredReady: () => ready,
      subscribeRequired: (next) => {
        notify = next;
        return () => {};
      },
    },
    host,
  );
  stops.push(binding.dispose);
  const achievements = { open: vi.fn() };
  const options = {
    achievements: { title: "Achievements" },
    ...(exit ? { exit: { label: "Exit", onExit: vi.fn() } } : {}),
  };
  const value = runInContext(
    ts.transpileModule(actualLeaves(), { compilerOptions: { target: ts.ScriptTarget.ES2023 } })
      .outputText,
    createContext({
      SCROLL,
      achievements,
      bindAdaAction,
      document,
      inCurrentView,
      options,
      readViewUnit,
      settings: { openButton, root },
    }),
  ) as { achievementsButton: Element; exitButton?: Element; dispose: () => void };
  stops.push(value.dispose);
  const event = (type: string, target: Element, detail = 1) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperties(
      e,
      Object.fromEntries(
        Object.entries({
          button: 0,
          clientX: 0,
          clientY: 0,
          detail,
          isPrimary: true,
          pointerId: 7,
          target,
        }).map(([key, item]) => [key, { value: item }]),
      ),
    );
    return e;
  };
  const down = (target: Element) => {
    document.dispatchEvent(event("pointerdown", target));
    root.dispatchEvent(event("pointerdown", target));
  };
  const click = (target: Element, detail = 0) => {
    const e = event("click", target, detail);
    root.dispatchEvent(e);
    if (!e.defaultPrevented) {
      target.dispatchEvent(event("click", target, detail));
    }
    return e;
  };
  const up = (target: Element) => {
    document.dispatchEvent(event("pointerup", target));
    return click(target, 1);
  };
  return {
    ...value,
    achievements,
    click,
    down,
    host,
    options,
    root,
    setReady(value: boolean) {
      ready = value;
      notify();
    },
    up,
  };
}
it.each(["achievements", "exit"] as const)(
  "routes the actual %s leaf through one hold and current native callback",
  (kind) => {
    const f = fixture(),
      node = kind === "achievements" ? f.achievementsButton : f.exitButton!;
    node.hidden = false;
    const initial = kind === "achievements" ? f.achievements.open : f.options.exit!.onExit;
    const current = vi.fn();
    f.down(node);
    vi.advanceTimersByTime(499);
    expect(initial).not.toHaveBeenCalled();
    if (kind === "achievements") {
      f.achievements.open = current;
    } else {
      f.options.exit!.onExit = current;
    }
    vi.advanceTimersByTime(1);
    expect(current).toHaveBeenCalledOnce();
    expect(f.up(node).defaultPrevented).toBe(true);
    expect(current).toHaveBeenCalledOnce();
    f.click(node, 0);
    expect(current).toHaveBeenCalledTimes(2);
    expect(initial).not.toHaveBeenCalled();
  },
);
it.each(["achievements", "exit"] as const)(
  "keeps actual %s unavailable under hidden, inert, covered, readiness and disposal guards",
  (kind) => {
    const f = fixture(),
      node = kind === "achievements" ? f.achievementsButton : f.exitButton!;
    const run = kind === "achievements" ? f.achievements.open : f.options.exit!.onExit;
    f.click(node);
    expect(run).not.toHaveBeenCalled();
    node.hidden = false;
    for (const flag of ["hidden", "inert", "disabled"] as const) {
      node[flag] = true;
      f.click(node);
      expect(run).not.toHaveBeenCalled();
      node[flag] = false;
    }
    f.setReady(false);
    f.click(node);
    expect(run).not.toHaveBeenCalled();
    f.setReady(true);
    const dialog = new Element(node.ownerDocument);
    dialog.parentElement = f.root;
    f.down(node);
    const leave = enterPressView(f.host, dialog as unknown as HTMLElement);
    vi.advanceTimersByTime(500);
    f.up(node);
    expect(run).not.toHaveBeenCalled();
    leave();
    node.parentElement = null;
    f.click(node);
    expect(run).not.toHaveBeenCalled();
    node.parentElement = f.root;
    f.down(node);
    f.dispose();
    vi.advanceTimersByTime(500);
    f.up(node);
    f.click(node);
    expect(resolveAdaHoldAction(f.host, node)).toBeNull();
    expect(run).not.toHaveBeenCalled();
  },
);
it("retains an absent optional Exit without constructing a control or binding", () => {
  const f = fixture(false);
  expect(f.exitButton).toBeUndefined();
  expect(f.options.exit).toBeUndefined();
  expect(resolveAdaHoldAction(f.host, f.achievementsButton)).not.toBeNull();
  f.dispose();
  expect(resolveAdaHoldAction(f.host, f.achievementsButton)).toBeNull();
});
