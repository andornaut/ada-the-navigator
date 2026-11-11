import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SPEAKING_FRAME_MS } from "./conversation.ts";
import { TEXT_BUTTON } from "./layout/controls.ts";
import { fromHudEdge, safeEdge, units } from "./layout/css.ts";
import { HUD_BUTTON, HUD_ROW, STORY_PANEL_TOP, STORY_SKIP } from "./layout/playView.ts";
import { STORY_PANEL } from "./layout/storyPage.ts";
import { SPACING } from "./layout/tokens.ts";
import {
  STORY_PORTRAITS,
  STORYBOOK_STYLE,
  storyPortrait,
  storyPortraitFrame,
} from "./storybook.ts";

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
    // The settings target reaches HUD_ROW.reach past the corner; Skip ends a gap left of it.
    expect(STORY_SKIP.right.besideSettings).toBe(HUD_BUTTON.target - HUD_ROW.reach + SPACING.gap);
  });

  it("puts Skip on the HUD rect's top-right corner while the settings button is hidden", () => {
    const alone = rule(".ada-controls.ada-no-settings-button .ada-story-skip");
    expect(STORY_SKIP.right.corner).toBe(0);
    expect(alone).toContain(`right:${fromHudEdge("right")}`);
    // Only the side moves: Skip stays centred on the HUD row's targets.
    expect(alone).not.toContain("top:");
  });

  it("centres the compact Skip on the HUD row's centre line, the discs' centre", () => {
    expect(STORY_SKIP.top + TEXT_BUTTON.compactHeight / 2).toBe(HUD_ROW.centre);
    expect(STORY_SKIP.top).toBe(2.5);
  });

  it("keeps the panel's top a gap below the HUD row, clear of Skip and Settings", () => {
    expect(STORY_PANEL_TOP).toBe(48.5);
    expect(STORY_PANEL_TOP).toBe(HUD_ROW.bottom + SPACING.gap);
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

describe("the overnight recharge's overlays", () => {
  it("draws each overlay over the canvas at its box, nearest neighbour, taking no presses", () => {
    const overlay = rule(".ada-controls .ada-story-overlay");
    expect(overlay).toContain("position:absolute");
    expect(overlay).toContain("background:0 0 / 100% 100% no-repeat");
    expect(overlay).toContain("image-rendering:pixelated");
    expect(overlay).toContain("pointer-events:none");
  });
});

const MANIFEST = JSON.parse(
  readFileSync(new URL("../../public/art/manifest.json", import.meta.url), "utf8"),
) as {
  assets: {
    frameWidth?: number;
    frames?: Record<string, number>;
    id: string;
    loops?: Record<string, { frame: number; ms: number; name: string }[]>;
    path: string;
    width: number;
  }[];
};
const asset = (id: string) => MANIFEST.assets.find((entry) => entry.id === id);

describe("story page portraits", () => {
  const astra = storyPortrait("Astra")!;

  it("resolve Astra's 32 sheet, drawn at 2x in the 68 frame", () => {
    expect(astra).toEqual({ named: false, side: "right", speaker: "astra" });
    const sheet = asset("astra-portrait")!;
    expect(STORY_PORTRAITS.astra.url).toBe(sheet.path);
    expect(sheet.width / sheet.frameWidth!).toBe(STORY_PORTRAITS.astra.frames);
    expect(STORY_PANEL.portrait).toEqual({ frame: 68, image: 64, inset: 2 });
    expect(rule('.ada-controls .ada-story-portrait[data-speaker="astra"]')).toContain(
      `background:url('${sheet.path}') 0 0 / ${units(5 * 64)} ${units(64)} no-repeat`,
    );
    const frame = rule(".ada-controls .ada-story-frame");
    expect(frame).toContain(`width:${units(68)};`);
    expect(frame).toContain(`border:${units(2)} solid #181425;`);
    expect(rule(".ada-controls .ada-story-portrait")).toContain("image-rendering:pixelated");
  });

  it("give every drawn speaker a 32 sheet with its compact sheet's frames", () => {
    const ids = { ada: "ada", astra: "astra", general: "gadget", penny: "penny" } as const;
    for (const [speaker, id] of Object.entries(ids)) {
      const sheet = asset(`${id}-portrait`)!;
      expect(STORY_PORTRAITS[speaker as keyof typeof ids].url).toBe(sheet.path);
      expect(sheet.width / sheet.frameWidth!).toBe(
        STORY_PORTRAITS[speaker as keyof typeof ids].frames,
      );
      expect(sheet.frames).toEqual(asset(`${id}-portrait-compact`)!.frames);
    }
  });

  it("put Ada at the left and every other speaker at the right, never mirrored", () => {
    expect(storyPortrait("Ada")?.side).toBe("left");
    for (const name of ["Astra", "Penny", "Unknown voice", "General Gadget"]) {
      expect(storyPortrait(name)?.side, name).toBe("right");
    }
    expect(storyPortrait("General Gadget")?.named).toBe(true);
    expect(rule('.ada-controls .ada-story-line[data-side="right"]')).toContain(
      "flex-direction:row-reverse",
    );
    expect(STORYBOOK_STYLE).not.toMatch(/scaleX|scale\(-/u);
  });

  it("show no portrait for narration or a speaker Art has not drawn", () => {
    expect(storyPortrait(undefined)).toBeNull();
    expect(storyPortrait("Grandma")).toBeNull();
    expect(storyPortrait("Workshop")).toBeNull();
  });

  it("loop Astra's speaking frames at 120 ms while her page shows, held on speaking-1", () => {
    const { frames, loops } = asset("astra-portrait")!;
    expect(loops!.speaking!.map(({ ms }) => ms)).toEqual([120, 120, 120, 120]);
    expect(SPEAKING_FRAME_MS).toBe(120);
    const speaking = loops!.speaking!.map(({ frame }) => frame);
    expect([0, 0.12, 0.24, 0.36, 0.48].map((at) => storyPortraitFrame(false, astra, at))).toEqual([
      ...speaking,
      speaking[0],
    ]);
    for (const at of [0, 0.12, 0.36, 3]) {
      expect(storyPortraitFrame(true, astra, at)).toBe(frames!["speaking-1"]);
    }
  });

  it("show Ada's neutral face without a loop", () => {
    const ada = storyPortrait("Ada")!;
    for (const at of [0, 0.12, 3]) {
      expect(storyPortraitFrame(false, ada, at)).toBe(asset("ada-portrait")!.frames!.neutral);
    }
  });
});
