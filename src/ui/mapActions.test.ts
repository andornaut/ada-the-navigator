import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { HIT_RULE, hitAround, pressedArea } from "@andornaut/game-kit/runtime/ui/hitAreas";
import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";

import { canAffordMapJump, MAP_JUMP_COST } from "../data/mapJump.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "../model/flightTopology.ts";
import { bindAdaAction, resolveAdaHoldAction } from "./actionBinding.ts";
import { bindAdaActionRoot, bindAdaHoldActions } from "./holdActionsAdapter.ts";
import { framePoint, turnOf } from "./layout/frameBox.ts";
import {
  chipRect,
  clampView,
  keepClear,
  MAP_SCREEN,
  mapSurveyEllipse,
  type MapView,
  panView,
  recentreView,
  scaleLimits,
  toScreen,
  zoomView,
} from "./layout/mapScreen.ts";
import { VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import {
  enterPressView,
  inCurrentView,
  invalidatePressScope,
  rootPressGuard,
} from "./pressScope.ts";
import { createStandardTextAction } from "./standardTextAction.ts";

const source = ts.createSourceFile(
  "mapScreen.ts",
  readFileSync(new URL("./mapScreen.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function actual(name: string): string {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (
      !["chip", "screen"].includes(name) &&
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === name
    ) {
      found = node.initializer;
    }
    if (
      name === "screen" &&
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "registerAction" &&
      node.arguments[1]?.getText(source) === name
    ) {
      found = node;
    }
    if (
      name === "chip" &&
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.name.elements.some(
        ({ name, propertyName }) =>
          name.getText(source) === "chip" && propertyName?.getText(source) === "button",
      ) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(source) === "createMapButton"
    ) {
      found = node.initializer;
    }
    if (
      ["close", "dispose"].includes(name) &&
      ts.isMethodDeclaration(node) &&
      node.name.getText(source) === name
    ) {
      found = node;
    }
    if (
      ["pointerdown", "pointermove", "wheel"].includes(name) &&
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "screen.addEventListener" &&
      node.arguments[0]?.getText(source) === JSON.stringify(name)
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
it("measures and paints header ink with its computed font when shorthand is empty", () => {
  let computed = {
    font: "",
    fontFamily: "AdaUI, sans-serif",
    fontSize: "24px",
    fontStyle: "normal",
    fontWeight: "700",
  };
  const fonts: string[] = [];
  const measure = {
    canvas: {
      set height(_value: number) {
        measure.font = "10px sans-serif";
      },
      width: 0,
    },
    fillText: () => fonts.push(measure.font),
    font: "10px sans-serif",
    getImageData: () => ({ data: [0, 0, 0, 255], height: 1, width: 1 }),
    measureText: () => {
      fonts.push(measure.font);
      return { actualBoundingBoxAscent: 2, actualBoundingBoxDescent: 1, width: 3 };
    },
    scale: () => {},
  };
  const context = createContext({
    density: 1,
    getComputedStyle: () => computed,
    inkMeasurements: new Map(),
    pixelUnit: 1,
    pixels: (value: number) => `${value}px`,
    textMeasure: measure,
  });
  const measureInk = runInContext(
    ts.transpileModule(`(${actual("measureInk")})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    context,
  ) as (box: { style: object }, ink: { textContent: string; style: object }) => number;
  const box = { style: {} };
  const ink = { style: {}, textContent: "Sunflower" };
  expect(measureInk(box, ink)).toBe(1);
  expect(measureInk(box, ink)).toBe(1);
  computed = { ...computed, fontSize: "42.6667px" };
  expect(measureInk(box, ink)).toBe(1);
  computed = { ...computed, font: "700 24px / 28px AdaUI, sans-serif" };
  expect(measureInk(box, ink)).toBe(1);
  expect(fonts).toEqual([
    "normal 700 24px AdaUI, sans-serif",
    "normal 700 24px AdaUI, sans-serif",
    "normal 700 42.6667px AdaUI, sans-serif",
    "normal 700 42.6667px AdaUI, sans-serif",
    "700 24px / 28px AdaUI, sans-serif",
    "700 24px / 28px AdaUI, sans-serif",
  ]);
});

class Element extends EventTarget {
  parentElement: Element | null = null;
  readonly classList = { add() {} };
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
  append(el: Element) {
    el.parentElement = this;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
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
  matches(selector: string) {
    return selector === ":disabled" && this.disabled;
  }
  getBoundingClientRect() {
    return { height: 200, left: 0, top: 0, width: 200 };
  }
  remove() {
    this.connected = false;
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
}
class FixtureDocument extends EventTarget {
  hitTarget: Element | null = null;
  createElement() {
    return new Element(this);
  }
  readonly fonts = new EventTarget();
  elementFromPoint() {
    return this.hitTarget;
  }
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
  vi.unstubAllGlobals();
});
function fixture(spatial = false) {
  vi.useFakeTimers();
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "2" }));
  const document = new FixtureDocument(),
    root = new Element(document);
  let button = new Element(document);
  const screen = spatial ? new Element(document) : root;
  if (spatial) {
    screen.parentElement = root;
  }
  button.parentElement = screen;
  document.hitTarget = spatial ? screen : button;
  const host = root as unknown as HTMLElement;
  const guard = rootPressGuard(host);
  const stop = spatial
    ? bindAdaActionRoot(
        {
          guard,
          pointerRelease: {
            pointerTarget: document as unknown as Document,
            resolvePointer: () => undefined,
          },
          requiredReady: () => true,
          subscribeRequired: () => () => {},
        },
        host,
      ).dispose
    : bindAdaHoldActions(guard, host);
  const bindings = new Set<Pick<ReturnType<typeof bindAdaAction>, "dispose">>();
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
    createStandardTextAction,
    disposed: false,
    inCurrentView,
    readViewUnit: () => 2,
    root,
    screen,
  });
  const execute = (code: string) =>
    runInContext(
      ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
      context,
    );
  for (const name of [
    "buttonAvailability",
    "actionCurrent",
    "actionSlop",
    "registerAction",
    "forgetAction",
  ]) {
    execute(`const ${name} = ${actual(name)};`);
  }
  const register = execute("registerAction") as (
    action: { run: () => void; availability?: () => { kind: "available" } },
    target: unknown,
  ) => ReturnType<typeof bindAdaAction>;
  const event = (type: string, detail = 1, options = {}) => {
    const e = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({
      button: 0,
      clientX: spatial ? 100 : 10,
      clientY: spatial ? 100 : 10,
      detail,
      isPrimary: true,
      pointerId: 5,
      target: spatial ? screen : button,
      ...options,
    })) {
      Object.defineProperty(e, key, { value });
    }
    return e;
  };
  const send = (type: string, options = {}) => {
    document.dispatchEvent(event(type, 1, options));
    screen.dispatchEvent(event(type, 1, options));
  };
  const down = (options = {}) => send("pointerdown", options);
  const up = (options = {}) => send("pointerup", options);
  const click = (detail = 1, target = button) => {
    const e = event("click", detail, { target });
    root.dispatchEvent(e);
    if (!e.defaultPrevented) {
      target.dispatchEvent(event("click", detail, { target }));
    }
    return e;
  };
  const attach = (buttonElement: HTMLButtonElement) => {
    button = buttonElement as unknown as Element;
    button.parentElement = screen;
    document.hitTarget = button;
  };
  return {
    attach,
    bindings,
    button,
    click,
    context,
    document,
    down,
    execute,
    register,
    root,
    screen,
    send,
    up,
  };
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
  let offered = true;
  const state = { stardust: MAP_JUMP_COST };
  Object.assign(f.context, {
    canAffordMapJump,
    labels: { travelHere: "Travel here" },
    options: { onTravel, reducedMotion: () => true },
    refuse,
    selectedPlace: () => ({ id: "station" }),
    state,
    travelNow: () => ({ offered, reason: danger ? "danger" : null }),
    travelReasons: { danger: "Danger" },
  });
  const action = f.execute(
    `const travelAction = ${actual("travelAction")}; travelAction;`,
  ) as ReturnType<typeof createStandardTextAction>;
  cleanup.push(action.dispose);
  f.attach(action.element);
  expect(action.element.getAttribute("aria-disabled")).toBe("true");
  expect(action.element.disabled).toBe(false);
  f.down();
  f.up();
  f.click();
  expect(refuse).toHaveBeenCalledOnce();
  expect(onTravel).not.toHaveBeenCalled();
  f.down();
  vi.advanceTimersByTime(600);
  f.up();
  expect(f.click().defaultPrevented).toBe(true);
  expect(refuse).toHaveBeenCalledTimes(2);
  f.click(0);
  expect(refuse).toHaveBeenCalledTimes(3);
  expect(onTravel).not.toHaveBeenCalled();
  danger = false;
  state.stardust--;
  action.refresh();
  expect(action.element.hidden).toBe(false);
  expect(action.element.disabled).toBe(true);
  f.down();
  vi.advanceTimersByTime(600);
  f.up();
  f.click(0);
  expect(onTravel).not.toHaveBeenCalled();
  state.stardust++;
  action.refresh();
  expect(action.element.getAttribute("aria-disabled")).toBeNull();
  f.click(0);
  expect(onTravel).toHaveBeenCalledExactlyOnceWith("station");
  offered = false;
  action.refresh();
  expect(action.element.hidden).toBe(true);
  f.click(0);
  expect(onTravel).toHaveBeenCalledOnce();
});
it("never invokes an unavailable standard action outside its current live view", () => {
  const f = fixture();
  const root = f.root as unknown as HTMLElement;
  let current = true;
  const run = vi.fn();
  const refuse = vi.fn();
  const action = createStandardTextAction(root, "Travel here", {
    availability: () => ({ kind: "unavailable", reason: "Danger" }),
    current: () => current && inCurrentView(root, action.element),
    refuse,
    run,
  });
  f.attach(action.element);
  const button = action.element as unknown as Element;
  f.click(0);
  expect(refuse).toHaveBeenCalledExactlyOnceWith("Danger");
  refuse.mockClear();

  const cover = new Element(f.document);
  cover.parentElement = f.root;
  const leave = enterPressView(root, cover as unknown as HTMLElement);
  // Dispatch directly so the public onUnavailable handler is exercised even if the root is covered.
  const click = () => button.dispatchEvent(new Event("click", { cancelable: true }));
  click();
  leave();
  f.root.hidden = true;
  click();
  f.root.hidden = false;
  current = false;
  click();
  current = true;
  action.dispose();
  click();
  expect(refuse).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
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

const SIDE = CURRENT_FLIGHT_TOPOLOGY.side;
// The fixture screen: 200 CSS px at 2 CSS px per logical px.
const FIELD = { height: 100, width: 100, x: 0, y: 0 };
function spatialFixture(places = [{ id: "a", x: 0, y: 0 }]) {
  const f = fixture(true);
  const select = vi.fn();
  const chips = new Map<string, Element>();
  const schedule = vi.fn();
  Object.assign(f.context, {
    Element,
    HIT_RULE,
    VIEW_SCALE_EVENT,
    chipBindings: new Map(),
    chipRect,
    chips,
    chromeLayouts: [],
    document: f.document,
    fieldAction: null,
    framePoint,
    hitAround,
    invalidatePressScope,
    layout: () => ({ field: FIELD, fit: FIELD, inner: FIELD }),
    panView,
    panelLayout: { dispose: vi.fn() },
    pinch: null,
    places: () => places,
    pointers: new Map(),
    presentation: { clear: vi.fn() },
    press: null,
    pressedArea,
    refit: vi.fn(),
    renderQueue: { cancel: vi.fn(), dispose: vi.fn(), schedule },
    select,
    selected: null,
    shipMarker: { dispose: vi.fn() },
    toScreen,
    turnOf,
    view: { centre: { x: 0, y: 0 }, scale: 0.1, worldSide: SIDE },
    window: f.document.defaultView,
    zoomView,
  });
  for (const name of [
    "createMapButton",
    "local",
    "onChrome",
    "pinchOf",
    "cancelFieldAction",
    "resolveFieldPointer",
    "release",
  ]) {
    f.execute(`const ${name} = ${actual(name)};`);
  }
  f.execute(actual("screen"));
  f.execute(actual("pointerdown"));
  f.execute(actual("pointermove"));
  f.execute(`
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) screen.addEventListener(type, release);
    const lifecycle = ({ ${actual("close")}, ${actual("dispose")} });
  `);
  const addChip = (id: string) => {
    f.context.id = id;
    const { binding, button: chip } = f.execute(`((id) => ${actual("chip")})(id)`) as {
      binding: Pick<ReturnType<typeof bindAdaAction>, "dispose">;
      button: Element;
    };
    f.bindings.add(binding);
    chip.parentElement = f.screen;
    chips.set(id, chip);
    return { binding, chip };
  };
  const added = places.map(({ id }) => addChip(id));
  return { ...f, addChip, added, schedule, select };
}

it("takes the topmost expanded hit at pointerdown and holds it across a new projection", () => {
  const f = spatialFixture([
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 0, y: 0 },
  ]);
  f.down();
  expect(f.context.fieldAction.id).toBe("b");
  f.context.view = { centre: { x: 1000, y: 0 }, scale: 0.1, worldSide: SIDE };
  vi.advanceTimersByTime(499);
  expect(f.select).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(f.select).toHaveBeenCalledExactlyOnceWith("b");
  f.up();
  expect(f.click(1, f.screen).defaultPrevented).toBe(true);
  expect(f.select).toHaveBeenCalledOnce();
  f.click(0, f.added[0]!.chip);
  expect(f.select.mock.calls).toEqual([["b"], ["a"]]);
});

it.each([false, true])("selects and clears through the same root, hold=%s", (hold) => {
  const f = spatialFixture();
  for (const [clientX, expected] of [
    [100, "a"],
    [180, null],
  ] as const) {
    f.down({ clientX });
    expect(f.select).not.toHaveBeenCalled();
    if (hold) {
      vi.advanceTimersByTime(500);
    }
    expect(f.select).toHaveBeenCalledTimes(hold ? 1 : 0);
    f.up({ clientX });
    f.click(1, f.screen);
    expect(f.select).toHaveBeenCalledExactlyOnceWith(expected);
    f.select.mockClear();
  }
});

it.each([
  "drag",
  "pinch",
  "pointercancel",
  "lostpointercapture",
  "cover",
  "close",
  "replace",
] as const)("cancels %s and accepts only a fresh tap", (kind) => {
  const f = spatialFixture();
  f.down();
  let uncover: (() => void) | undefined;
  if (kind === "drag") {
    f.send("pointermove", { clientX: 135 });
  }
  if (kind === "pinch") {
    f.down({ clientX: 140, isPrimary: false, pointerId: 6, pointerType: "touch" });
    f.send("pointermove", { clientX: 170, pointerId: 6 });
    f.up({ pointerId: 6 });
  }
  if (kind === "pointercancel" || kind === "lostpointercapture") {
    f.send(kind);
  }
  if (kind === "cover") {
    const dialog = new Element(f.document);
    dialog.parentElement = f.root;
    uncover = enterPressView(f.root as unknown as HTMLElement, dialog as unknown as HTMLElement);
  }
  if (kind === "close") {
    f.execute("lifecycle.close()");
  }
  if (kind === "replace") {
    const { binding, chip } = f.added[0]!;
    binding.dispose();
    chip.remove();
    f.addChip("a");
  }
  vi.advanceTimersByTime(600);
  f.up();
  f.click(1, f.screen);
  expect(f.select).not.toHaveBeenCalled();
  if (kind === "drag" || kind === "pinch") {
    expect(f.schedule).toHaveBeenCalled();
  }
  uncover?.();
  f.screen.hidden = false;
  f.context.view = { centre: { x: 0, y: 0 }, scale: 0.1, worldSide: SIDE };
  f.down();
  f.up();
  expect(f.select).toHaveBeenCalledExactlyOnceWith("a");
});

it("disposes the field and chip bindings while a gesture is armed", () => {
  const f = spatialFixture();
  f.down();
  f.execute("lifecycle.dispose()");
  expect(f.bindings.size).toBe(0);
  expect(resolveAdaHoldAction(f.root as unknown as HTMLElement, f.screen)).toBeNull();
  vi.advanceTimersByTime(600);
  f.up();
  f.click(1, f.screen);
  expect(f.select).not.toHaveBeenCalled();
});

/** The view's edge inside the square's projected extent and its centre inside the diamond. */
function expectInSquare(view: MapView) {
  const tolerance = 1e-3;
  const middle = { x: FIELD.x + FIELD.width / 2, y: FIELD.y + FIELD.height / 2 };
  const reach = { x: FIELD.width / 2 / view.scale, y: FIELD.height / 2 / view.scale };
  expect(view.worldSide).toBe(SIDE);
  expect(middle).toEqual({ x: 50, y: 50 });
  for (const [axis, half] of [
    ["x", SIDE],
    ["y", SIDE / 2],
  ] as const) {
    if (reach[axis] > half) {
      expect(view.centre[axis]).toBeCloseTo(0, 3);
    } else {
      expect(view.centre[axis] - reach[axis]).toBeGreaterThanOrEqual(-half - tolerance);
      expect(view.centre[axis] + reach[axis]).toBeLessThanOrEqual(half + tolerance);
    }
  }
  expect(Math.abs(view.centre.x) / 2 + Math.abs(view.centre.y)).toBeLessThanOrEqual(
    SIDE / 2 + tolerance,
  );
}

function expectSurveyAtMin(view: MapView) {
  expect(view.scale).toBe(scaleLimits(FIELD, FIELD, SIDE).min);
  const { rx, ry, x, y } = mapSurveyEllipse(FIELD, view);
  expect(
    Math.hypot(Math.max(-x, 0, x - FIELD.width) / rx, Math.max(-y, 0, y - FIELD.height) / ry),
  ).toBeLessThan(1);
  expect(
    Math.hypot(Math.max(x, FIELD.width - x) / rx, Math.max(y, FIELD.height - y) / ry),
  ).toBeGreaterThan(1);
}

/** The spatial fixture with the actual zoom, wheel, select, goTo and refit wired in. */
function boundFixture() {
  const f = spatialFixture([
    { id: "a", x: 0, y: 0 },
    { id: "corner", x: SIDE / 2 - 1, y: SIDE / 2 - 1 },
  ]);
  const panel = Object.assign(f.document.createElement(), { scrollTop: 0 });
  f.screen.append(panel);
  Object.assign(f.context, {
    Node: f.document.defaultView.Node,
    clampView,
    dressPanel: () => {},
    focusTarget: () => {},
    keepClear,
    options: { reducedMotion: () => false },
    panel,
    panelTop: () => 80,
    presentation: { clear: () => {} },
    recentreView,
    refuse: vi.fn(),
    render: () => {},
    selectedPlace: () =>
      [
        { id: "a", x: 0, y: 0 },
        { id: "corner", x: SIDE / 2 - 1, y: SIDE / 2 - 1 },
      ].find(({ id }) => id === f.context.selected) ?? null,
  });
  for (const name of ["zoom", "select", "goTo", "refit"]) {
    f.execute(`var ${name} = ${actual(name)};`);
  }
  f.execute(actual("wheel"));
  return f;
}
const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 2, y: 1 },
  { x: -2, y: -1 },
];

it.each(DIRECTIONS)("keeps a hard drag toward %j inside the square", (direction) => {
  const f = boundFixture();
  f.down({ clientX: 100, clientY: 100 });
  for (let step = 1; step <= 50; step++) {
    // The map follows the pointer, so the view moves against the drag.
    f.send("pointermove", {
      clientX: 100 - direction.x * step * 1e5,
      clientY: 100 - direction.y * step * 1e5,
    });
    expectInSquare(f.context.view);
  }
  const stopped = f.context.view;
  f.send("pointermove", { clientX: 100 - direction.x * 9e6, clientY: 100 - direction.y * 9e6 });
  expect(f.context.view.centre.x).toBeCloseTo(stopped.centre.x, 3);
  expect(f.context.view.centre.y).toBeCloseTo(stopped.centre.y, 3);
});

it.each(DIRECTIONS)(
  "keeps the survey oval on screen during a minScale drag toward %j",
  (direction) => {
    const f = boundFixture();
    f.context.view.scale = scaleLimits(FIELD, FIELD, SIDE).min;
    f.down({ clientX: 100, clientY: 100 });
    f.send("pointermove", { clientX: 100 - direction.x * 1e7, clientY: 100 - direction.y * 1e7 });
    expectInSquare(f.context.view);
    expectSurveyAtMin(f.context.view);
  },
);

it("keeps a two-pointer pinch out and pan inside the square", () => {
  const f = boundFixture();
  f.down({ clientX: 90, clientY: 100 });
  f.down({ clientX: 110, clientY: 100, isPrimary: false, pointerId: 6, pointerType: "touch" });
  for (let step = 1; step <= 40; step++) {
    // The pointers close in, zooming out, while their midpoint travels right.
    const mid = 100 + step * 1e4;
    const half = Math.max(0.5, 10 - step / 4);
    f.send("pointermove", { clientX: mid - half, clientY: 100 });
    f.send("pointermove", { clientX: mid + half, clientY: 100, pointerId: 6 });
    expectInSquare(f.context.view);
  }
  expect(f.context.view.scale).toBeLessThan(0.1);
  expectSurveyAtMin(f.context.view);
});

it.each([
  { deltaMode: 0, deltaY: 400 },
  { deltaMode: 1, deltaY: 12 },
])("keeps wheel zoom-out near each edge inside the square: %j", (wheel) => {
  for (const direction of DIRECTIONS) {
    const f = boundFixture();
    f.context.view = panView(
      FIELD,
      FIELD,
      { x: -direction.x * 1e7, y: -direction.y * 1e7 },
      {
        centre: { x: 0, y: 0 },
        scale: 0.1,
        worldSide: SIDE,
      },
    );
    for (let step = 0; step < 12; step++) {
      f.send("wheel", { clientX: 10 + 30 * step, clientY: 190, ...wheel });
      expectInSquare(f.context.view);
    }
    expectSurveyAtMin(f.context.view);
  }
});

it("keeps the zoom tools inside the square near an edge and refuses at the cap", () => {
  const f = boundFixture();
  f.context.view = panView(
    FIELD,
    FIELD,
    { x: -1e7, y: 0 },
    {
      centre: { x: 0, y: 0 },
      scale: 0.1,
      worldSide: SIDE,
    },
  );
  // A press or Enter on Zoom out runs the same action: one step about the fit centre.
  for (let step = 0; step < 12; step++) {
    f.execute("zoom(1 / MAP_SCREEN.zoomStep, { x: 50, y: 50 }, {})");
    expectInSquare(f.context.view);
  }
  expectSurveyAtMin(f.context.view);
  expect(f.context.refuse).toHaveBeenCalled();
  f.context.refuse.mockClear();
  f.execute("zoom(1 / MAP_SCREEN.zoomStep, { x: 50, y: 50 }, {})");
  expect(f.context.refuse).toHaveBeenCalledOnce();
});

it("keeps recentre on a corner place, its selection and a refit inside the square", () => {
  const f = boundFixture();
  f.execute(`goTo({ id: "corner", x: ${SIDE / 2 - 1}, y: ${SIDE / 2 - 1} })`);
  expectInSquare(f.context.view);
  const at = toScreen(FIELD, f.context.view, { x: SIDE / 2 - 1, y: SIDE / 2 - 1 });
  expect(at.y).toBeGreaterThanOrEqual(FIELD.y);
  expect(at.y).toBeLessThanOrEqual(FIELD.y + FIELD.height);
  f.context.view = { centre: { x: 4e6, y: -4e6 }, scale: 1, worldSide: SIDE };
  f.execute("refit()");
  expectInSquare(f.context.view);
  f.context.view = { centre: { x: 4e6, y: -4e6 }, scale: 0, worldSide: SIDE };
  f.execute("refit()");
  expectInSquare(f.context.view);
  expectSurveyAtMin(f.context.view);
});
