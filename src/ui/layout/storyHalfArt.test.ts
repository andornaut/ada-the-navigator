import { describe, expect, it } from "vitest";

import { storyBackgroundScale, storyHalfArtOffset } from "./storyPage.ts";
import { SPACING } from "./tokens.ts";

describe("shared half-art translation", () => {
  it.each([
    { height: 360, width: 779.076923 },
    { height: 960, width: 720 },
  ])(
    "keeps a room subject above the art centre by the canonical padding at $width x $height",
    (view) => {
      const top = view.height - 540 * storyBackgroundScale(view);
      const subject = { bottom: 300, top: 255 };
      const offset = storyHalfArtOffset(view, subject, top, true);
      expect(top + offset + storyBackgroundScale(view) * 277.5).toBeCloseTo(
        view.height / 4 - SPACING.panelPadding,
      );
      expect(storyHalfArtOffset(view, subject, top, false) - offset).toBe(SPACING.panelPadding);
    },
  );
  it("centres an unknown subject without changing the existing canvas scale", () => {
    const view = { height: 360, width: 720 };
    expect(storyHalfArtOffset(view, null, -180, false)).toBe(0);
  });
});
