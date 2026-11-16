import { expect, it } from "vitest";

import { logicalView, playView } from "./playView.ts";
import { STORY_PANEL, storyBackdropRect, storyContentPadding } from "./storyPage.ts";

it.each([
  { height: 575, width: 1280 },
  { height: 844, width: 390 },
  { height: 360, width: 720 },
])("keeps Earth text and actions padded inside the canonical game width at%o", (css) => {
  const view = logicalView(css),
    area = playView(view),
    padding = storyContentPadding(view);
  expect(padding.left).toBe(area.x + STORY_PANEL.padding);
  expect(view.width - padding.right).toBe(area.x + area.width - STORY_PANEL.padding);
  expect(view.width - padding.left - padding.right).toBeCloseTo(720 - 2 * STORY_PANEL.padding, 9);
});

it.each([
  { height: 575, width: 1280 },
  { height: 844, width: 390 },
  { height: 360, width: 720 },
])("covers the upper art window with the existing galaxy backdrop at%o", (css) => {
  const view = logicalView(css),
    area = playView(view),
    rect = storyBackdropRect(view, { height: 540, width: 960 });
  expect(rect.width / rect.height).toBeCloseTo(960 / 540, 9);
  expect(rect.x + area.x).toBeLessThanOrEqual(0);
  expect(rect.x + area.x + rect.width).toBeGreaterThanOrEqual(view.width);
  expect(rect.y).toBeLessThanOrEqual(0);
  expect(rect.y + rect.height).toBeGreaterThanOrEqual(view.height / 2);
  expect(rect.x + rect.width / 2).toBe(360);
  expect(rect.y + rect.height / 2).toBe(180);
});
