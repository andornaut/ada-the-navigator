import { afterEach, describe, expect, it, vi } from "vitest";

import { visualNoticeTiming } from "../data/noticeTiming.ts";
import { immutableScanOutcome, type ScanOutcome } from "../model/scanOutcomes.ts";
import { fromHudEdge } from "./layout/css.ts";
import { STATUS_PILL } from "./layout/playView.ts";
import { SPACING } from "./layout/tokens.ts";
import { createScanFeedbackView } from "./scanFeedbackView.ts";
class Node {
  readonly style = Object.assign({ setProperty: vi.fn() }, {} as Record<string, string>);
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly children: Node[] = [];
  readonly selectors = new Map<string, Node>();
  readonly ownerDocument = doc;
  className = "";
  hidden = false;
  clientWidth = 720;
  offsetHeight = 0;
  offsetTop = 0;
  textContent = "";
  removed = false;
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  append(node: Node) {
    this.children.push(node);
  }
  replaceChildren() {
    this.children.length = 0;
  }
  remove() {
    this.removed = true;
  }
  querySelectorAll() {
    return [];
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
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const observed = vi.fn();
  const disconnect = vi.fn();
  let resize = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = observed;
      disconnect = disconnect;
      constructor(callback: () => void) {
        resize = callback;
      }
    },
  );
  const parent = new Node();
  const controls = new Node();
  const boss = new Node();
  controls.selectors.set(".ada-boss-hud", boss);
  const view = createScanFeedbackView(
    parent as unknown as HTMLElement,
    controls as unknown as HTMLElement,
  );
  return { boss, disconnect, observed, panel: parent.children[0]!, resize, view };
}
afterEach(() => vi.unstubAllGlobals());
describe("native scan receipt view", () => {
  it("uses the resource HUD's top inset and centers with a layout-independent transform", () => {
    const { panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 0);
    expect(panel.style.left).toBe("50%");
    expect(panel.style.transform).toBe("translateX(-50%)");
    expect(panel.style.top).toBe(fromHudEdge("top", STATUS_PILL.y));
    expect(panel.style.width).toBe("max-content");
  });
  it("moves the same panel below the visible boss bar and restores it when the boss leaves", () => {
    const { boss, panel, resize, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 0);
    const text = panel.children[1];
    boss.offsetTop = 12;
    boss.offsetHeight = 44;
    resize();
    const ordinary = fromHudEdge("top", STATUS_PILL.y);
    expect(panel.style.top).toBe(`max(${ordinary}, ${56 + SPACING.gap}px)`);
    expect(panel.children[1]).toBe(text);
    boss.offsetHeight = 0;
    resize();
    expect(panel.style.top).toBe(ordinary);
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
