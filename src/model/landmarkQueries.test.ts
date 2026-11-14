import { describe, expect, it, vi } from "vitest";

import { LANDMARK_TUNING } from "../data/jobs.ts";
import { landmarkSites, unchartedNear } from "./landmarks.ts";

describe("indexed uncharted landmark queries", () => {
  it.each([1, 2, 3, 4, 5, 6] as const)(
    "keeps galaxy %i's exhaustive catalog order and inclusive range",
    (galaxy) => {
      const sites = landmarkSites(galaxy);
      for (const site of sites) {
        for (const range of [0, LANDMARK_TUNING.chart, 5000]) {
          for (const delta of [-1e-7, 0, 1e-7]) {
            const point = { x: site.x + range + delta, y: site.y };
            const charted = sites.filter((_, index) => index % 3 === 0).map(({ id }) => id);
            expect(unchartedNear(galaxy, { charted }, range, point)).toEqual(
              sites.filter(
                (entry) =>
                  !charted.includes(entry.id) &&
                  Math.hypot(entry.x - point.x, entry.y - point.y) <= range,
              ),
            );
          }
        }
      }
      for (const range of [-1, Infinity, NaN]) {
        const point = { x: 0, y: 0 };
        expect(unchartedNear(galaxy, { charted: [] }, range, point)).toEqual(
          sites.filter((site) => Math.hypot(site.x, site.y) <= range),
        );
      }
    },
  );

  it("does not measure every distant catalog site for a local query", () => {
    const sites = landmarkSites(1);
    unchartedNear(1, { charted: [] }, 300, { x: 0, y: 0 });
    const hypot = vi.spyOn(Math, "hypot");
    try {
      unchartedNear(1, { charted: [] }, 300, { x: 1000, y: 1000 });
      expect(hypot.mock.calls.length).toBeLessThan(sites.length);
    } finally {
      hypot.mockRestore();
    }
  });
});
