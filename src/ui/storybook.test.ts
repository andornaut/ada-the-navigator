import { describe, expect, it } from "vitest";

import { fromHudEdge, safeEdge } from "./layout/css.ts";
import { HUD_BUTTON, STORY_SKIP } from "./layout/playView.ts";
import { STORY_PANEL } from "./layout/storyPage.ts";
import { SPACING } from "./layout/tokens.ts";
import { STORYBOOK_STYLE } from "./storybook.ts";

// One CSS rule's body from the storybook style.
function rule(selector: string): string {
  const start = STORYBOOK_STYLE.indexOf(`${selector}{`);
  expect(start).toBeGreaterThanOrEqual(0);
  return STORYBOOK_STYLE.slice(start, STORYBOOK_STYLE.indexOf("}", start));
}

describe("storybook page", () => {
  it("anchors the text panel to the page safe rect's bottom, never centred", () => {
    expect(STORY_PANEL.anchor).toBe("bottom");
    const panel = rule(".ada-controls .ada-story-panel");
    expect(panel).toContain(`bottom:${safeEdge("bottom", SPACING.pageInset)};`);
    expect(panel).not.toMatch(/(^|[\s;{])top:/u);
    expect(panel).not.toContain("translateY");
    expect(panel).not.toContain("translate(");
    // Tall pages stop a gap below the HUD row, clear of Skip and the settings button.
    expect(panel).toContain(fromHudEdge("top", HUD_BUTTON.target + SPACING.gap));
  });

  it("puts Previous at the inner left and Next or the named action at the inner right", () => {
    expect(STORY_PANEL.pageControls).toEqual(["previous", "next"]);
    expect(rule(".ada-controls .ada-story-controls")).toContain("justify-content:space-between");
  });

  it("sets Skip apart at the top right, clear of the settings button", () => {
    expect(STORY_PANEL.pageControls).not.toContain("skip");
    const skip = rule(".ada-controls .ada-story-skip");
    expect(skip).toContain(`top:${fromHudEdge("top", STORY_SKIP.top)};`);
    expect(skip).toContain(`right:${fromHudEdge("right", STORY_SKIP.right)}`);
    expect(STORY_SKIP.right).toBe(HUD_BUTTON.target + HUD_BUTTON.gap);
  });
});
