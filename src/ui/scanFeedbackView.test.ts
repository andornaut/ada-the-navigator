import { afterEach, describe, expect, it, vi } from "vitest";

import { immutableScanOutcome, type ScanOutcome } from "../model/scanOutcomes.ts";
import { NOTICE_TIMING } from "./itemNotice.ts";
import { createScanFeedbackView, scanFeedbackFootprints } from "./scanFeedbackView.ts";
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
  blocked: [],
  covered: false,
  reducedMotion: false,
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
  it("renders neutral actual target identity and canonical glyph, never a quest completion", () => {
    const { panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 0);
    expect(panel.hidden).toBe(false);
    expect(panel.style.display).toBe("flex");
    expect(panel.dataset.kind).toBe("scan");
    expect(panel.children.map((node) => node.textContent)).toEqual(["", "Actual target"]);
    expect(panel.children[0]!.style.mask).toContain("map-wreck.svg");
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
    expect(panel.children[2]!.style.mask).toContain("map-job-survey.svg");
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
    view.render({ ...context, blocked: [context.area] }, 10000);
    expect(panel.hidden).toBe(true);
    expect(panel.style.display).toBe("none");
    view.render(context, NOTICE_TIMING.holdMs);
    expect(panel.style.opacity).toBe("1");
    view.render(context, NOTICE_TIMING.fadeMs);
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
    view.enqueue([outcome]);
    view.render(context, 0);
    expect(panel.hidden).toBe(true);
  });
  it("rises normally, remains static under reduced motion, and fades in both modes", () => {
    for (const reducedMotion of [false, true]) {
      const { panel, view } = setup();
      view.enqueue([receipt()]);
      const frame = { ...context, reducedMotion };
      view.render(frame, NOTICE_TIMING.holdMs / 2);
      const first = panel.style.top;
      view.render(frame, NOTICE_TIMING.holdMs / 2);
      const second = panel.style.top;
      if (reducedMotion) {
        expect(second).toBe(first);
      } else {
        expect(second).not.toBe(first);
      }
      view.render(frame, (reducedMotion ? NOTICE_TIMING.reducedFadeMs : NOTICE_TIMING.fadeMs) / 2);
      view.render(frame, 0);
      expect(Number(panel.style.opacity)).toBeCloseTo(0.5);
    }
  });
  it("retains its native node and x position as a dialogue opens, changes and closes", () => {
    const { panel, view } = setup();
    view.enqueue([receipt()]);
    view.render(context, 100);
    const left = panel.style.left;
    let top = panel.style.top;
    for (const blocked of [
      [{ height: 140, width: 320, x: 200, y: 80 }],
      [{ height: 200, width: 500, x: 100, y: 60 }],
      [],
    ]) {
      view.render({ ...context, blocked }, 100);
      expect(panel.style.left).toBe(left);
      expect(panel.style.top).not.toBe(top);
      expect(panel.style.zIndex).toBe("1");
      top = panel.style.top;
    }
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
