import { describe, expect, it } from "vitest";

import { BACKGROUND_ART, PLACEHOLDER_BACKGROUNDS } from "../data/storybook.ts";
import { TEXT_BUTTON } from "./layout/controls.ts";
import { fromHudEdge, safeEdge } from "./layout/css.ts";
import { HUD_BUTTON, STORY_PANEL_TOP, STORY_SKIP } from "./layout/playView.ts";
import { STORY_PANEL } from "./layout/storyPage.ts";
import { SPACING } from "./layout/tokens.ts";
import { SLEEP_GLOW, sleepGlowKeyframes, STORYBOOK_STYLE } from "./storybook.ts";

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
  });

  it("puts Previous at the inner left and Next or the named action at the inner right", () => {
    expect(STORY_PANEL.pageControls).toEqual(["previous", "next"]);
    expect(rule(".ada-controls .ada-story-controls")).toContain("justify-content:space-between");
  });

  it("sets Skip apart at the top right, one gap left of the settings button's target", () => {
    expect(STORY_PANEL.pageControls).not.toContain("skip");
    const skip = rule(".ada-controls .ada-story-skip");
    expect(skip).toContain(`top:${fromHudEdge("top", STORY_SKIP.top)};`);
    expect(skip).toContain(`right:${fromHudEdge("right", STORY_SKIP.right.besideSettings)}`);
    expect(STORY_SKIP.right.besideSettings).toBe(HUD_BUTTON.target + SPACING.gap);
  });

  it("puts Skip on the HUD rect's top-right corner while the settings button is hidden", () => {
    const alone = rule(".ada-controls.ada-no-settings-button .ada-story-skip");
    expect(STORY_SKIP.right.corner).toBe(0);
    expect(alone).toContain(`right:${fromHudEdge("right")}`);
    // Only the side moves: Skip stays centred on the HUD row's targets.
    expect(alone).not.toContain("top:");
  });

  it("centres the compact Skip on the HUD row's 48 targets", () => {
    expect(STORY_SKIP.top * 2 + TEXT_BUTTON.compactHeight).toBe(HUD_BUTTON.target);
  });

  it("keeps the panel's top a gap below the HUD row, clear of Skip and Settings", () => {
    expect(STORY_PANEL_TOP).toBe(56);
    expect(STORY_PANEL_TOP).toBe(HUD_BUTTON.target + SPACING.gap);
    expect(rule(".ada-controls .ada-story-panel")).toContain(
      `max-height:calc(100% - ${fromHudEdge("top", STORY_PANEL_TOP)} - ${safeEdge(
        "bottom",
        SPACING.pageInset,
      )});`,
    );
  });

  it("scrolls the text and the choices as one group with the page controls fixed", () => {
    const scroll = rule(".ada-controls .ada-story-scroll");
    expect(scroll).toContain("overflow-y:auto");
    expect(scroll).toContain("min-height:0");
    expect(rule(".ada-controls .ada-story-text")).not.toContain("overflow");
    expect(rule(".ada-controls .ada-story-controls")).toContain("flex:none");
  });
});

describe("the overnight recharge's rooms", () => {
  it("draws night, sleep and morning as flat placeholder colours until Art's backgrounds land", () => {
    expect(Object.keys(PLACEHOLDER_BACKGROUNDS).sort()).toEqual([
      "adaRoomMorning",
      "adaRoomNight",
      "adaRoomSleep",
    ]);
    for (const [key, colour] of Object.entries(PLACEHOLDER_BACKGROUNDS)) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/u);
      expect(BACKGROUND_ART).not.toHaveProperty(key);
    }
  });

  it("pulses the sleep scene's rock glow, held steady under reduced motion", () => {
    expect(sleepGlowKeyframes(false)).toEqual(SLEEP_GLOW.keyframes);
    expect(sleepGlowKeyframes(true)).toBeNull();
    expect(rule(".ada-controls .ada-story-glow")).toContain("pointer-events:none");
  });
});
