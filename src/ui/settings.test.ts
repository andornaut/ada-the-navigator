import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SETTINGS_STATE_LABELS } from "../data/settingsCopy.ts";
import * as actionBinding from "./actionBinding.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { DEVICE_STORAGE_KEYS } from "./deviceSettings.ts";
import { PAGE_DIVIDER_STYLE } from "./layout/controlPresentation.ts";
import * as modal from "./modal.ts";
import { currentView, rootPressGuard } from "./pressScope.ts";
import { createSettings, SETTINGS_STYLE, type SettingsLabels } from "./settings.ts";

vi.mock("./uiSkin.ts", () => ({ applyButtonSkin: vi.fn().mockResolvedValue(undefined) }));

class Element {
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  get parentElement(): Element | null {
    return this.parent ?? null;
  }
  readonly nodeType = 1;
  tagName = "DIV";
  tabIndex = 0;
  clientWidth = 720;
  focus() {
    (document as unknown as { activeElement: Element | null }).activeElement = this;
  }
  getClientRects() {
    return [];
  }
  getBoundingClientRect() {
    return { bottom: 20, height: 20, left: 0, right: 100, top: 0, width: 100, x: 0, y: 0 };
  }
  hasAttribute(name: string) {
    return name === "hidden" ? this.hidden : this.attributes.has(name);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  getAttributeNames() {
    return [...this.attributes.keys()];
  }
  attached = false;
  get isConnected(): boolean {
    return this.parent?.isConnected ?? this.attached;
  }
  get parentNode(): Element | null {
    return this.parent ?? null;
  }
  get nextSibling(): Element | null {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  get firstElementChild(): Element | null {
    return this.children[0] ?? null;
  }
  get firstChild(): Element | null {
    return this.firstElementChild;
  }
  get ownerDocument() {
    return document;
  }
  contains(node: unknown): boolean {
    return (
      node === this ||
      (node instanceof Element && Boolean(node.parent) && this.contains(node.parent))
    );
  }
  className = "";
  readonly classList = {
    add: vi.fn((...names: string[]) => {
      this.className = [...new Set([...this.className.split(" "), ...names])]
        .filter(Boolean)
        .join(" ");
    }),
    remove: vi.fn((name: string) => {
      this.className = this.className
        .split(" ")
        .filter((item) => item !== name)
        .join(" ");
    }),
    toggle: (name: string, on: boolean) => {
      if (on) {
        this.classList.add(name);
      } else {
        this.classList.remove(name);
      }
      return on;
    },
  };
  readonly dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  parent: Element | undefined;
  readonly listeners = new Map<string, ((event: Event) => void)[]>();
  readonly properties = new Map<string, string>();
  readonly style = {
    getPropertyValue: (name: string) => this.properties.get(name) ?? "",
    removeProperty: (name: string) => {
      const value = this.properties.get(name) ?? "";
      this.properties.delete(name);
      return value;
    },
    setProperty: vi.fn((name: string, value: string) => this.properties.set(name, value)),
  };
  private text = "";
  get textContent(): string {
    return this.text + this.children.map(({ textContent }) => textContent).join("");
  }
  set textContent(value: string) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.text = value;
  }
  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item !== listener),
    );
  }
  append(...nodes: Element[]) {
    for (const node of nodes) {
      node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes: Element[]) {
    this.textContent = "";
    this.append(...nodes);
  }
  dispatchEvent(event: Event) {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    return !event.defaultPrevented;
  }
  click() {
    if (this.disabled) {
      return;
    }
    const event = new Event("click", { cancelable: true });
    Object.defineProperty(event, "target", { value: this });
    this.dispatchEvent(event);
  }
  closest(selector = "[hidden]"): Element | null {
    return (selector.includes("hidden") && this.hidden) ||
      (selector.includes("inert") && this.attributes.has("inert"))
      ? this
      : (this.parent?.closest(selector) ?? null);
  }
  get lastElementChild() {
    return this.children.at(-1);
  }
  insertBefore(node: Element, before: Element | null) {
    if (node === before) {
      return;
    }
    node.remove();
    node.parent = this;
    this.children.splice(
      before === null ? this.children.length : this.children.indexOf(before),
      0,
      node,
    );
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const rule = part.trim();
      if (rule === ":disabled") {
        return Boolean((this as unknown as HTMLButtonElement).disabled);
      }
      if (rule.startsWith(".")) {
        return this.className.split(" ").includes(rule.slice(1));
      }
      const attribute = /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(rule);
      if (attribute) {
        const name = attribute[1]!;
        const value = name.startsWith("data-")
          ? this.dataset[name.slice(5)]
          : this.getAttribute(name);
        return attribute[2] === undefined
          ? value !== undefined && value !== null
          : value === attribute[2];
      }
      const tag = /^(\w+)(?:\[type="([^"]+)"\])?$/.exec(rule);
      return Boolean(
        tag &&
        this.tagName.toLowerCase() === tag[1] &&
        (tag[2] === undefined || this.getAttribute("type") === tag[2]),
      );
    });
  }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string): Element | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  remove() {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }
    this.parent = undefined;
  }
  toggleAttribute(name: string, on: boolean) {
    if (on) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

const labels: SettingsLabels = {
  aimControls: "Aim controls",
  close: "Close",
  controlsNote: "Touch still works when hidden",
  install: "Install",
  motionNote: "Motion help",
  moveControls: "Move controls",
  reducedMotion: "Reduced motion",
  settings: "Settings",
  sound: "Sound effects",
  soundNote: "Sound help",
};

let stored: Map<string, string>;
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  vi.stubGlobal("HTMLElement", Element);
  vi.stubGlobal("Node", Element);
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), {
      activeElement: null as Element | null,
      createElement: (tag: string) => Object.assign(new Element(), { tagName: tag.toUpperCase() }),
      defaultView: Object.assign(new EventTarget(), {
        HTMLElement: Element,
        MutationObserver: class {
          disconnect() {}
          observe() {}
          takeRecords() {
            return [];
          }
        },
        Node: Element,
      }),
    }),
  );
  vi.stubGlobal("getComputedStyle", () => ({
    columnGap: "0",
    getPropertyValue: () => "1",
    paddingLeft: "0",
    paddingRight: "0",
  }));
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    matchMedia: () => ({ matches: false }),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function fixtureParent(): HTMLElement {
  const parent = fixtureActionRoot(new Element());
  parent.attached = true;
  return parent as unknown as HTMLElement;
}

function fpsReadout() {
  return { set: vi.fn<(value: boolean) => void>() };
}

function setup(copy: SettingsLabels = labels, detached = false) {
  const onFeedbackChange = vi.fn();
  const onVisibilityChange = vi.fn();
  const fpsCounter = fpsReadout();
  const settings = createSettings(
    detached ? (new Element() as unknown as HTMLElement) : fixtureParent(),
    {
      build: "test-build",
      fpsCounter,
      labels: copy,
      onFeedbackChange,
      onOpenChange: vi.fn(),
      onVisibilityChange,
      storage: localStorage,
    },
  );
  fixtureActionRoot(settings.root);
  const columns = (settings.card as unknown as Element).children[0]!.children;
  const rows = [...columns[0]!.children, ...columns[2]!.children];
  return { columns, fpsCounter, onFeedbackChange, onVisibilityChange, rows, settings };
}

const toggleStack = (row: Element) =>
  row.children.find((node) => node.className === "ada-setting-toggle")!;
const state = (row: Element) => toggleStack(row).children[1]!;

describe("Settings current-state labels", () => {
  it("places each state below its switch inside one shared-width stack", () => {
    const { rows, settings } = setup();
    for (const row of rows.filter((row) => row.dataset.setting !== "fpsCounter")) {
      const stack = toggleStack(row);
      expect(stack.children[0]!.className).toBe("ada-switch");
      expect(stack.children[1]!.className).toBe("ada-setting-state");
      expect(row.children).toHaveLength(3);
    }
    settings.dispose();
  });
  it("retains control instances in independent columns with the shared native divider", () => {
    const { columns, rows, settings } = setup();
    const dividers = columns.filter((row) => row.attributes.get("aria-orientation") === "vertical");
    expect(dividers).toHaveLength(1);
    expect(dividers[0]!.hidden).toBe(true);
    expect(dividers[0]!.properties.size).toBe(0);
    expect(
      rows
        .filter((row) => row.dataset.setting !== "fpsCounter")
        .map((row) => row.attributes.get("data-ui-placement")),
    ).toEqual(["top", "top", "top", "top"]);
    expect(columns[0]!.children.map((row) => row.dataset.setting)).toEqual([
      "move",
      "aim",
      "sound",
    ]);
    expect(columns[2]!.children.map((row) => row.dataset.setting)).toEqual([
      "fpsCounter",
      "reducedMotion",
    ]);
    expect(rows).toHaveLength(5);
    const root = settings.root as unknown as Element;
    expect(root.properties.get("--ui-page-divider-thickness")).toBe(
      String(PAGE_DIVIDER_STYLE.thickness),
    );
    expect(root.properties.get("--ui-page-divider-colour")).toBe(
      `#${PAGE_DIVIDER_STYLE.colour.toString(16)}`,
    );
    const rule = SETTINGS_STYLE.match(
      /\.ada-settings-rows\[data-columns="2"\] > \.ada-page-divider\{([^}]+)\}/u,
    )?.[1];
    expect(rule).toBeDefined();
    expect(rule).not.toMatch(/background|width:|border/u);
    expect(SETTINGS_STYLE).not.toContain('.ada-settings-rows[data-columns="2"]::before');
    settings.dispose();
  });

  it("shares the switch-row icon and state styles with every Settings switch", () => {
    expect(SETTINGS_STYLE).toContain(".ada-controls .ada-setting-toggle{");
    expect(SETTINGS_STYLE).not.toContain("[data-dialog=settings] .ada-setting-toggle");
    expect(SETTINGS_STYLE).toContain(".ada-controls .ada-row[role=switch] > .ada-icon{");
  });

  it("provides one canonical Back in its own centered footer without changing the close action", () => {
    const { settings } = setup();
    const actions = settings.actions as unknown as Element;
    expect(actions.dataset.footerAction).toBe("back");
    expect(actions.children.map((button) => button.textContent)).toEqual([
      CONTENT.labels.questBack,
    ]);
    expect(actions.children[0]!.dataset.action).toBe("settings-close");
    expect(actions.children[0]!.className).toContain("ada-primary");
    expect(actions.children[0]!.matches(".ui-standard-button")).toBe(true);
    settings.dispose();
  });
  it("labels install-guide return Back while retaining the independent header Close", () => {
    const { settings } = setup();
    const root = settings.root as unknown as Element;
    const modal = root.children.find((node) => node.className === "ada-modal")!;
    const guide = modal.children[1]!;
    const section = guide.children[0]!;
    const body = section.children[1]!;
    const footer = body.children[1]!;
    expect(footer.dataset.footerAction).toBe("back");
    expect(footer.children[0]!.textContent).toBe(CONTENT.labels.questBack);
    expect(footer.children[0]!.dataset.action).toBe("close-install-steps");
    expect(footer.children[0]!.matches(".ui-standard-button")).toBe(true);
    expect(guide.children[1]!.attributes.get("aria-label")).toBe(labels.close);
    settings.dispose();
  });
  it("uses the large Settings cap while retaining the medium install-steps card", () => {
    const { settings } = setup();
    const root = settings.root as unknown as Element;
    const modal = root.children.find((node) => node.className === "ada-modal")!;
    const [card, steps] = modal.children;
    expect(card!.dataset.cardSize).toBe("large");
    expect(card!.dataset.dialog).toBe("settings");
    expect(card!.attributes.get("aria-label")).toBe(labels.settings);
    expect(steps!.dataset.cardSize).toBe("medium");
    settings.dispose();
  });

  it("names settings separately from their initial current state and preserves switch semantics", () => {
    const { rows, settings } = setup();
    expect(
      rows
        .filter((row) => row.dataset.setting !== "fpsCounter")
        .map((row) => state(row).textContent),
    ).toEqual(["Shown", "Shown", "On", "Off"]);
    expect(
      rows
        .filter((row) => row.dataset.setting !== "fpsCounter")
        .map((row) => row.attributes.get("aria-label")),
    ).toEqual(["Move controls", "Aim controls", "Sound effects", "Reduced motion"]);
    for (const row of rows.filter((row) => row.dataset.setting !== "fpsCounter")) {
      expect(row.attributes.get("role")).toBe("switch");
      expect(row.attributes.get("aria-describedby")).toBe(`ada-note-${row.dataset.setting}`);
      expect(state(row).attributes.get("aria-hidden")).toBe("true");
    }
    expect(rows).toHaveLength(5);
    settings.dispose();
  });

  it("persists FPS on and off and applies it while Settings is closed", () => {
    const { fpsCounter, onFeedbackChange, onVisibilityChange, rows, settings } = setup();
    const key = "ada-the-navigator.fps-counter";
    const row = rows.find((node) => node.dataset.setting === "fpsCounter")!;
    expect(row.attributes.get("aria-label")).toBe("FPS counter");
    expect(row.attributes.get("role")).toBe("switch");
    expect(row.attributes.get("aria-checked")).toBe("false");
    expect(state(row).textContent).toBe("Off");
    expect(row.children[0]!.dataset.icon).toBe("icon-fps-counter");
    expect(settings.isOpen()).toBe(false);
    expect(fpsCounter.set).toHaveBeenCalledExactlyOnceWith(false);
    expect(stored.has(key)).toBe(false);
    const priorStored = new Map(stored);
    const priorFeedbackCalls = onFeedbackChange.mock.calls.length;
    const priorVisibilityCalls = onVisibilityChange.mock.calls.length;
    row.click();
    expect(fpsCounter.set).toHaveBeenLastCalledWith(true);
    expect([...stored]).toEqual([...priorStored, [key, "on"]]);
    expect(row.attributes.get("aria-checked")).toBe("true");
    expect(state(row).textContent).toBe("On");
    expect(onFeedbackChange).toHaveBeenCalledTimes(priorFeedbackCalls);
    expect(onVisibilityChange).toHaveBeenCalledTimes(priorVisibilityCalls);
    settings.dispose();

    const reopened = setup();
    const restored = reopened.rows.find((node) => node.dataset.setting === "fpsCounter")!;
    expect(reopened.settings.isOpen()).toBe(false);
    expect(reopened.fpsCounter.set).toHaveBeenCalledExactlyOnceWith(true);
    expect(state(restored).textContent).toBe("On");
    restored.click();
    expect(reopened.fpsCounter.set).toHaveBeenLastCalledWith(false);
    expect(restored.attributes.get("aria-checked")).toBe("false");
    expect(state(restored).textContent).toBe("Off");
    expect([...stored]).toEqual([...priorStored, [key, "off"]]);
    reopened.settings.dispose();

    const disabled = setup();
    expect(disabled.fpsCounter.set).toHaveBeenCalledExactlyOnceWith(false);
    expect(
      state(disabled.rows.find((node) => node.dataset.setting === "fpsCounter")!).textContent,
    ).toBe("Off");
    disabled.settings.dispose();
  });

  it("recreates Settings from all five choices without changing their storage", () => {
    const { rows, settings } = setup();
    const choices = Object.entries({
      aim: "off",
      fpsCounter: "on",
      move: "off",
      reducedMotion: "on",
      sound: "off",
    });
    for (const [setting] of choices) {
      rows.find((row) => row.dataset.setting === setting)!.click();
    }
    settings.dispose();
    const values = [...stored];
    const restored = setup();
    const checked = Object.fromEntries(
      restored.rows.map((row) => [
        row.dataset.setting,
        row.attributes.get("aria-checked") === "true" ? "on" : "off",
      ]),
    );
    expect(checked).toEqual(Object.fromEntries(choices));
    expect(restored.fpsCounter.set).toHaveBeenCalledExactlyOnceWith(true);
    expect(restored.onVisibilityChange).toHaveBeenCalledExactlyOnceWith({
      aim: false,
      move: false,
    });
    expect(restored.onFeedbackChange).toHaveBeenCalledExactlyOnceWith({
      reducedMotion: true,
      sound: false,
    });
    expect([...stored]).toEqual(values);
    restored.settings.dispose();
  });

  it.each(["move", "aim", "sound", "reducedMotion"] as const)(
    "updates %s text with stored state and repeated activations without changing help",
    (key) => {
      stored.set(DEVICE_STORAGE_KEYS[key], "off");
      const { rows, settings } = setup();
      const row = rows.find((node) => node.dataset.setting === key)!;
      const text = row.children[1]!;
      const caption = text.children[0]!.textContent;
      const help = text.children[1]!.textContent;
      const visible = key === "move" || key === "aim";
      expect(state(row).textContent).toBe(visible ? "Hidden" : "Off");
      for (const on of [true, false, true]) {
        row.click();
        expect(state(row).textContent).toBe(
          visible ? (on ? "Shown" : "Hidden") : on ? "On" : "Off",
        );
        expect(row.attributes.get("aria-checked")).toBe(String(on));
        expect(toggleStack(row).children[0]!.dataset.tag).toBe(on ? "on" : "off");
        expect(stored.get(DEVICE_STORAGE_KEYS[key])).toBe(on ? "on" : "off");
        expect(text.children[0]!.textContent).toBe(caption);
        expect(text.children[1]!.textContent).toBe(help);
      }
      settings.dispose();
    },
  );

  it("uses injected current-state words without changing accessible checked state", () => {
    const { rows, settings } = setup({
      ...labels,
      stateHidden: "hidden-test",
      stateOff: "off-test",
      stateOn: "on-test",
      stateShown: "shown-test",
    });
    expect(state(rows[0]!).textContent).toBe("shown-test");
    expect(state(rows[2]!).textContent).toBe("on-test");
    rows[0]!.click();
    rows[2]!.click();
    expect(state(rows[0]!).textContent).toBe("hidden-test");
    expect(state(rows[2]!).textContent).toBe("off-test");
    expect(rows[0]!.attributes.get("aria-checked")).toBe("false");
    expect(rows[2]!.attributes.get("aria-checked")).toBe("false");
    settings.dispose();
  });

  it("keeps the approved setting names and static effect help in canonical copy", () => {
    expect(SETTINGS_STATE_LABELS).toEqual({
      hidden: "Hidden",
      off: "Off",
      on: "On",
      shown: "Shown",
    });
    expect(CONTENT.labels.sound).toBe("Sound effects");
    expect(CONTENT.labels.soundNote).toBe("Controls gameplay sound effects.");
    expect(CONTENT.labels.motionNote).toBe(
      "Reduces animation and disables screen shake and flashes.",
    );
  });

  it("reports visibility and feedback changes through the existing separate callbacks", () => {
    const { onFeedbackChange, onVisibilityChange, rows, settings } = setup();
    onFeedbackChange.mockClear();
    onVisibilityChange.mockClear();
    rows[0]!.click();
    expect(onVisibilityChange).toHaveBeenLastCalledWith({ aim: true, move: false });
    expect(onFeedbackChange).not.toHaveBeenCalled();
    rows[2]!.click();
    expect(onFeedbackChange).toHaveBeenLastCalledWith({ reducedMotion: false, sound: false });
    expect(onVisibilityChange).toHaveBeenCalledTimes(1);
    settings.dispose();
  });
});

it("registers the actual Settings switch callback for held activation and removes it on disposal", () => {
  const { onVisibilityChange, rows, settings } = setup();
  const row = rows[0]!;
  // Expose retained component nodes without a layout or browser claim.
  for (let parent: Element | undefined = row; parent; parent = parent.parent) {
    parent.hidden = false;
  }
  const action = resolveAdaHoldAction(settings.root, row as unknown as HTMLElement);
  expect(action?.rule.holdMs).toBe(500);
  expect(action?.available()).toBe(true);
  action?.activate();
  expect(state(row).textContent).toBe("Hidden");
  expect(onVisibilityChange).toHaveBeenLastCalledWith({ aim: true, move: false });
  row.click();
  expect(state(row).textContent).toBe("Shown");
  settings.dispose();
  expect(resolveAdaHoldAction(settings.root, row as unknown as HTMLElement)).toBeNull();
});

it("offers one Install button and cancels a deferred guide after closing Settings", async () => {
  let finish!: (outcome: "steps") => void;
  const pending = new Promise<"steps">((resolve) => {
    finish = resolve;
  });
  const install = vi.fn(() => pending);
  const settings = createSettings(fixtureParent(), {
    build: "test-build",
    fpsCounter: fpsReadout(),
    install: {
      port: {
        install,
        offers: () => true,
        onChange: () => () => {},
        state: () => "prompt",
        stepsKind: () => "other",
      },
      steps: CONTENT.installSteps,
    },
    labels,
    onOpenChange: vi.fn(),
    onVisibilityChange: vi.fn(),
    storage: localStorage,
  });
  fixtureActionRoot(settings.root);
  settings.open();
  const card = settings.card as unknown as Element;
  const button = card.querySelector('[data-action="install"]')!;
  const row = button.parent!;
  const [icon, label] = button.children;
  const event = new Event("click", { cancelable: true });
  Object.defineProperty(event, "target", { value: label });
  expect(button.matches(".ui-standard-button")).toBe(true);
  expect(row.children).toEqual([button]);
  expect(icon?.className).toBe("ada-install-icon");
  expect(icon?.getAttribute("aria-hidden")).toBe("true");
  expect(row.textContent).toBe(labels.install);

  const held = resolveAdaHoldAction(settings.root, button as unknown as HTMLElement);
  button.disabled = true;
  button.click();
  expect(held?.available()).toBe(false);
  expect(install).not.toHaveBeenCalled();
  button.disabled = false;
  row.click();
  expect(install).not.toHaveBeenCalled();
  button.dispatchEvent(event);
  row.dispatchEvent(event);
  expect(install).toHaveBeenCalledOnce();
  expect(settings.stepsOpen()).toBe(false);
  expect(held?.available()).toBe(true);
  held?.activate();
  expect(install).toHaveBeenCalledTimes(2);
  (settings.actions as unknown as Element).children[0]!.click();
  finish("steps");
  await pending;
  expect(settings.stepsOpen()).toBe(false);
  expect(settings.isOpen()).toBe(false);
  expect(held?.available()).toBe(false);
  settings.dispose();
  expect(button.listeners.get("click")).toHaveLength(0);
});

it("retains native widgets while the entire Install row leaves and rejoins the tree", () => {
  let installed = false;
  let notify: (() => void) | undefined;
  const stop = vi.fn();
  const settings = createSettings(fixtureParent(), {
    build: "test-build",
    fpsCounter: fpsReadout(),
    install: {
      port: {
        install: async () => "dismissed",
        offers: () => !installed,
        onChange: (listener) => {
          notify = () => listener(installed ? "installed" : "prompt");
          return stop;
        },
        state: () => "prompt",
        stepsKind: () => "other",
      },
      steps: CONTENT.installSteps,
    },
    labels,
    onOpenChange: vi.fn(),
    onVisibilityChange: vi.fn(),
    storage: localStorage,
  });
  fixtureActionRoot(settings.root);
  const nodes = (node: Element): Element[] => [node, ...node.children.flatMap(nodes)];
  const modal = (settings.root as unknown as Element).children.find(
    (node) => node.className === "ada-modal",
  )!;
  const frame = modal.children[0];
  const initial = nodes(settings.card as unknown as Element);
  const install = initial.find((node) => node.className.includes("ada-install-row"))!;
  const move = initial.find((node) => node.dataset.setting === "move")!;
  const fps = initial.find((node) => node.dataset.setting === "fpsCounter")!;
  expect(fps.parent?.dataset.settingsColumn).toBe("right");
  expect(install).toBeDefined();
  installed = true;
  notify!();
  expect(nodes(settings.card as unknown as Element)).not.toContain(install);
  expect(nodes(settings.card as unknown as Element)).toContain(fps);
  expect(fps.parent?.dataset.settingsColumn).toBe("right");
  expect(nodes(settings.card as unknown as Element)).toContain(move);
  installed = false;
  notify!();
  expect(nodes(settings.card as unknown as Element)).toContain(install);
  expect(nodes(settings.card as unknown as Element)).toContain(fps);
  expect(fps.parent?.dataset.settingsColumn).toBe("right");
  expect(fps.listeners.get("click")).toHaveLength(1);
  expect(nodes(settings.card as unknown as Element)).toContain(move);
  expect(move.listeners.get("click")).toHaveLength(1);
  expect(modal.children[0]).toBe(frame);
  settings.dispose();
  expect(stop).toHaveBeenCalledOnce();
  expect(move.listeners.get("click")).toHaveLength(0);
});

it("isolates Settings, releases its foreground once and restores the original opener", () => {
  const { settings } = setup();
  const origin = document.createElement("button") as unknown as Element;
  (settings.root.parentElement as unknown as Element).append(origin);
  origin.focus();
  const guard = rootPressGuard(settings.root);
  const before = guard.gate.capture();
  settings.open();
  expect(before()).toBe(false);
  const modal = (settings.root as unknown as Element).children.find(
    (node) => node.className === "ada-modal",
  )!;
  const frame = modal.children[0]!;
  expect(currentView(settings.root)).toBe(frame);
  expect(frame.getAttribute("aria-modal")).toBe("true");
  expect(frame.contains(document.activeElement)).toBe(true);
  const opened = guard.gate.capture();
  settings.close();
  expect(opened()).toBe(false);
  expect(modal.hidden).toBe(true);
  expect(currentView(settings.root)).toBe(settings.root);
  expect(document.activeElement).toBe(origin);
  settings.close();
  settings.dispose();
});

it("publishes bound Settings and Install Steps, then returns to the same native Settings frame", async () => {
  const onOpenChange = vi.fn();
  const parent = fixtureParent();
  const useButton = document.createElement("button");
  useButton.type = "button";
  useButton.className = "ada-use";
  useButton.hidden = true;
  const append = parent.append.bind(parent);
  const published: string[][] = [];
  vi.spyOn(parent, "append").mockImplementation((...nodes) => {
    append(...nodes);
    const root = nodes[0] as HTMLElement;
    expect(root.isConnected).toBe(true);
    published.push(
      [...root.querySelectorAll<HTMLElement>("[data-action]")]
        .map((element) => {
          const id = element.dataset.action!;
          try {
            actionBinding.assertAdaActionMetadata(element);
            return id;
          } catch {
            return `${id} (unbound)`;
          }
        })
        .sort(),
    );
    const use = root.querySelector<HTMLElement>(".ada-use")!;
    expect(use.hidden).toBe(true);
    expect(() => actionBinding.assertAdaActionMetadata(use)).toThrow(
      "no registered action binding",
    );
  });
  const settings = createSettings(parent, {
    build: "test-build",
    fpsCounter: fpsReadout(),
    install: {
      port: {
        install: async () => "steps",
        offers: () => true,
        onChange: () => () => {},
        state: () => "prompt",
        stepsKind: () => "other",
      },
      steps: CONTENT.installSteps,
    },
    labels,
    onOpenChange,
    onVisibilityChange: vi.fn(),
    storage: localStorage,
    useButton,
  });
  fixtureActionRoot(settings.root);
  expect(published).toEqual([
    ["close-install-steps", "close-install-steps", "close-settings", "install", "settings-close"],
  ]);
  expect(settings.root.querySelector(".ada-settings-open")).toBeNull();
  settings.open();
  const root = settings.root as unknown as Element;
  const modal = root.children.find((node) => node.className === "ada-modal")!;
  const [frame, steps] = modal.children;
  const all = (node: Element): Element[] => [node, ...node.children.flatMap(all)];
  const install = all(frame!).find((node) => node.dataset.action === "install")!;
  install.click();
  await Promise.resolve();
  expect(settings.stepsOpen()).toBe(true);
  expect(frame!.hidden).toBe(true);
  expect(steps!.hidden).toBe(false);
  expect(currentView(settings.root)).toBe(steps);
  expect(steps!.contains(document.activeElement)).toBe(true);
  settings.closeSteps();
  expect(frame!.hidden).toBe(false);
  expect(steps!.hidden).toBe(true);
  expect(currentView(settings.root)).toBe(frame);
  expect(document.activeElement).toBe(install);
  expect(onOpenChange.mock.calls).toEqual([[true]]);
  const captured = rootPressGuard(settings.root).gate.capture();
  settings.dispose();
  expect(captured()).toBe(false);
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
});

it.each(["move", "close-settings", "close-install-steps"])(
  "rejects missing Settings semantic metadata %s before publication and releases its registrations",
  (id) => {
    const original = actionBinding.bindAdaAction;
    const disposals: (() => void)[] = [];
    const createSwitchRow = modal.createSwitchRow;
    let omitSwitchBinding = false;
    vi.spyOn(modal, "createSwitchRow").mockImplementation((options) => {
      omitSwitchBinding = options.id === id;
      try {
        return createSwitchRow(options);
      } finally {
        omitSwitchBinding = false;
      }
    });
    vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) => {
      if (omitSwitchBinding || element.dataset.action === id) {
        return { activate: () => false, dispose() {}, update() {} };
      }
      const binding = original(options, element);
      const dispose = vi.spyOn(binding, "dispose");
      disposals.push(dispose);
      return binding;
    });
    const parent = fixtureParent();
    const append = vi.spyOn(parent, "append");
    expect(() =>
      createSettings(parent, {
        build: "test-build",
        fpsCounter: fpsReadout(),
        labels,
        onOpenChange: vi.fn(),
        onVisibilityChange: vi.fn(),
        storage: localStorage,
      }),
    ).toThrow("no registered action binding");
    expect(append).not.toHaveBeenCalled();
    expect(disposals.length).toBeGreaterThan(0);
    for (const dispose of disposals) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  },
);

it("audits completed Settings metadata without reading policy or requiring external Use binding", () => {
  const original = actionBinding.bindAdaAction;
  const policy = vi.fn(() => {
    throw Error("construction evaluated runtime policy");
  });
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, element) =>
    original(
      { ...options, click: { ...options.click, availability: policy }, current: policy },
      element,
    ),
  );
  const { settings } = setup(labels, true);
  expect(settings.root.isConnected).toBe(false);
  expect(policy).not.toHaveBeenCalled();
  settings.dispose();
});

it("rejects an externally inserted unbound Settings launcher before entry focus", () => {
  const { settings } = setup();
  const launcher = document.createElement("button");
  settings.card.append(launcher);
  const focusedBefore = document.activeElement;
  expect(() => settings.open()).toThrow("no registered action binding");
  expect(document.activeElement).toBe(focusedBefore);
  settings.dispose();
});

it("audits Settings and Install Steps entry scopes while retaining external binding ownership", async () => {
  const settings = createSettings(fixtureParent(), {
    build: "test-build",
    fpsCounter: fpsReadout(),
    install: {
      port: {
        install: async () => "steps",
        offers: () => true,
        onChange: () => () => {},
        state: () => "prompt",
        stepsKind: () => "other",
      },
      steps: CONTENT.installSteps,
    },
    labels,
    onOpenChange: vi.fn(),
    onVisibilityChange: vi.fn(),
    storage: localStorage,
  });
  fixtureActionRoot(settings.root);
  const launcher = document.createElement("button");
  settings.card.append(launcher);
  const external = actionBinding.bindAdaAction(
    {
      click: { availability: () => ({ kind: "available" }), run: vi.fn() },
      current: () => true,
      slopPx: () => 8,
    },
    launcher,
  );
  const audit = vi.spyOn(actionBinding, "assertAdaActionBindings");
  settings.open();
  const modal = (settings.root as unknown as Element).children.find(
    (node) => node.className === "ada-modal",
  )!;
  const [card, steps] = modal.children;
  expect(audit.mock.calls.map(([scope]) => scope)).toEqual([card]);
  const install = (settings.card as unknown as Element).querySelector('[data-action="install"]')!;
  install.click();
  await Promise.resolve();
  expect(audit.mock.calls.map(([scope]) => scope)).toEqual([card, steps]);
  settings.closeSteps();
  expect(audit.mock.calls.map(([scope]) => scope)).toEqual([card, steps, card]);
  expect(audit.mock.calls.every(([scope]) => scope !== settings.root)).toBe(true);
  external.dispose();
  settings.dispose();
});
