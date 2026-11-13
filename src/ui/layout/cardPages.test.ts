import { describe, expect, it } from "vitest";

import { cardPages } from "./cardPages.ts";

describe("card pages", () => {
  it("fits actual measured blocks and gaps without dropping or reordering any block", () => {
    const heights = [28, 20, 60, 20, 48, 48, 20];
    const pages = cardPages(156, 8, heights);
    expect(pages).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6],
    ]);
    expect(pages.flat()).toEqual(heights.map((_, index) => index));
    for (const page of pages) {
      expect(
        page.reduce((sum, index) => sum + heights[index]!, 0) + (page.length - 1) * 8,
      ).toBeLessThanOrEqual(156);
    }
  });
  it("keeps an exact fit, supplies an empty page and adds pages as height decreases", () => {
    expect(cardPages(104, 8, [48, 48])).toEqual([[0, 1]]);
    expect(cardPages(103, 8, [48, 48])).toEqual([[0], [1]]);
    expect(cardPages(104, 8, [])).toEqual([[]]);
  });
});
