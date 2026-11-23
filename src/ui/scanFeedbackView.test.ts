import { afterEach, describe, expect, it, vi } from "vitest";

import { immutableScanOutcome, type ScanOutcome } from "../model/scanOutcomes.ts";
import { units, VIEW_PROPERTIES } from "./layout/css.ts";
import { SCAN_FEEDBACK_TIMING } from "./scanFeedback.ts";
import {
  createScanFeedbackView,
  scanFeedbackDialogue,
  scanFeedbackFootprints,
} from "./scanFeedbackView.ts";
class Node {
  readonly style = Object.assign({ setProperty: vi.fn() }, {} as Record<string, string>);
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly children: Node[] = [];
  readonly ownerDocument = doc;
  className = "";
  hidden = false;
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
  getBoundingClientRect() {
    return { height: 40, width: 200 };
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
const context = {
  area: { height: 360, width: 720, x: 0, y: 0 },
  blocked: () => [],
  covered: false,
  dialogue: () => [],
  resolveAnchor: () => ({ x: 360, y: 220 }),
};
function setup() {
  vi.stubGlobal("document", doc);
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
  const parent = new Node();
  const view = createScanFeedbackView(parent as unknown as HTMLElement);
  return { panel: parent.children[0]!, view };
}
afterEach(() => vi.unstubAllGlobals());
describe("native scan receipt view", () => {
  it("measures its panel in the frame's axes, so a turned frame keeps it a horizontal strip", () => {
    const { panel, view } = setup();
    const before = { height: 0, width: 0 };
    view.enqueue([receipt()]);
    view.render(context, 0);
    before.height = Number.parseFloat(panel.style.height!.replace(/.*\* /u, ""));
    before.width = Number.parseFloat(panel.style.width!.replace(/.*\* /u, ""));
    view.reset();
    // Turned by 90, the same 200x40 panel measures 40 across and 200 down on the page.
    const turned = Object.assign(doc, {
      documentElement: {
        getAttribute: (name: string) => (name === "data-frame-turn" ? "90" : null),
      },
    });
    panel.getBoundingClientRect = () => ({ height: 200, width: 40 });
    try {
      view.enqueue([receipt()]);
      view.render(context, 0);
      expect(panel.style.width).toBe(units(before.width));
      expect(panel.style.height).toBe(units(before.height));
      expect(before.width).toBeGreaterThan(before.height);
    } finally {
      delete (turned as { documentElement?: unknown }).documentElement;
    }
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
  it("retains receipt and time while covered or unplaceable, then displays once", () => {
    const { panel, view } = setup();
    const outcome = receipt();
    view.enqueue([outcome]);
    view.render({ ...context, covered: true }, 10000);
    expect(panel.hidden).toBe(true);
    expect(panel.style.display).toBe("none");
    view.render({ ...context, blocked: () => [context.area] }, 10000);
    expect(panel.hidden).toBe(true);
    expect(panel.style.display).toBe("none");
    view.render(context, SCAN_FEEDBACK_TIMING.holdMs);
    expect(panel.style.opacity).toBe("1");
    view.render(context, SCAN_FEEDBACK_TIMING.fadeMs);
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
    view.enqueue([outcome]);
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
  });
  it("changes only opacity during the fade and keeps its native node and position through dialogue", () => {
    const { panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, SCAN_FEEDBACK_TIMING.holdMs);
    const left = panel.style.left;
    const top = panel.style.top;
    const dialogue = () => [{ height: 140, width: 320, x: 200, y: 80 }];
    view.render({ ...context, dialogue }, 250);
    expect(panel.style.opacity).toBe("1");
    view.render({ ...context, dialogue }, 250);
    expect(panel.style.opacity).toBe("0.5");
    expect(panel.style.left).toBe(left);
    expect(panel.style.top).toBe(top);
    expect(panel.style.zIndex).toBe("1");
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
  });
  it("uses canonical HUD selection with only conversation paint excluded", () => {
    setup();
    const querySelectorAll = vi.fn<(selector: string) => HTMLElement[]>(() => []);
    scanFeedbackFootprints(
      { querySelectorAll } as unknown as Document,
      new Node() as unknown as HTMLElement,
    );
    const selector = querySelectorAll.mock.calls[0]![0];
    expect(selector).toContain(".ada-shield:not(.ada-conversation, .ada-conversation *)");
    expect(selector).toContain(".ada-conversation:not(.ada-conversation, .ada-conversation *)");
  });
  it("reads the shown touch controls with the HUD and the conversation box's parts apart", () => {
    vi.stubGlobal("getComputedStyle", () => ({
      display: "block",
      getPropertyValue: (name: string) => (name === VIEW_PROPERTIES.unit ? "1" : "0"),
      opacity: "1",
      visibility: "visible",
    }));
    const shown = (left: number, top: number, width: number, height: number) => ({
      closest: () => null,
      getBoundingClientRect: () => ({ height, left, top, width }),
      getClientRects: () => [{}],
    });
    const host = { getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLElement;
    const querySelectorAll = (selector: string) =>
      selector.includes("aim-joystick")
        ? [shown(595, 235, 75, 75), shown(518, 135, 75, 75)]
        : selector.startsWith(".ada-conversation,")
          ? [shown(120, 66, 480, 60)]
          : [shown(10, 10, 100, 30)];
    const doc = { querySelectorAll } as unknown as Document;
    expect(scanFeedbackFootprints(doc, host)).toEqual([
      { height: 30, width: 100, x: 10, y: 10 },
      { height: 75, width: 75, x: 595, y: 235 },
      { height: 75, width: 75, x: 518, y: 135 },
    ]);
    expect(scanFeedbackDialogue(doc, host)).toEqual([{ height: 60, width: 480, x: 120, y: 66 }]);
  });
  it("clears presentation at the model boundary and removes its native node on disposal", () => {
    const { panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 0);
    view.reset();
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
    expect(panel.children).toEqual([]);
    view.dispose();
    expect(panel.removed).toBe(true);
  });
});
