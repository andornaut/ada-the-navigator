import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AWAITING_TAB, SPEAKING_FRAME_MS, TAB_COLOURS } from "./conversation.ts";
import { TEXT_BUTTON } from "./layout/controls.ts";
import { font, fromHudEdge, safeEdge, units } from "./layout/css.ts";
import {
  HUD_BUTTON,
  HUD_ROW,
  STORY_PANEL_TOP,
  STORY_ROOM_PANEL_TOP,
  STORY_SKIP,
} from "./layout/playView.ts";
import { STORY_PANEL } from "./layout/storyPage.ts";
import { SMALL_BUTTON_GAP, SPACING, TYPE } from "./layout/tokens.ts";
import { MODAL_STYLE } from "./modal.ts";
import {
  STORY_PORTRAITS,
  STORY_TAB_COLOURS,
  STORYBOOK_STYLE,
  storyPortrait,
  storyPortraitFrame,
  storyTabColour,
} from "./storybook.ts";

// One CSS rule's body from the storybook style.
function rule(selector: string): string {
  const start = STORYBOOK_STYLE.indexOf(`${selector}{`);
  expect(start).toBeGreaterThanOrEqual(0);
  return STORYBOOK_STYLE.slice(start, STORYBOOK_STYLE.indexOf("}", start));
}

describe("storybook page", () => {
  it("anchors the spread to the page safe rect's bottom, only as tall as its page", () => {
    const panel = rule(".ada-controls .ada-story-panel");
    expect(panel).toContain(`bottom:${safeEdge("bottom", SPACING.pageInset)};`);
    expect(panel).not.toMatch(/(^|[\s;{])(top|height):/u);
    expect(panel).not.toContain("translateY");
    expect(panel).toContain(`width:min(`);
    expect(panel).toContain(`${units(STORY_PANEL.maxWidth)})`);
    expect(STORY_PANEL.maxWidth).toBe(760);
    expect(panel).toContain("flex-direction:row");
    expect(panel).toContain(`gap:${units(STORY_PANEL.columnGap)}`);
  });

  it("caps the panel's top a gap below the HUD row, lower on Ada's room page", () => {
    expect(STORY_PANEL_TOP).toBe(48.5);
    expect(STORY_PANEL_TOP).toBe(HUD_ROW.bottom + SPACING.gap);
    // From the 12 HUD rect top: y 60.5, and 62.75 under the room's pause press area.
    expect(STORY_ROOM_PANEL_TOP).toBe(50.75);
    const height = (top: number) =>
      `max-height:calc(100% - ${fromHudEdge("top", top)} - ${safeEdge("bottom", SPACING.pageInset)})`;
    expect(rule(".ada-controls .ada-story-panel")).toContain(height(STORY_PANEL_TOP));
    expect(rule(".ada-controls .ada-story-panel.ada-story-room")).toContain(
      height(STORY_ROOM_PANEL_TOP),
    );
  });

  it("gives the choice column its share of the inner width within 228 and 300", () => {
    const column = rule(".ada-controls .ada-story-choice-column");
    expect(STORY_PANEL.choiceColumn).toEqual({ max: 300, min: 228, share: 0.38 });
    expect(column).toContain(
      `flex:0 0 clamp(${units(228)}, calc((100% - ${units(25)}) * 0.38), ${units(300)})`,
    );
    // The rule: 1 in the card rim, 12 from each column.
    const line = rule(".ada-controls .ada-story-choice-column::before");
    expect(line).toContain(`left:${units(-13)}`);
    expect(line).toContain(`width:${units(1)}`);
    expect(line).toContain("background:#6b6685");
  });

  it("scrolls only the text column, with the choices and page controls fixed", () => {
    const copy = rule(".ada-controls .ada-story-copy");
    expect(copy).toContain("overflow-y:auto");
    expect(copy).toContain("min-height:0");
    expect(rule(".ada-controls .ada-story-copy.ada-story-scrolls")).toContain(
      `padding-right:${units(14)}`,
    );
    expect(rule(".ada-controls .ada-story-choice-column")).not.toContain("overflow");
    expect(rule(".ada-controls .ada-story-controls")).toContain("margin-top:auto");
  });

  it("sets the story text 18 on 26 and the heading as the card title", () => {
    expect(TYPE.story).toEqual({ lineHeight: 26, size: 18, weight: 400 });
    expect(rule(".ada-controls .ada-story-panel .ada-story-paragraph")).toContain(
      `font:${font(TYPE.story)}`,
    );
    const heading = rule(".ada-controls .ada-story-panel .ada-story-heading");
    expect(heading).toContain("#ffffff");
    expect(heading).toContain("text-align:left");
    expect(heading).toContain(`margin:0 0 ${units(SPACING.gap)}`);
  });

  it("scrolls the choices of a page past the limits, with the page controls fixed", () => {
    expect(rule(".ada-controls .ada-story-choice-column")).toContain("min-height:0");
    // Only an overflowing page's choices scroll; others keep their press areas unclipped.
    expect(rule(".ada-controls .ada-story-choices")).not.toContain("overflow");
    const choices = rule(".ada-controls .ada-story-choices.ada-story-scrolls");
    expect(choices).toContain("overflow-y:auto");
    expect(choices).toContain("min-height:0");
    expect(choices).toContain("flex:0 1 auto");
    expect(choices).toContain(`padding-right:${units(14)}`);
    // The choices keep their faces; the page controls never shrink or scroll.
    expect(rule(".ada-controls .ada-story-choices > .ada-button")).toContain("flex:none");
    const controls = rule(".ada-controls .ada-story-controls");
    expect(controls).toContain("flex:none");
    expect(controls).not.toContain("overflow");
  });

  it("keeps small story buttons SMALL_BUTTON_GAP apart in every direction", () => {
    expect(SMALL_BUTTON_GAP).toBe(24);
    for (const selector of [
      ".ada-controls .ada-story-choice-column",
      ".ada-controls .ada-story-choices",
      ".ada-controls .ada-story-controls",
    ]) {
      expect(rule(selector), selector).toContain(`gap:${units(SMALL_BUTTON_GAP)}`);
    }
    expect(rule(".ada-controls .ada-story-controls")).toContain(
      "grid-template-columns:minmax(0, 1fr) minmax(0, 1fr)",
    );
    // A named action too wide for its half fills the row above Previous.
    expect(rule(".ada-controls .ada-story-controls.ada-story-wide")).toContain(
      'grid-template-areas:"next next" "previous ."',
    );
  });

  it("draws story buttons 36 high with a press area grown 9 past the face", () => {
    const button = MODAL_STYLE.slice(MODAL_STYLE.indexOf(".ada-button.ada-story-button{"));
    expect(button).toContain(`min-height:${units(36)}`);
    const press = MODAL_STYLE.slice(MODAL_STYLE.indexOf(".ada-button.ada-story-button::after{"));
    expect(press.slice(0, press.indexOf("}"))).toContain(`inset:${units(-9)}`);
  });

  it("sets Skip apart at the top right, SMALL_BUTTON_GAP left of the settings disc", () => {
    expect(STORY_PANEL.pageControls).not.toContain("skip");
    const skip = rule(".ada-controls .ada-story-skip");
    expect(skip).toContain(`top:${fromHudEdge("top", STORY_SKIP.top)};`);
    expect(skip).toContain(`right:${fromHudEdge("right", STORY_SKIP.right.besideSettings)}`);
    // Skip and the settings disc are small buttons: Skip ends SMALL_BUTTON_GAP left of the disc,
    // whose drawn right edge is on the corner.
    expect(STORY_SKIP.right.besideSettings).toBe(HUD_BUTTON.disc + SMALL_BUTTON_GAP);
    expect(STORY_SKIP.right.besideSettings).toBe(57);
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

  it("fills the speaker's tab with their conversation colour, or the neutral one", () => {
    expect(storyTabColour("Astra")).toBe(TAB_COLOURS.astra);
    expect(storyTabColour("Ada")).toBe(TAB_COLOURS.ada);
    expect(storyTabColour("General Gadget")).toBe(TAB_COLOURS.generalNamed);
    expect(storyTabColour("Elder Loom")).toBe(AWAITING_TAB);
    // Mom's and Dad's tabs, which only story pages show, as Art's table sets them.
    const table = readFileSync(new URL("../../art/controls.md", import.meta.url), "utf8");
    for (const name of ["Mom", "Dad"]) {
      const fill = new RegExp(`^\\| ${name} tab +\\| \`(#[0-9a-f]{6})\``, "mu").exec(table)?.[1];
      expect(fill, name).toBeDefined();
      expect(storyTabColour(name), name).toBe(fill);
    }
    expect(STORY_TAB_COLOURS).toEqual({ Dad: "#c4a6ec", Mom: "#9fd98a" });
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
    expect(STORY_PORTRAITS.astra!.url).toBe(sheet.path);
    expect(sheet.width / sheet.frameWidth!).toBe(STORY_PORTRAITS.astra!.frames);
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
      expect(STORY_PORTRAITS[speaker as keyof typeof ids]!.url).toBe(sheet.path);
      expect(sheet.width / sheet.frameWidth!).toBe(
        STORY_PORTRAITS[speaker as keyof typeof ids]!.frames,
      );
      expect(sheet.frames).toEqual(asset(`${id}-portrait-compact`)!.frames);
    }
  });

  it("show Grandma's portrait in her neutral frame, at the right, on her own tab", () => {
    const sheet = asset("grandma-portrait")!;
    const portrait = storyPortrait("Grandma")!;
    expect(portrait).toEqual({ named: false, side: "right", speaker: "grandma" });
    expect(STORY_PORTRAITS.grandma).toEqual({ frames: 1, url: sheet.path });
    expect(storyPortraitFrame(false, portrait, 0.25)).toBe(sheet.frames!.neutral);
    expect(storyTabColour("Grandma")).toBe("#f0b4d0");
    expect(rule('.ada-controls .ada-story-portrait[data-speaker="grandma"]')).toContain(
      `background:url('${sheet.path}') 0 0 / ${units(64)} ${units(64)} no-repeat`,
    );
  });

  it("put Ada at the left and every other speaker at the right, never mirrored", () => {
    expect(storyPortrait("Ada")?.side).toBe("left");
    for (const name of ["Astra", "Penny", "Unknown voice", "General Gadget"]) {
      expect(storyPortrait(name)?.side, name).toBe("right");
    }
    expect(storyPortrait("General Gadget")?.named).toBe(true);
    expect(rule(".ada-controls .ada-story-frame")).toContain("float:right");
    expect(rule('.ada-controls .ada-story-text[data-side="left"] .ada-story-frame')).toContain(
      "float:left",
    );
    expect(STORYBOOK_STYLE).not.toMatch(/scaleX|scale\(-/u);
  });

  it("show no portrait for narration or a speaker Art has not drawn", () => {
    expect(storyPortrait(undefined)).toBeNull();
    expect(storyPortrait("Mom")).toBeNull();
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
