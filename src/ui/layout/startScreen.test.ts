import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { TEXT_BUTTON } from "./controls.ts";
import {
  hudButtonTarget,
  hudRect,
  type Insets,
  logicalView,
  NO_INSETS,
  playView,
  SAFE_MARGIN,
  safeRect,
} from "./playView.ts";
import { START_SCREEN, startScreenRects } from "./startScreen.ts";
import { SPACING, TYPE } from "./tokens.ts";

// Art's table (art/layout.md "Start screen"), as left to right and top to bottom.
const span = ({ height, width, x, y }: Rect) =>
  [x, x + width, y, y + height].map((value) => Math.round(value * 100) / 100);
const PHONE_INSETS: Insets = { bottom: 19, left: 43, right: 43, top: 0 };

describe("start screen layout", () => {
  it("derives its parts from the play view's centre and the spacing tokens", () => {
    expect(START_SCREEN.wordmark).toMatchObject({ height: 102, left: 225, top: 148, width: 270 });
    expect(START_SCREEN.actions).toMatchObject({
      height: TEXT_BUTTON.height,
      left: { continue: 364, restart: 164, start: 264 },
      top: 264,
      width: 192,
    });
    // Restart and Continue a gap apart about the centre; the note a gap below the row.
    expect(START_SCREEN.actions.left.continue - (START_SCREEN.actions.left.restart + 192)).toBe(
      SPACING.gap,
    );
    expect(START_SCREEN.note).toEqual({ centre: 360, height: TYPE.body.lineHeight, top: 320 });
    expect(START_SCREEN.ship).toEqual({ centre: { x: 378, y: 84 }, frame: 96, size: 280 });
  });

  it.each([
    ["720x360", { height: 360, width: 720 }, 0],
    ["844x390", { height: 390, width: 844 }, 29],
  ] as const)("places every part at %s in play-view px from x0", (_, css, x0) => {
    const view = logicalView(css);
    expect(playView(view).x).toBe(x0);
    const rects = startScreenRects(view);
    expect(span(rects.ship)).toEqual([238 + x0, 518 + x0, -56, 224]);
    expect(span(rects.wordmark)).toEqual([225 + x0, 495 + x0, 148, 250]);
    expect(span(rects.actions.start)).toEqual([264 + x0, 456 + x0, 264, 312]);
    expect(span(rects.actions.restart)).toEqual([164 + x0, 356 + x0, 264, 312]);
    expect(span(rects.actions.continue)).toEqual([364 + x0, 556 + x0, 264, 312]);
    expect([rects.note.centre, rects.note.y, rects.note.y + rects.note.height]).toEqual([
      360 + x0,
      320,
      340,
    ]);
  });

  it.each([
    ["720x360", { height: 360, width: 720 }, NO_INSETS, [611.5, 659.5], [667.5, 715.5]],
    [
      "720x360 with insets",
      { height: 360, width: 720 },
      PHONE_INSETS,
      [580.5, 628.5],
      [636.5, 684.5],
    ],
    ["844x390", { height: 390, width: 844 }, NO_INSETS, [641.58, 689.58], [697.58, 745.58]],
    [
      "844x390 with insets",
      { height: 390, width: 844 },
      PHONE_INSETS,
      [639.58, 687.58],
      [695.58, 743.58],
    ],
  ] as const)(
    "at %s keeps Achievements and Settings on the HUD row, clear of the wordmark and the note",
    (_, css, insets, achievements, settings) => {
      const view = logicalView(css);
      const hud = hudRect(insets, view);
      const disc = (index: number) => {
        const target = hudButtonTarget(index);
        return [hud.x + hud.width + target.x, hud.x + hud.width + target.x + target.width].map(
          (value) => Math.round(value * 100) / 100,
        );
      };
      expect(disc(1)).toEqual(achievements);
      expect(disc(0)).toEqual(settings);
      const rects = startScreenRects(view);
      // Insets never move the start screen's parts: the wordmark stays left of Achievements.
      expect(rects.wordmark.x + rects.wordmark.width).toBeLessThan(achievements[0]);
      // The note's line box ends inside the available rect, a bottom inset included.
      const available = safeRect(insets, SAFE_MARGIN.page, view);
      expect(rects.note.y + rects.note.height).toBeLessThanOrEqual(available.y + available.height);
      // Restart, the leftmost action, keeps clear of a left inset.
      expect(rects.actions.restart.x).toBeGreaterThan(Math.max(insets.left, SAFE_MARGIN.page));
    },
  );

  it("keeps every part but the ship frame and the field inside the 720x360 game area", () => {
    for (const css of [
      { height: 360, width: 720 },
      { height: 390, width: 844 },
      { height: 720, width: 1280 },
    ]) {
      const view = logicalView(css);
      const area = playView(view);
      const rects = startScreenRects(view);
      for (const rect of [rects.wordmark, ...Object.values(rects.actions)]) {
        expect(rect.x).toBeGreaterThanOrEqual(area.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(area.x + area.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(area.height);
      }
    }
  });
});
