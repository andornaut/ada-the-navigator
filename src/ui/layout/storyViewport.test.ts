import { expect, it } from "vitest";

import { logicalView, playView } from "./playView.ts";
import { storyBackdropRect } from "./storyPage.ts";

it.each([
  { height: 575, width: 1280 },
  { height: 844, width: 390 },
  { height: 360, width: 720 },
  { height: 396, width: 744 },
])("covers the whole view, art window included, with the existing galaxy backdrop at%o", (css) => {
  const view = logicalView(css),
    area = playView(view),
    rect = storyBackdropRect(view, { height: 540, width: 960 });
  expect(rect.width / rect.height).toBeCloseTo(960 / 540, 9);
  expect(rect.x + area.x).toBeLessThanOrEqual(0);
  expect(rect.x + area.x + rect.width).toBeGreaterThanOrEqual(view.width);
  // In game-area px, so the full view runs from -area.y to view.height - area.y.
  expect(rect.y + area.y).toBeLessThanOrEqual(0);
  expect(rect.y + area.y + rect.height).toBeGreaterThanOrEqual(view.height);
  expect(rect.x + rect.width / 2).toBe(360);
  expect(rect.y + rect.height / 2).toBe(180);
});
