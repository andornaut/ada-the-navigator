import { afterEach, describe, expect, it, vi } from "vitest";

import { INTERACTION_STYLE } from "./conversation.ts";
import { FOCUS_RING } from "./layout/controls.ts";
import { units } from "./layout/css.ts";
import { BUTTON_GAP, STACK_BUTTON_GAP } from "./layout/tokens.ts";
import { MAP_SCREEN_STYLE } from "./mapScreen.ts";
import { createCard, MODAL_STYLE, UI_SCOPE } from "./modal.ts";
import { STATION_STYLE } from "./station.ts";

class Element {
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  className = "";
  readonly dataset: Record<string, string> = {};
  addEventListener() {}
  append(...children: Element[]) {
    this.children.push(...children);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

afterEach(() => vi.unstubAllGlobals());

const rule = (selector: string) => {
  const start = MODAL_STYLE.indexOf(`${selector}{`);
  expect(start).toBeGreaterThanOrEqual(0);
  return MODAL_STYLE.slice(start, MODAL_STYLE.indexOf("}", start));
};

describe("shared card chrome", () => {
  it("fills a requested dialog without changing its accessible name, close action or content structure", () => {
    vi.stubGlobal("document", { createElement: () => new Element() });
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const full = createCard({
      closeAction: "back",
      closeLabel: "Close",
      size: "large",
      title: "Quests",
    });
    const fitted = createCard({ closeAction: "back", closeLabel: "Close", title: "Ship" });
    const frame = full.frame as unknown as Element;
    expect(frame.dataset.cardSize).toBe("large");
    expect(frame.attributes.get("role")).toBe("dialog");
    expect(frame.attributes.get("aria-label")).toBe("Quests");
    expect(full.close.dataset.action).toBe("back");
    expect((full.close as unknown as Element).attributes.get("aria-label")).toBe("Close");
    expect(frame.children).toEqual([full.card, full.close]);
    expect((full.card as unknown as Element).children).toEqual([full.header, full.body]);
    expect(fitted.frame.dataset.cardSize).toBe("medium");
    full.dispose();
    fitted.dispose();
  });

  it("fits every preset vertically and scrolls overflowing content through one rule", () => {
    expect(rule(`${UI_SCOPE} .ada-card-frame`)).toContain("min-height:0");
    expect(rule(`${UI_SCOPE} .ada-card-frame`)).not.toMatch(/(?:^|;)\s*height:100%/u);
    expect(rule(`${UI_SCOPE} .ada-card-body`)).toContain("overflow-y:auto");
    expect(rule(`${UI_SCOPE} .ada-card-body`)).toContain("min-height:0");
    for (const css of [STATION_STYLE, INTERACTION_STYLE, MAP_SCREEN_STYLE]) {
      expect(css).not.toMatch(/\.ada-card(?:-frame)?\{[^}]*!important/u);
    }
  });

  it("uses standard button gaps when nested topic actions wrap", () => {
    const wrapped = rule(`${UI_SCOPE} .ada-actions.ada-wrap`);
    expect(wrapped).toContain("flex-wrap:wrap");
    expect(wrapped).toContain(`padding:${units(FOCUS_RING.outset)}`);
    expect(wrapped).toContain(`column-gap:${units(BUTTON_GAP)}`);
    expect(wrapped).toContain(`row-gap:${units(STACK_BUTTON_GAP)}`);
    expect(rule(`${UI_SCOPE} .ada-actions.ada-wrap > .ada-button`)).toContain(
      "overflow-wrap:anywhere",
    );
  });
});
