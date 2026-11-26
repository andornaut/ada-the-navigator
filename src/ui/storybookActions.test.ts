import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";

import { SCROLL } from "../data/layout.ts";
import { ControlState } from "../input/state.ts";
import * as actionBinding from "./actionBinding.ts";
import { bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { registerAdaActionRoot } from "./actionRegistry.ts";
import { bindAdaActionRoot } from "./holdActionsAdapter.ts";
import { NO_INSETS } from "./layout/playView.ts";
import { useDiscLayout, usePressed } from "./layout/touchControls.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { enterPressView, rootPressGuard } from "./pressScope.ts";
import { createStorybook, type StoryPageView } from "./storybook.ts";

vi.mock("./storyArt.ts", async (original) => ({
  ...(await original<typeof import("./storyArt.ts")>()),
  loadStoryArt: () => new Promise(() => {}),
}));

class Element extends EventTarget {
  readonly tag: string;
  constructor(tag = "div") {
    super();
    this.tag = tag;
  }
  readonly children: Element[] = [];
  parentElement: Element | null = null;
  attached = false;
  className = "";
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly properties = new Map<string, string>();
  readonly style = Object.assign(
    {
      removeProperty: (key: string) => this.properties.delete(key),
      setProperty: (key: string, value: string) => this.properties.set(key, value),
    },
    {} as Record<string, string>,
  );
  hidden = false;
  inert = false;
  disabled = false;
  private text = "";
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.replaceChildren();
    this.text = value;
  }
  clientWidth = 720;
  clientHeight = 360;
  scrollHeight = 360;
  scrollWidth = 720;
  get ownerDocument() {
    return document;
  }
  get parentNode() {
    return this.parentElement;
  }
  get nextSibling(): Element | null {
    return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
  }
  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? this.attached;
  }
  readonly classList = {
    add: (...names: string[]) => {
      this.className = [...new Set([...this.className.split(" "), ...names])]
        .filter(Boolean)
        .join(" ");
    },
    contains: (name: string) => this.className.split(" ").includes(name),
    remove: (...names: string[]) => {
      this.className = this.className
        .split(" ")
        .filter((name) => !names.includes(name))
        .join(" ");
    },
    toggle: (name: string, value: boolean) => {
      if (value) {
        this.classList.add(name);
      } else {
        this.classList.remove(name);
      }
    },
  };
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const rule = part.trim();
      return (
        rule === this.tag ||
        (rule === ":disabled" && this.disabled) ||
        (rule === "[data-action]" && "action" in this.dataset)
      );
    });
  }
  querySelectorAll(selector: string): Element[] {
    return this.all().filter((child) => child.matches(selector));
  }
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  toggleAttribute(name: string, value: boolean) {
    if (value) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
  }
  closest(selector: string): Element | null {
    if (
      (selector.includes("[hidden]") && this.hidden) ||
      (selector.includes("[inert]") && this.inert) ||
      (selector.includes(".ada-story-panel") &&
        this.className.split(" ").includes("ada-story-panel"))
    ) {
      return this;
    }
    return this.parentElement?.closest(selector) ?? null;
  }
  insertBefore(node: Element, before: Element | null) {
    if (node === before) {
      return;
    }
    node.remove();
    node.parentElement = this;
    this.children.splice(
      before === null ? this.children.length : this.children.indexOf(before),
      0,
      node,
    );
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  prepend(...nodes: Element[]) {
    for (const node of nodes.reverse()) {
      this.insertBefore(node, this.children[0] ?? null);
    }
  }
  replaceChildren(...nodes: Element[]) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.append(...nodes);
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    }
    this.parentElement = null;
    this.attached = false;
  }
  getBoundingClientRect() {
    return { bottom: 360, height: 360, left: 0, top: 0, width: 720 };
  }
  focus() {
    Object.assign(document, { activeElement: this });
  }
  all(): Element[] {
    return this.children.flatMap((child) => [child, ...child.all()]);
  }
}
const page: StoryPageView = {
  background: "grandmaGarden",
  canGoBack: true,
  canSkip: true,
  next: true,
  text: "Existing page facts",
};
function setup(beforeMount?: (host: Element) => void) {
  const win = Object.assign(new EventTarget(), {
    HTMLElement: Element,
    Node: Element,
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    performance: { now: () => Date.now() },
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  });
  let resolveFonts = () => {};
  const fontsReady = new Promise<void>((resolve) => {
    resolveFonts = resolve;
  });
  const doc = Object.assign(new EventTarget(), {
    activeElement: null,
    createElement: (tag: string) => new Element(tag),
    defaultView: win,
    fonts: { ready: fontsReady },
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("HTMLElement", Element);
  vi.stubGlobal("Node", Element);
  vi.stubGlobal("Element", Element);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const host = new Element();
  host.attached = true;
  let allowed = true;
  const unregister = registerAdaActionRoot(
    { permits: () => allowed },
    host as unknown as HTMLElement,
  );
  const options = {
    labels: { next: "Next", previous: "Previous", skip: "Skip" },
    onChoose: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onSkip: vi.fn(),
    reducedMotion: () => true,
  };
  let story: ReturnType<typeof createStorybook>;
  try {
    beforeMount?.(host);
    story = createStorybook(host as unknown as HTMLElement, options);
    story.show(page);
  } catch (error) {
    unregister();
    throw error;
  }
  const button = (action: string) => host.all().find((node) => node.dataset.action === action)!;
  const resolve = (element: Element) =>
    resolveAdaHoldAction(host as unknown as HTMLElement, element as unknown as EventTarget);
  return {
    button,
    deny: () => {
      allowed = false;
    },
    fontsReady,
    host,
    options,
    resolve,
    resolveFonts,
    story,
    unregister,
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("rejects a missing Storybook navigation binding before mounting the hidden layer", () => {
  const bind = actionBinding.bindAdaAction;
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((action, element) =>
    action.nativeClickOwner === "factory" && element.textContent === "Previous"
      ? { activate: () => false, dispose() {}, update() {} }
      : bind(action, element),
  );
  const insertions: Element[] = [];
  expect(() =>
    setup((host) => {
      const insert = host.insertBefore.bind(host);
      vi.spyOn(host, "insertBefore").mockImplementation((node, before) => {
        insertions.push(node);
        insert(node, before);
      });
    }),
  ).toThrow("no registered action binding");
  expect(insertions).toEqual([]);
});

it("requires a live root when constructing the attached Storybook", () => {
  let detached: Element | undefined;
  expect(() =>
    setup((host) => {
      detached = host;
      host.attached = false;
    }),
  ).toThrow("no live action root");
  expect(detached?.children).toEqual([]);
});

it("does not audit a disposed Storybook when font readiness arrives late", async () => {
  const f = setup();
  const audit = vi.spyOn(actionBinding, "assertAdaActionBindings");
  f.story.dispose();
  f.unregister();
  f.resolveFonts();
  await f.fontsReady;
  expect(audit).not.toHaveBeenCalled();
});

it("rechecks a retained Storybook page after reattachment without a hidden render", () => {
  const f = setup();
  const outer = new Element();
  outer.attached = true;
  const unregister = registerAdaActionRoot(
    { permits: () => true },
    outer as unknown as HTMLElement,
  );
  const original = f.resolve(f.button("story-next"))!;
  try {
    // Moving the Controls subtree changes its owning ancestor without showing another page.
    outer.append(f.host);
    unregister();
    expect(() => f.story.show(page)).toThrow("no live action root");
    expect(f.host.children[0]?.hidden).toBe(true);
    original.activate();
    expect(f.options.onNext).not.toHaveBeenCalled();

    f.host.remove();
    f.host.attached = true;
    f.story.show(page);
    expect(f.host.children[0]?.hidden).toBe(false);
    f.resolve(f.button("story-next"))!.activate();
    expect(f.options.onNext).toHaveBeenCalledOnce();
  } finally {
    unregister();
    f.story.dispose();
    f.unregister();
  }
});

it("rejects an unbound Storybook choice before attaching any new choice and releases its batch", () => {
  const f = setup();
  const choicePage = { ...page, choices: [{ label: "First" }, { label: "Second" }], next: false };
  f.story.show({ ...choicePage, choices: [{ label: "Original" }] });
  const previous = f.button("story-choice");
  const old = f.resolve(previous)!;
  const row = previous.parentElement!;
  const attach = vi.spyOn(row, "insertBefore");
  const bind = actionBinding.bindAdaAction;
  const staged: HTMLElement[] = [];
  const disposals: (() => void)[] = [];
  const registrations = vi
    .spyOn(actionBinding, "bindAdaAction")
    .mockImplementation((action, element) => {
      staged.push(element);
      const binding =
        element.textContent === "Second"
          ? { activate: () => false, dispose() {}, update() {} }
          : bind(action, element);
      const dispose = vi.fn(binding.dispose);
      disposals.push(dispose);
      return { ...binding, dispose };
    });
  try {
    expect(() => f.story.show(choicePage)).toThrow("no registered action binding");
    expect(staged).toHaveLength(2);
    expect(attach).not.toHaveBeenCalled();
    expect(staged.every((element) => !element.isConnected && element.hidden)).toBe(true);
    expect(f.host.children[0]?.hidden).toBe(true);
    expect(row.children).toEqual([]);
    expect(f.resolve(previous)).toBeNull();
    old.activate();
    expect(f.options.onChoose).not.toHaveBeenCalled();
    registrations.mockRestore();
    f.story.show(choicePage);
    expect(row.children.map((node) => node.textContent)).toEqual(["First", "Second"]);
    expect(document.activeElement).toBe(row.children[0]);
  } finally {
    f.story.dispose();
    f.unregister();
  }
  for (const dispose of disposals) {
    expect(dispose).toHaveBeenCalledOnce();
  }
});

it("rejects an unbound overnight generation and keeps its surface semantic only while bound", () => {
  const f = setup();
  const background = f.host.all().find((node) => node.className === "ada-story-background")!;
  const bind = actionBinding.bindAdaAction;
  const registrations = vi
    .spyOn(actionBinding, "bindAdaAction")
    .mockImplementation((action, element) =>
      element.dataset.action === "story-sleep"
        ? { activate: () => false, dispose() {}, update() {} }
        : bind(action, element),
    );
  const sleep = { ...page, canSkip: false, sleep: true };
  try {
    expect(background.dataset.action).toBeUndefined();
    expect(() => f.story.show(sleep)).toThrow("no registered action binding");
    expect(f.host.children[0]?.hidden).toBe(true);
    expect(background.dataset.action).toBeUndefined();
    expect(f.resolve(background)).toBeNull();
    registrations.mockRestore();
    f.story.show(sleep);
    expect(background.dataset.action).toBe("story-sleep");
    expect(f.resolve(background)).not.toBeNull();
    f.story.show(page);
    expect(background.dataset.action).toBeUndefined();
    expect(f.resolve(background)).toBeNull();
  } finally {
    f.story.dispose();
    f.unregister();
  }
});

it("registers native navigation with default holds and current callbacks", () => {
  const f = setup();
  try {
    for (const [action, key] of [
      ["story-skip", "onSkip"],
      ["story-previous", "onPrevious"],
      ["story-next", "onNext"],
    ] as const) {
      const button = f.button(action),
        binding = f.resolve(button)!;
      expect(binding.available()).toBe(true);
      expect(binding.hold).toBeUndefined();
      const replacement = vi.fn();
      f.options[key] = replacement;
      binding.activate();
      expect(replacement).toHaveBeenCalledOnce();
      button.disabled = true;
      expect(binding.available()).toBe(false);
      binding.activate();
      expect(replacement).toHaveBeenCalledOnce();
      button.disabled = false;
    }
    f.story.show({ ...page, canGoBack: false, canSkip: false, next: false });
    expect(f.resolve(f.button("story-skip"))!.available()).toBe(false);
    expect(f.resolve(f.button("story-previous"))!.available()).toBe(false);
    expect(f.resolve(f.button("story-next"))!.available()).toBe(false);
  } finally {
    f.story.dispose();
    f.unregister();
  }
});
it("keeps the standard navigation buttons when their labels and availability change", () => {
  const f = setup();
  try {
    const skip = f.button("story-skip");
    const previous = f.button("story-previous");
    const next = f.button("story-next");
    for (const button of [skip, previous, next]) {
      expect(button.tag).toBe("button");
      expect(button.className.split(" ")).toContain("ui-standard-button");
    }
    f.story.show({ ...page, action: "Board", previousAction: "Back to room" });
    expect(f.button("story-skip")).toBe(skip);
    expect(f.button("story-previous")).toBe(previous);
    expect(f.button("story-next")).toBe(next);
    expect(previous.textContent).toBe("Back to room");
    expect(next.textContent).toBe("Board");
    f.story.show({ ...page, canGoBack: false, canSkip: false, next: false });
    for (const button of [skip, previous, next]) {
      expect(button.hidden).toBe(true);
      button.dispatchEvent(new Event("click"));
    }
    expect(f.options.onPrevious).not.toHaveBeenCalled();
    expect(f.options.onNext).not.toHaveBeenCalled();
    expect(f.options.onSkip).not.toHaveBeenCalled();
  } finally {
    f.story.dispose();
    f.unregister();
  }
});

it("preserves live parent eligibility, native click dispatch and disposal without another root", () => {
  const f = setup();
  const button = f.button("story-next"),
    binding = f.resolve(button)!;
  button.dispatchEvent(new Event("click"));
  expect(f.options.onNext).toHaveBeenCalledOnce();
  f.deny();
  expect(binding.available()).toBe(false);
  button.dispatchEvent(new Event("click"));
  binding.activate();
  expect(f.options.onNext).toHaveBeenCalledOnce();
  f.story.dispose();
  expect(f.resolve(button)).toBeNull();
  button.dispatchEvent(new Event("click"));
  expect(f.options.onNext).toHaveBeenCalledOnce();
  f.unregister();
});
it("rebuilds choices with their original indexes, current callbacks and no stale detached binding", () => {
  const f = setup();
  try {
    f.story.show({ ...page, choices: [{ label: "First" }, { label: "Second" }], next: false });
    const choices = f.host.all().filter((node) => node.dataset.action === "story-choice");
    expect(choices.map((node) => node.textContent)).toEqual(["First", "Second"]);
    const old = f.resolve(choices[1]!)!;
    const replacement = vi.fn();
    f.options.onChoose = replacement;
    old.activate();
    expect(replacement).toHaveBeenCalledExactlyOnceWith(1);
    f.story.show({
      ...page,
      choices: [{ label: "Replacement" }],
      next: false,
      text: "Next actual page facts",
    });
    expect(f.resolve(choices[1]!)).toBeNull();
    old.activate();
    choices[1]!.dispatchEvent(new Event("click"));
    expect(replacement).toHaveBeenCalledOnce();
    const current = f.host.all().find((node) => node.dataset.action === "story-choice")!;
    f.resolve(current)!.activate();
    expect(replacement.mock.calls).toEqual([[1], [0]]);
  } finally {
    f.story.dispose();
    f.unregister();
  }
});

it("owns sleep background activation with one current page identity and no parallel native listener", () => {
  const f = setup();
  try {
    const sleep = { ...page, canSkip: false, sleep: true };
    f.story.show(sleep);
    const background = f.host.all().find((node) => node.className === "ada-story-background")!;
    const action = f.resolve(background)!;
    expect(action.available()).toBe(true);
    expect(action.rule.holdMs).toBe(500);
    background.dispatchEvent(new Event("click"));
    expect(f.options.onNext).toHaveBeenCalledOnce();
    const current = vi.fn();
    f.options.onNext = current;
    action.activate();
    expect(current).toHaveBeenCalledOnce();
    f.story.show({ ...sleep });
    expect(f.resolve(background)!.identity).toBe(action.identity);
    f.story.show({ ...sleep, text: "Another actual page" });
    const replacement = f.resolve(background)!;
    expect(replacement.identity).not.toBe(action.identity);
    action.activate();
    expect(current).toHaveBeenCalledOnce();
    replacement.activate();
    expect(current).toHaveBeenCalledTimes(2);
    f.deny();
    replacement.activate();
    background.dispatchEvent(new Event("click"));
    expect(current).toHaveBeenCalledTimes(2);
    f.story.show(page);
    expect(f.resolve(background)).toBeNull();
    background.dispatchEvent(new Event("click"));
    expect(current).toHaveBeenCalledTimes(2);
  } finally {
    f.story.dispose();
    f.unregister();
  }
});

const controlsSource = ts.createSourceFile(
  "controls.ts",
  readFileSync(new URL("../input/controls.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function controlsDeclaration(name: string): string {
  let declaration: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(controlsSource) === name) {
      declaration = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(controlsSource);
  if (!declaration) {
    throw new Error(`Missing actual Controls declaration ${name}`);
  }
  return declaration.getText(controlsSource);
}
function useFixture() {
  vi.useFakeTimers();
  const f = setup();
  f.unregister();
  const useButton = new Element();
  f.host.append(useButton);
  const canvas = new Element(),
    parent = new Element();
  canvas.attached = true;
  parent.append(canvas);
  const hud = f.button("story-next");
  let physical: Element | null = canvas;
  Object.assign(document, { elementFromPoint: () => physical });
  const layout = useDiscLayout({ height: 360, width: 720 }, NO_INSETS);
  const state = new ControlState();
  state.setUseAvailable(true);
  const request = vi.spyOn(state, "requestUse");
  let pointerAccept!: (event: PointerEvent) => boolean;
  let pointerHandlers!: { down: (press: { pointerId: number }, event: PointerEvent) => void };
  const sandbox = createContext({
    Node: Element,
    SCROLL,
    bindAdaAction,
    bindAdaActionRoot,
    canvas,
    canvasSize: () => ({ height: 360, width: 720 }),
    context: { action: "dock", label: "Dock" },
    disposed: false,
    document,
    joystickTarget: () => null,
    listenPagePresses: (accept: typeof pointerAccept, handlers: typeof pointerHandlers) => {
      pointerAccept = accept;
      pointerHandlers = handlers;
      return () => {};
    },
    now: () => Date.now(),
    onPageControl: (target: unknown) => target !== canvas && target !== parent,
    options: { exit: undefined, subscribeRequired: () => () => {} },
    parent,
    point: (event: PointerEvent) => ({ x: event.clientX, y: event.clientY }),
    readViewUnit,
    release: (pointerId: number) => state.release(pointerId),
    requiredReady: () => true,
    rootPressGuard,
    scene: {},
    sceneFit: () => ({}),
    settings: { root: f.host },
    state,
    useButton,
    useLayout: layout,
    usePress: undefined,
    usePressed,
    useShown: true,
    weapons: { setPressed: vi.fn() },
    window,
  });
  const declarations = [
    "exitPresentation",
    "createExit",
    "exit",
    "exitButton",
    "resolveUsePointer",
    "useAction",
    "actionRoot",
    "stopPointers",
  ];
  const actual = runInContext(
    ts.transpileModule(
      `let ${controlsDeclaration("pressedStoryButton")};
${declarations
  .map((name) => `const ${controlsDeclaration(name)};`)
  .join("\n")}\n({actionRoot,useAction,resolveUsePointer});`,
      { compilerOptions: { target: ts.ScriptTarget.ES2023 } },
    ).outputText,
    sandbox,
  ) as {
    actionRoot: ReturnType<typeof bindAdaActionRoot>;
    useAction: ReturnType<typeof bindAdaAction>;
    resolveUsePointer: (event: PointerEvent) => HTMLElement | null | undefined;
  };
  const event = (
    type: string,
    target: Element = canvas,
    at = layout.centre,
    touch = { id: 7, primary: true },
  ) => {
    const e = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({
      button: 0,
      clientX: at.x,
      clientY: at.y,
      detail: type === "click" ? 1 : 0,
      isPrimary: touch.primary,
      pointerId: touch.id,
      pointerType: "touch",
      target,
    })) {
      Object.defineProperty(e, key, { value });
    }
    return e as PointerEvent;
  };
  const down = (target = canvas, at = layout.centre) => {
    physical = target;
    const e = event("pointerdown", target, at);
    document.dispatchEvent(e);
    if (pointerAccept(e)) {
      pointerHandlers.down({ pointerId: 7 }, e);
    }
  };
  const up = (target = canvas, at = layout.centre) =>
    document.dispatchEvent(event("pointerup", target, at));
  const click = (target = useButton, at = layout.centre) => {
    physical = target;
    const e = event("click", target, at);
    f.host.dispatchEvent(e);
    if (!e.defaultPrevented) {
      target.dispatchEvent(e);
    }
    return e;
  };
  return {
    ...f,
    ...actual,
    canvas,
    click,
    down,
    event,
    hud,
    layout,
    pointerAccept: (event: PointerEvent) => pointerAccept(event),
    request,
    sandbox,
    setPhysical: (target: Element | null) => {
      physical = target;
    },
    state,
    up,
    useButton,
  };
}
it("clears Storybook press paint on release and dispatches once", () => {
  const f = useFixture();
  try {
    f.story.show(page);
    f.down(f.hud);
    expect(f.hud.getAttribute("data-story-pressed")).toBe("");
    f.up(f.hud);
    expect(f.hud.getAttribute("data-story-pressed")).toBeNull();
    f.click(f.hud);
    expect(f.options.onNext).toHaveBeenCalledOnce();
    f.down(f.hud);
    vi.advanceTimersByTime(500);
    expect(f.options.onNext).toHaveBeenCalledTimes(2);
    f.up(f.hud);
    f.click(f.hud);
    expect(f.hud.getAttribute("data-story-pressed")).toBeNull();
    expect(f.options.onNext).toHaveBeenCalledTimes(2);
  } finally {
    f.useAction.dispose();
    f.actionRoot.dispose();
    f.story.dispose();
  }
});

it("pairs the actual Controls Use resolver with one short/hold release and no joystick or click duplicate", () => {
  const f = useFixture();
  try {
    expect(f.resolveUsePointer(f.event("pointerdown"))).toBe(f.useButton);
    f.down();
    expect(f.request).not.toHaveBeenCalled();
    f.up();
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.click().defaultPrevented).toBe(true);
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.state.sample().move).toEqual({ x: 0, y: 0 });
    expect(f.state.sample().aim).toEqual({ x: 0, y: 0 });
    f.down();
    vi.advanceTimersByTime(500);
    expect(f.request).toHaveBeenCalledTimes(2);
    expect(f.sandbox.usePress).toBeDefined();
    f.up();
    f.click();
    expect(f.request).toHaveBeenCalledTimes(2);
    expect(f.sandbox.usePress).toBeUndefined();
    const invalid = { x: -100, y: -100 };
    expect(f.resolveUsePointer(f.event("pointerdown", f.useButton, invalid))).toBeNull();
    f.down(f.useButton, invalid);
    f.up(f.useButton, invalid);
    f.click(f.useButton, invalid);
    expect(f.request).toHaveBeenCalledTimes(2);
    f.down(f.useButton);
    f.setPhysical(f.hud);
    document.dispatchEvent(f.event("pointermove", f.useButton));
    vi.advanceTimersByTime(500);
    f.up(f.useButton);
    expect(f.request).toHaveBeenCalledTimes(2);
    f.setPhysical(null);
    expect(f.resolveUsePointer(f.event("pointerdown"))).toBeNull();
    f.setPhysical(f.useButton);
    const keyboard = new Event("click");
    Object.defineProperty(keyboard, "detail", { value: 0 });
    f.useButton.dispatchEvent(keyboard);
    expect(f.request).toHaveBeenCalledTimes(3);
    f.state.setEnabled(false);
    f.useButton.dispatchEvent(keyboard);
    expect(f.request).toHaveBeenCalledTimes(3);
  } finally {
    f.useAction.dispose();
    f.actionRoot.dispose();
    f.story.dispose();
  }
});
it("keeps native sleep routing, stale page identity and modal denial without redirecting HUD to Use", () => {
  const f = useFixture();
  try {
    const sleep = { ...page, canSkip: false, sleep: true };
    f.story.show(sleep);
    const background = f.host.all().find((node) => node.className === "ada-story-background")!;
    f.setPhysical(background);
    expect(f.resolveUsePointer(f.event("pointerdown", background))).toBeUndefined();
    f.down(background);
    f.up(background);
    f.click(background);
    expect(f.options.onNext).toHaveBeenCalledOnce();
    expect(f.request).not.toHaveBeenCalled();
    f.down(background);
    vi.advanceTimersByTime(500);
    f.up(background);
    f.click(background);
    expect(f.options.onNext).toHaveBeenCalledTimes(2);
    f.down(background);
    f.story.show({ ...sleep, text: "Replacement page" });
    f.up(background);
    f.click(background);
    expect(f.options.onNext).toHaveBeenCalledTimes(2);
    expect(f.resolveUsePointer(f.event("pointerdown", f.hud))).toBeUndefined();
    f.down(f.hud);
    f.up(f.hud);
    f.click(f.hud);
    expect(f.request).not.toHaveBeenCalled();
    const dialog = new Element();
    f.host.append(dialog);
    const leave = enterPressView(
      f.host as unknown as HTMLElement,
      dialog as unknown as HTMLElement,
    );
    f.down();
    vi.advanceTimersByTime(500);
    f.up();
    f.click();
    expect(f.request).not.toHaveBeenCalled();
    leave();
  } finally {
    f.useAction.dispose();
    f.actionRoot.dispose();
    f.story.dispose();
  }
});

it("preserves a moving primary joystick while the canonical Controls root handles secondary touch Use", () => {
  const f = useFixture();
  try {
    f.down(f.canvas, { x: 40, y: 60 });
    f.state.move(7, { x: 65, y: 45 });
    const move = f.state.sample().move;
    expect(Math.hypot(move.x, move.y)).toBeGreaterThan(0);
    const second = { id: 8, primary: false };
    const down = f.event("pointerdown", f.canvas, f.layout.centre, second);
    expect(f.pointerAccept(down)).toBe(false);
    document.dispatchEvent(down);
    expect(f.request).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(f.request).toHaveBeenCalledOnce();
    document.dispatchEvent(f.event("pointerup", f.canvas, f.layout.centre, second));
    const click = f.event("click", f.useButton, f.layout.centre, second);
    f.host.dispatchEvent(click);
    if (!click.defaultPrevented) {
      f.useButton.dispatchEvent(click);
    }
    expect(click.defaultPrevented).toBe(true);
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.state.sample().move).toEqual(move);
  } finally {
    f.useAction.dispose();
    f.actionRoot.dispose();
    f.story.dispose();
  }
});
