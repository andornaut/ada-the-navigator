import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SETTINGS_STATE_LABELS } from "../data/settingsCopy.ts";
import { resolveAdaHoldAction } from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { DEVICE_STORAGE_KEYS } from "./deviceSettings.ts";
import { PAGE_DIVIDER_STYLE } from "./layout/controlPresentation.ts";
import { createSettings, SETTINGS_STYLE, type SettingsLabels } from "./settings.ts";

vi.mock("./uiSkin.ts", () => ({ applyButtonSkin: vi.fn().mockResolvedValue(undefined) }));

class Element {
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  get parentElement(): Element | null {
    return this.parent ?? null;
  }
  readonly nodeType = 1;
  readonly isConnected = true;
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
  };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  parent: Element | undefined;
  readonly listeners = new Map<string, (() => void)[]>();
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
  textContent = "";
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type: string, listener: () => void) {
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
  click() {
    this.listeners.get("click")?.forEach((listener) => listener());
  }
  closest(): Element | null {
    return this.hidden ? this : (this.parent?.closest() ?? null);
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
  querySelectorAll() {
    return [];
  }
  remove() {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }
    this.parent = undefined;
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
  installButton: "Install",
  installNote: "Install help",
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
  vi.stubGlobal("document", {
    createElement: () => new Element(),
    defaultView: { HTMLElement: Element, Node: Element },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    matchMedia: () => ({ matches: false }),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());

function setup(copy: SettingsLabels = labels) {
  const onFeedbackChange = vi.fn();
  const onVisibilityChange = vi.fn();
  const settings = createSettings(new Element() as unknown as HTMLElement, {
    build: "test-build",
    labels: copy,
    onFeedbackChange,
    onOpenChange: vi.fn(),
    onVisibilityChange,
  });
  fixtureActionRoot(settings.root);
  const columns = (settings.card as unknown as Element).children[0]!.children;
  const rows = [...columns[0]!.children, ...columns[2]!.children];
  return { columns, onFeedbackChange, onVisibilityChange, rows, settings };
}

const toggleStack = (row: Element) =>
  row.children.find((node) => node.className === "ada-setting-toggle")!;
const state = (row: Element) => toggleStack(row).children[1]!;

describe("Settings current-state labels", () => {
  it("places each state below its switch inside one shared-width stack", () => {
    const { rows, settings } = setup();
    for (const row of rows.slice(0, 4)) {
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
    expect(rows.slice(0, 4).map((row) => row.attributes.get("data-ui-placement"))).toEqual([
      "top",
      "top",
      "top",
      "top",
    ]);
    expect(columns[0]!.children.map((row) => row.dataset.setting)).toEqual(["move", "aim"]);
    expect(columns[2]!.children.map((row) => row.dataset.setting)).toEqual([
      "sound",
      "reducedMotion",
    ]);
    expect(rows).toHaveLength(4);
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

  it("provides one canonical Back in its own centered footer without changing the close action", () => {
    const { settings } = setup();
    const actions = settings.actions as unknown as Element;
    expect(actions.dataset.footerAction).toBe("back");
    expect(actions.children.map((button) => button.textContent)).toEqual([
      CONTENT.labels.questBack,
    ]);
    expect(actions.children[0]!.dataset.action).toBe("settings-close");
    expect(actions.children[0]!.className).toContain("ada-primary");
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
    expect(rows.slice(0, 4).map((row) => state(row).textContent)).toEqual([
      "Shown",
      "Shown",
      "On",
      "Off",
    ]);
    expect(rows.slice(0, 4).map((row) => row.attributes.get("aria-label"))).toEqual([
      "Move controls",
      "Aim controls",
      "Sound effects",
      "Reduced motion",
    ]);
    for (const row of rows.slice(0, 4)) {
      expect(row.attributes.get("role")).toBe("switch");
      expect(row.attributes.get("aria-describedby")).toBe(`ada-note-${row.dataset.setting}`);
      expect(state(row).attributes.get("aria-hidden")).toBe("true");
    }
    expect(rows).toHaveLength(4);
    settings.dispose();
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
    expect(CONTENT.labels.motionNote).toBe("Reduces animation and disables screen shake.");
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

it("retains native widgets while the entire Install row leaves and rejoins the tree", () => {
  let installed = false;
  let notify: (() => void) | undefined;
  const stop = vi.fn();
  const settings = createSettings(new Element() as unknown as HTMLElement, {
    build: "test-build",
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
  expect(install).toBeDefined();
  installed = true;
  notify!();
  expect(nodes(settings.card as unknown as Element)).not.toContain(install);
  expect(nodes(settings.card as unknown as Element)).toContain(move);
  installed = false;
  notify!();
  expect(nodes(settings.card as unknown as Element)).toContain(install);
  expect(nodes(settings.card as unknown as Element)).toContain(move);
  expect(move.listeners.get("click")).toHaveLength(1);
  expect(modal.children[0]).toBe(frame);
  settings.dispose();
  expect(stop).toHaveBeenCalledOnce();
  expect(move.listeners.get("click")).toHaveLength(0);
});
