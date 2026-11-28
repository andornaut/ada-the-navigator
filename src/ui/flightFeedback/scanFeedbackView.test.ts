import { afterEach, describe, expect, it, vi } from "vitest";

import { CONVERSATION_BOX } from "../../data/layout.ts";
import { visualNoticeTiming } from "../../data/noticeTiming.ts";
import { weaponGlyphPath } from "../../data/weaponGlyphs.ts";
import { immutableScanOutcome, type ScanOutcome } from "../../model/scanOutcomes.ts";
import { CONVERSATION_STYLE } from "../conversation/index.ts";
import { fromHudEdge, units, VIEW_PROPERTIES } from "../layout/css.ts";
import { SPACING } from "../layout/tokens.ts";
import { VIEW_SCALE_EVENT } from "../layout/viewScale.ts";
import { createScanFeedbackView } from "./scanFeedbackView.ts";
class Node {
  readonly style = Object.assign({ setProperty: vi.fn() }, {} as Record<string, string>);
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly children: Node[] = [];
  readonly selectors = new Map<string, Node>();
  readonly parts: Node[] = [];
  readonly ownerDocument = { ...doc, defaultView: new EventTarget() };
  className = "";
  hidden = false;
  clientHeight = 360;
  clientWidth = 720;
  offsetHeight = 0;
  offsetLeft = 0;
  offsetWidth = 0;
  offsetTop = 0;
  textContent = "";
  removed = false;
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  append(...nodes: Node[]) {
    this.children.push(...nodes);
  }
  replaceChildren() {
    this.children.length = 0;
  }
  remove() {
    this.removed = true;
  }
  getBoundingClientRect() {
    return {
      height: this.offsetHeight,
      left: this.offsetLeft,
      top: this.offsetTop,
      width: this.offsetWidth,
    };
  }
  querySelectorAll() {
    return this.parts;
  }
  querySelector(selector: string): Node | null {
    return this.selectors.get(selector) ?? null;
  }
}
const doc = { createElement: () => new Node() };
const quest = {
  icon: { jobType: "survey" as const, symbol: "job" as const },
  id: "survey",
  name: "Actual quest",
};
const receipt = (
  completions: ScanOutcome["completions"] = [],
  source: ScanOutcome["source"] = "scan",
) =>
  immutableScanOutcome({
    completions,
    galaxy: 1,
    source,
    target: { id: "landmark:1:0", name: "Actual target", symbol: "wreck" },
    targetId: "landmark:1:0",
  });
const context = { covered: false };
function setup() {
  vi.stubGlobal("document", doc);
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (name: string) => (name === VIEW_PROPERTIES.unit ? "1" : "0px"),
  }));
  const observed = vi.fn();
  const disconnect = vi.fn();
  const unobserve = vi.fn();
  let resize = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = observed;
      disconnect = disconnect;
      unobserve = unobserve;
      constructor(callback: () => void) {
        resize = callback;
      }
    },
  );
  const parent = new Node();
  parent.getBoundingClientRect = () => ({
    height: parent.clientHeight,
    left: 0,
    top: 0,
    width: parent.clientWidth,
  });
  const controls = new Node();
  const shield = new Node();
  shield.offsetTop = 320;
  shield.offsetHeight = 28;
  shield.offsetWidth = 180;
  controls.selectors.set(".ada-shield", shield);
  const touch = new Node();
  controls.parts.push(touch);
  const view = createScanFeedbackView(
    parent as unknown as HTMLElement,
    controls as unknown as HTMLElement,
  );
  for (const node of parent.children) {
    node.offsetWidth = 120;
    node.offsetHeight = 38;
  }
  return {
    disconnect,
    equip: parent.children[1]!,
    observed,
    panel: parent.children[0]!,
    parent,
    resize,
    shield,
    touch,
    unobserve,
    view,
  };
}
afterEach(() => vi.unstubAllGlobals());
const lowerTop = `${320 - SPACING.gap - 38}px`;

describe("native scan receipt view", () => {
  it("uses the slot above the shield and centers with a layout-independent transform", () => {
    const { panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 0);
    expect(panel.style.left).toBe("50%");
    expect(panel.style.transform).toBe("translateX(-50%)");
    expect(panel.style.top).toBe(lowerTop);
    expect(panel.style.width).toBe("max-content");
  });
  it("keeps the same panel above the shield when the HUD changes size or position", () => {
    const { panel, resize, shield, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 0);
    const text = panel.children[1];
    shield.offsetTop = 301;
    resize();
    expect(panel.style.top).toBe(`${301 - SPACING.gap - 38}px`);
    expect(panel.children[1]).toBe(text);
    shield.offsetTop = 320;
    resize();
    expect(panel.style.top).toBe(lowerTop);
  });
  it("renders neutral actual target identity and canonical glyph, never a quest completion", () => {
    const { panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 0);
    expect(panel.hidden).toBe(false);
    expect(panel.style.display).toBe("flex");
    expect(panel.dataset.kind).toBe("scan");
    expect(panel.children.map((node) => node.textContent)).toEqual(["", "Actual target"]);
    expect(panel.children[0]!.style.mask).toBe(
      "url('/art/ui/icons/icons-20x20.svg#map-wreck') center / contain no-repeat",
    );
    expect(panel.attributes.get("role")).toBe("status");
  });
  it("renders an actual completed task checkbox left and quest icon right", () => {
    const { panel, view } = setup();
    view.enqueue([
      receipt([
        { kind: "task", quest, task: { id: "actual-task", text: "Actual completed task" } },
      ]),
    ]);
    view.render(context, 0);
    expect(panel.children.map((node) => node.textContent)).toEqual([
      "✓",
      "Actual completed task",
      "",
    ]);
    expect(panel.children[0]!.attributes.get("role")).toBe("checkbox");
    expect(panel.children[0]!.attributes.get("aria-checked")).toBe("true");
    expect(panel.children[2]!.dataset.part).toBe("quest-icon");
    expect(panel.children[2]!.style.mask).toBe(
      "url('/art/ui/icons/icons-20x20.svg#map-job-survey') center / contain no-repeat",
    );
  });
  it.each(["scan", "remembered"] as const)(
    "renders full quest name and icon without a checkbox (%s)",
    (source) => {
      const { panel, view } = setup();
      view.enqueue([receipt([{ kind: "quest", quest }], source)]);
      view.render(context, 0);
      expect(panel.children.map((node) => node.textContent)).toEqual(["", "Actual quest"]);
      expect(panel.children[0]!.dataset.part).toBe("quest-icon");
      expect(panel.children.some((node) => node.attributes.get("role") === "checkbox")).toBe(false);
    },
  );
  it("retains receipt and time while covered, then displays once", () => {
    const { panel, view } = setup();
    const outcome = receipt();
    view.enqueue([outcome]);
    view.render({ ...context, covered: true }, 10000);
    expect(panel.hidden).toBe(true);
    expect(panel.style.display).toBe("none");
    view.render(context, visualNoticeTiming("brief", "").holdMs);
    expect(panel.style.opacity).toBe("1");
    view.render(context, visualNoticeTiming("brief", "").fadeMs);
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
    view.enqueue([outcome]);
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
  });
  it("changes only opacity during the fade and keeps its native node and position through dialogue", () => {
    const { panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, visualNoticeTiming("brief", "").holdMs);
    const left = panel.style.left;
    const top = panel.style.top;
    view.render(context, 250);
    expect(panel.style.opacity).toBe("1");
    view.render(context, 250);
    expect(panel.style.opacity).toBe("0.5");
    expect(panel.style.left).toBe(left);
    expect(panel.style.top).toBe(top);
    expect(panel.style.zIndex).toBe("1");
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
  });
  it("clears presentation at the model boundary and removes its native node on disposal", () => {
    const { disconnect, panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 0);
    view.reset();
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
    expect(panel.children).toEqual([]);
    view.dispose();
    expect(panel.removed).toBe(true);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

describe("equipped weapon notice", () => {
  it.each([720, 360])(
    "centers in a %ipx viewport and stacks up from the shield without intercepting focus",
    (width) => {
      const { equip, panel, parent, view } = setup();
      parent.clientWidth = width;
      expect(equip.hidden).toBe(true);
      view.equip("heavyMissile", "Heavy Missile");
      view.renderEquip(false, 0);
      const [glyph, label] = equip.children;
      expect(glyph?.attributes.get("aria-hidden")).toBe("true");
      expect(glyph?.style.mask).toContain(weaponGlyphPath("heavyMissile"));
      expect(label?.textContent).toBe("Heavy Missile");
      expect(equip.style.top).toBe(lowerTop);
      expect(equip.style.left).toBe("50%");
      const safeWidth = `100% - 2 * max(${fromHudEdge("left")}, ${fromHudEdge("right")})`;
      expect(equip.style.maxWidth).toBe(
        `min(${units(CONVERSATION_BOX.maxWidth)}, ${safeWidth}, ${width}px)`,
      );
      expect(equip.style.pointerEvents).toBe("none");
      expect(equip.attributes.get("tabindex")).toBeUndefined();
      expect(equip.attributes.get("role")).toBe("status");
      expect(equip.style.zIndex).toBe("1");
      expect(CONVERSATION_STYLE).toMatch(/\.ada-conversation\{[^}]+z-index:5;/u);

      view.enqueue([receipt()]);
      panel.offsetHeight = 30;
      view.render(context, 0);
      expect(equip.style.top).toBe(lowerTop);
      expect(panel.style.top).toBe(`${274 - SPACING.gap - 30}px`);
      expect(panel.children[1]!.textContent).toBe("Actual target");
      view.clearEquip();
      expect(panel.style.top).toBe(`${320 - SPACING.gap - 30}px`);
    },
  );

  it("keeps its lower slot behind overlapping dialogue and reads only on geometry changes", () => {
    const { equip, observed, parent, resize, shield, unobserve, view } = setup();
    const dialogue = new Node();
    dialogue.offsetHeight = 60;
    const readDialogueTop = vi.fn(() => 125);
    Object.defineProperty(dialogue, "offsetTop", { get: readDialogueTop });
    parent.selectors.set(".ada-conversation", dialogue);

    view.equip("rapidMissile", "Rapid Missile");
    view.renderEquip(false, 0, "speaker:first");
    expect(equip.style.top).toBe(lowerTop);
    expect(observed).toHaveBeenCalledWith(dialogue);
    readDialogueTop.mockClear();
    view.renderEquip(false, 100, "speaker:first");
    view.renderEquip(false, 200, "speaker:first");
    expect(readDialogueTop).not.toHaveBeenCalled();

    readDialogueTop.mockReturnValue(260);
    view.renderEquip(false, 300, "speaker:center");
    expect(readDialogueTop).toHaveBeenCalledOnce();
    expect(equip.style.top).toBe(lowerTop);
    expect(equip.style.visibility).toBe("hidden");
    readDialogueTop.mockReturnValue(110);
    resize();
    expect(equip.style.visibility).toBe("");
    shield.offsetTop = 310;
    parent.ownerDocument.defaultView.dispatchEvent(new Event(VIEW_SCALE_EVENT));
    expect(equip.style.top).toBe(`${310 - SPACING.gap - 38}px`);
    view.clearEquip();
    expect(unobserve).toHaveBeenCalledWith(dialogue);
    view.dispose();
  });

  it("suspends visible time during dialogue overlap and resumes when it clears", () => {
    const { equip, parent, resize, view } = setup();
    const dialogue = new Node();
    parent.selectors.set(".ada-conversation", dialogue);
    dialogue.offsetTop = 263;
    dialogue.offsetHeight = 60;

    view.equip("laser", "Laser");
    view.renderEquip(false, 0);
    view.renderEquip(false, 1000);
    view.renderEquip(false, 1000, "captain");
    expect(equip.style.visibility).toBe("hidden");
    view.renderEquip(false, 10000, "captain");
    expect(equip.style.visibility).toBe("hidden");

    dialogue.offsetTop = 66;
    resize();
    expect(equip.style.visibility).toBe("");
    expect(equip.style.top).toBe(lowerTop);
    view.renderEquip(false, 10000, "captain");
    view.renderEquip(false, 11000, "captain");
    expect(equip.style.opacity).toBe("1");
    view.renderEquip(false, 11250, "captain");
    expect(equip.style.opacity).toBe("0.5");
    view.renderEquip(false, 11500, "captain");
    expect(equip.hidden).toBe(true);
    view.dispose();
  });

  it("fits between the lower controls and never reads their boxes on steady frames", () => {
    const { observed, panel, resize, touch, view } = setup();
    touch.offsetLeft = 520;
    touch.offsetWidth = 70;
    touch.offsetTop = 230;
    touch.offsetHeight = 80;
    view.enqueue([receipt()]);
    view.render(context, 0);
    expect(panel.style.top).toBe(lowerTop);
    expect(panel.style.maxWidth).toContain("312px)");
    expect(observed).toHaveBeenCalledWith(touch);
    touch.offsetLeft = 560;
    resize();
    expect(panel.style.maxWidth).toContain("392px)");
    const measure = vi.spyOn(touch, "getBoundingClientRect");
    view.render(context, 16);
    expect(measure).not.toHaveBeenCalled();
  });

  it("holds two seconds, fades over 500ms, and replaces the previous name and timing", () => {
    const { equip, view } = setup();
    view.equip("multiLaser", "Multi-Laser");
    view.renderEquip(false, 0);
    view.renderEquip(false, 2000);
    expect(equip.style.opacity).toBe("1");
    view.renderEquip(false, 2250);
    expect(equip.style.opacity).toBe("0.5");
    view.equip("phaser", "Phaser");
    view.renderEquip(false, 2250);
    expect(equip.children[0]?.style.mask).toContain(weaponGlyphPath("phaser"));
    expect(equip.children[1]?.textContent).toBe("Phaser");
    expect(equip.style.opacity).toBe("1");
    view.renderEquip(true, 2250);
    expect(equip.hidden).toBe(true);
    view.renderEquip(false, 10000);
    view.renderEquip(false, 12250);
    expect(equip.style.opacity).toBe("0.5");
    view.renderEquip(false, 12500);
    expect(equip.hidden).toBe(true);
    expect(equip.children[1]?.textContent).toBe("");
    view.dispose();
    expect(equip.removed).toBe(true);
  });
});
