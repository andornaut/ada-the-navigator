import { describe, expect, it } from "vitest";

import { sceneryDetail } from "./scenery.ts";

const ids = ["a", "b", "c"];

describe("bounded scenic decoration", () => {
  it("provides distinct rock, ribbed and panel variants without depending on draw order", () => {
    const forward = new Map(ids.map((id) => [id, sceneryDetail(id)]));
    const reversed = new Map([...ids].reverse().map((id) => [id, sceneryDetail(id)]));
    expect(new Set([...forward.values()].map((detail) => detail.kind))).toEqual(
      new Set(["faceted-rock", "ribbed-bulkhead", "panel-mass"]),
    );
    for (const id of ids) {
      expect(reversed.get(id)).toEqual(forward.get(id));
    }
  });

  it("keeps every decorative contour and seam inside the visible foundation and collider", () => {
    for (const id of ids) {
      const detail = sceneryDetail(id);
      expect(detail.outline.length).toBeGreaterThanOrEqual(4);
      expect(detail.seams.length).toBeGreaterThan(0);
      // Both bounds are convex, so contained endpoints also contain their connecting segments.
      for (const point of [...detail.outline, ...detail.seams.flat()]) {
        expect(point.x ** 2 + point.y ** 2).toBeLessThan(1);
        expect(point.x ** 2 + (point.y / 0.7) ** 2).toBeLessThan(1);
      }
    }
  });
});
