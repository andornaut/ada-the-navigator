import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";

import { PHONE_EVENTS } from "../pwa/events.ts";
import {
  assertAdaActionBindings,
  bindAdaAction,
  resolveAdaHoldAction,
} from "../ui/actionBinding.ts";
import { createBackStack, pressBack } from "../ui/backStack.ts";
import { bindAdaActionRoot } from "../ui/holdActionsAdapter.ts";
import { SCROLL } from "../ui/layout/contentCard.ts";
import { readViewUnit } from "../ui/layout/viewScale.ts";
import { enterPressView, inCurrentView, rootPressGuard } from "../ui/pressScope.ts";
import { EXIT_SHOWN_ATTRIBUTE } from "../ui/settings.ts";

const source = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("./controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function actualLeaves(): string {
  let statements: readonly ts.Statement[] = [];
  let disposal: ts.MethodDeclaration | undefined;
  let updateExit: ts.MethodDeclaration | undefined;
  let updateContext: ts.Statement | undefined;
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
      const methods = node.initializer.properties.filter(ts.isMethodDeclaration);
      disposal = methods.find((method) => method.name.getText(source) === "dispose");
      updateExit = methods.find((method) => method.name.getText(source) === "setExitButton");
      updateContext = methods
        .find((method) => method.name.getText(source) === "setPause")
        ?.body?.statements.find((line) => line.getText(source).startsWith("menuContext ="));
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
      variable(n, "exitPose") ||
      (ts.isIfStatement(n) && n.expression.getText(source) === "exitButton && options.exit") ||
      (ts.isIfStatement(n) && n.expression.getText(source) === "exitButton"),
  );
  const use = statements.find((node) => variable(node, "useAction"));
  const audits = statements.filter(
    (node) =>
      ts.isForOfStatement(node) && node.getText(source).includes("assertAdaActionBindings("),
  );
  const keys = ["requiredReady", "menuContext", "onBack", "keyDown"].map((name) => {
    const statement = statements.find((node) => variable(node, name));
    if (!statement) {
      throw Error(`Missing actual Controls declaration ${name}`);
    }
    return statement.getText(source);
  });
  const listen = [
    'window.addEventListener("keydown", keyDown);',
    "window.addEventListener(PHONE_EVENTS.backPressed, onBack);",
  ];
  const listeners = statements.filter((node) => listen.includes(node.getText(source)));
  const cleanup =
    disposal?.body?.statements.filter((n) =>
      [
        "achievementsAction.dispose();",
        "exitAction?.dispose();",
        "exitPose?.dispose();",
        "useAction.dispose();",
        ...listen.map((statement) => statement.replace("addEventListener", "removeEventListener")),
      ].includes(n.getText(source)),
    ) ?? [];
  if (
    first < 0 ||
    last < first ||
    exit.length !== 5 ||
    !use ||
    cleanup.length !== 6 ||
    listeners.length !== 2 ||
    !updateExit ||
    !updateContext
  ) {
    throw Error("Missing actual top-button construction, listener or owned disposal");
  }
  return [
    "let disposed = false;",
    ...statements.slice(first, last + 1).map((n) => n.getText(source)),
    ...exit.map((n) => n.getText(source)),
    use.getText(source),
    ...audits.map((n) => n.getText(source)),
    ...keys,
    ...listeners.map((n) => n.getText(source)),
    `({achievementsButton, exitButton, ${updateExit.getText(source)}, updateContext(view) {
      ${updateContext.getText(source)}
    }, dispose(){ disposed = true;`,
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
  readonly tag: string;
  constructor(document: FixtureDocument, tag = "div") {
    super();
    this.ownerDocument = document;
    this.tag = tag;
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
  get isContentEditable(): boolean {
    const editable = this.getAttribute("contenteditable");
    if (editable === "false") {
      return false;
    }
    return (
      editable === "" ||
      editable === "true" ||
      editable === "plaintext-only" ||
      (this.parentElement?.isContentEditable ?? false)
    );
  }
  closest(selector: string): Element | null {
    return (selector.includes("[hidden]") && this.hidden) ||
      (selector.includes("[inert]") && this.inert) ||
      selector.split(",").includes(this.tag)
      ? this
      : (this.parentElement?.closest(selector) ?? null);
  }
  matches(selector: string) {
    return selector.split(",").some((part) => {
      const key = part.trim();
      return (
        key === this.tag ||
        (key === ":disabled" && this.disabled) ||
        (key === "[data-action]" && this.dataset.action !== undefined)
      );
    });
  }
  querySelectorAll(selector: string): Element[] {
    return this.ownerDocument.nodes.filter(
      (node) => node !== this && this.contains(node) && node.matches(selector),
    );
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, value: boolean) {
    if (value) {
      this.attributes.set(name, "");
    } else {
      this.attributes.delete(name);
    }
  }
}
class FixtureDocument extends EventTarget {
  readonly nodes: Element[] = [];
  hidden = false;
  defaultView = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (fn: () => void, delay: number) => setTimeout(fn, delay),
  });
  createElement(tag?: string) {
    const node = new Element(this, tag);
    this.nodes.push(node);
    return node;
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
function fixture(exit = true, missing?: "achievements" | "exit" | "settings" | "use") {
  vi.useFakeTimers();
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const document = new FixtureDocument(),
    root = document.createElement(),
    openButton = document.createElement("button"),
    useButton = document.createElement("button");
  root.connected = true;
  openButton.dataset.action = "settings";
  openButton.hidden = true;
  useButton.hidden = true;
  root.append(openButton, useButton);
  const register: typeof bindAdaAction = (options, element) => {
    const binding = bindAdaAction(options, element);
    const kind = element === (useButton as unknown as HTMLElement) ? "use" : element.dataset.action;
    if (missing && kind === missing) {
      binding.dispose();
    }
    stops.push(binding.dispose);
    return binding;
  };
  // The real Settings factory binds the launcher before returning it to Controls.
  register(
    {
      click: { availability: () => ({ kind: "omitted" }), run() {} },
      current: () => true,
      slopPx: () => 0,
    },
    openButton as unknown as HTMLElement,
  );
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
  const backStack = createBackStack();
  const openNavigation = vi.fn();
  const options = {
    achievements: { title: "Achievements" },
    requiredReady: () => ready,
    ...(exit ? { exit: { label: "Exit", onExit: vi.fn() } } : {}),
  };
  const value = runInContext(
    ts.transpileModule(actualLeaves(), { compilerOptions: { target: ts.ScriptTarget.ES2023 } })
      .outputText,
    createContext({
      CONTROL_KEYS: new Set(),
      EXIT_SHOWN_ATTRIBUTE,
      Element,
      HTMLElement: Element,
      PHONE_EVENTS,
      SCROLL,
      achievements,
      assertAdaActionBindings,
      backStack,
      bindAdaAction: register,
      document,
      inCurrentView,
      mountNavigationPose: () => ({ dispose() {}, press() {}, rest() {} }),
      openNavigation,
      options,
      // The Menu, which Exit follows in the root.
      pauseButton: openButton,
      pressBack,
      readViewUnit,
      settings: { openButton, root, useButton },
      state: { accepts: () => false },
      window: document.defaultView,
    }),
  ) as {
    achievementsButton: Element;
    exitButton?: Element;
    dispose: () => void;
    setExitButton(shown: boolean): void;
    updateContext(view: { menuContext: "start" | "nonplay" }): void;
  };
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
  const key = (code: string, target = root, repeat = false) => {
    const e = event("keydown", target, 0);
    Object.defineProperties(e, { code: { value: code }, repeat: { value: repeat } });
    document.defaultView.dispatchEvent(e);
    return e;
  };
  return {
    ...value,
    achievements,
    backStack,
    click,
    document,
    down,
    host,
    key,
    openButton,
    openNavigation,
    options,
    phoneBack: () => document.defaultView.dispatchEvent(new Event(PHONE_EVENTS.backPressed)),
    root,
    setReady(value: boolean) {
      ready = value;
      notify();
    },
    up,
    useButton,
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
it.each(["achievements", "exit", "settings", "use"] as const)(
  "rejects completed Controls construction with unbound %s",
  (control) => {
    expect(() => fixture(true, control)).toThrow("no registered action binding");
  },
);

it("retains an absent optional Exit without constructing a control or binding", () => {
  const f = fixture(false);
  expect(f.exitButton).toBeUndefined();
  expect(f.options.exit).toBeUndefined();
  expect(f.achievementsButton.hidden).toBe(true);
  expect(f.openButton.hidden).toBe(true);
  expect(f.useButton.hidden).toBe(true);
  expect(resolveAdaHoldAction(f.host, f.achievementsButton)).not.toBeNull();
  f.dispose();
  expect(resolveAdaHoldAction(f.host, f.achievementsButton)).toBeNull();
});

it("routes bare eligible Start Q once and leaves Escape and phone Back with their own listener", () => {
  const f = fixture();
  const exit = f.options.exit!.onExit;
  const button = f.exitButton!;
  f.setExitButton(true);
  f.updateContext({ menuContext: "start" });
  expect(f.key("KeyQ", button, true).defaultPrevented).toBe(false);
  for (const tag of ["input", "textarea", "select"]) {
    const editable = f.document.createElement(tag);
    f.root.append(editable);
    expect(f.key("KeyQ", editable).defaultPrevented).toBe(false);
  }
  expect(exit).not.toHaveBeenCalled();
  expect(f.key("KeyQ", button).defaultPrevented).toBe(true);
  expect(exit).toHaveBeenCalledOnce();
  expect(f.key("Enter", button).defaultPrevented).toBe(false);
  f.click(button);
  expect(exit).toHaveBeenCalledTimes(2);
  expect(f.key("Escape").defaultPrevented).toBe(true);
  f.phoneBack();
  expect(f.openNavigation).toHaveBeenCalledTimes(2);
  expect(exit).toHaveBeenCalledTimes(2);

  f.dispose();
  expect(f.key("KeyQ", button).defaultPrevented).toBe(false);
  expect(f.key("Escape").defaultPrevented).toBe(false);
  f.phoneBack();
  expect(f.openNavigation).toHaveBeenCalledTimes(2);
  f.click(button);
  expect(exit).toHaveBeenCalledTimes(2);
});

it("keeps Q fenced by runtime capability, readiness, menu context and the registered back stack", () => {
  const absent = fixture(false);
  absent.updateContext({ menuContext: "start" });
  expect(absent.key("KeyQ").defaultPrevented).toBe(false);
  const f = fixture();
  const exit = f.options.exit!.onExit;
  f.setExitButton(true);
  f.updateContext({ menuContext: "nonplay" });
  expect(f.key("KeyQ").defaultPrevented).toBe(false);
  f.updateContext({ menuContext: "start" });
  f.setReady(false);
  expect(f.key("KeyQ").defaultPrevented).toBe(false);
  f.click(f.exitButton!);
  expect(exit).not.toHaveBeenCalled();
  f.setReady(true);
  const back = vi.fn();
  const leave = f.backStack.register({ back, isOpen: () => true });
  expect(f.key("KeyQ").defaultPrevented).toBe(false);
  f.phoneBack();
  expect(back).toHaveBeenCalledOnce();
  expect(exit).not.toHaveBeenCalled();
  leave();
  expect(f.key("KeyQ").defaultPrevented).toBe(true);
  expect(exit).toHaveBeenCalledOnce();
});

it.each(["hidden", "inert", "disabled", "detached", "background", "covered"] as const)(
  "bare Start Exit contract refuses Q while its native action is %s",
  (kind) => {
    const f = fixture();
    const button = f.exitButton!;
    const exit = f.options.exit!.onExit;
    f.setExitButton(kind !== "hidden");
    f.updateContext({ menuContext: "start" });
    let leave: (() => void) | undefined;
    if (kind === "inert" || kind === "disabled") {
      button[kind] = true;
    } else if (kind === "background") {
      f.document.hidden = true;
    } else if (kind === "detached") {
      button.parentElement = null;
    } else if (kind === "covered") {
      const cover = f.document.createElement();
      f.root.append(cover);
      leave = enterPressView(f.host, cover as unknown as HTMLElement);
    }
    try {
      f.click(button);
      expect(exit).not.toHaveBeenCalled();
      const key = f.key("KeyQ");
      expect({ calls: exit.mock.calls.length, prevented: key.defaultPrevented }).toEqual({
        calls: 0,
        prevented: false,
      });
    } finally {
      leave?.();
    }
  },
);

it("bare Start Exit contract refuses Q from editable content", () => {
  const f = fixture();
  f.setExitButton(true);
  f.updateContext({ menuContext: "start" });
  const edit = f.document.createElement();
  edit.setAttribute("contenteditable", "true");
  const target = f.document.createElement("span");
  f.root.append(edit);
  edit.append(target);
  for (const contentEditable of ["true", "plaintext-only"]) {
    edit.setAttribute("contenteditable", contentEditable);
    const key = f.key("KeyQ", target);
    expect({
      calls: f.options.exit!.onExit.mock.calls.length,
      prevented: key.defaultPrevented,
    }).toEqual({
      calls: 0,
      prevented: false,
    });
  }
  target.setAttribute("contenteditable", "false");
  expect(f.key("KeyQ", target).defaultPrevented).toBe(true);
  expect(f.options.exit!.onExit).toHaveBeenCalledOnce();
});
