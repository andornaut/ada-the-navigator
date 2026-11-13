import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SETTINGS_STATE_LABELS } from "../data/settingsCopy.ts";
import { DEVICE_STORAGE_KEYS } from "./deviceSettings.ts";
import { createSettings, type SettingsLabels } from "./settings.ts";

vi.mock("./uiSkin.ts", () => ({ applyButtonSkin: vi.fn().mockResolvedValue(undefined) }));

class Element {
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  className = "";
  readonly classList = { add: vi.fn(), remove: vi.fn() };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly listeners = new Map<string, (() => void)[]>();
  readonly style = { setProperty: vi.fn() };
  textContent = "";
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  append(...nodes: Element[]) {
    this.children.push(...nodes);
  }
  click() {
    this.listeners.get("click")?.forEach((listener) => listener());
  }
  closest() {
    return null;
  }
  get lastElementChild() {
    return this.children.at(-1);
  }
  insertBefore(node: Element, before: Element) {
    this.children.splice(this.children.indexOf(before), 0, node);
  }
  querySelectorAll() {
    return [];
  }
  remove() {}
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
  vi.stubGlobal("document", { createElement: () => new Element() });
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
  const rows = (settings.card as unknown as Element).children[0]!.children;
  return { onFeedbackChange, onVisibilityChange, rows, settings };
}

const state = (row: Element) =>
  row.children.find((node) => node.className === "ada-setting-state")!;

describe("Settings current-state labels", () => {
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
    expect(rows[4]!.hidden).toBe(true);
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
        expect(row.children.at(-1)!.dataset.tag).toBe(on ? "on" : "off");
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
