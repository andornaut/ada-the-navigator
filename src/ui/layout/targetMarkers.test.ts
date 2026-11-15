import { describe, expect, it } from "vitest";

import type { TargetMarker } from "../../model/targetMarkers.ts";
import { layoutTargetMarkers } from "./targetMarkers.ts";

const context = {
  area: { height: 360, width: 720, x: 0, y: 0 },
  blocked: [
    { height: 90, width: 190, x: 530, y: 0 },
    { height: 100, width: 420, x: 150, y: 260 },
  ],
  gap: 4,
  player: { x: 0, y: 0 },
  size: 24,
};
const marker = (id: string, x = 4000, y = 0): TargetMarker => ({
  id,
  identified: true,
  symbol: "station",
  x,
  y,
});
const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < context.size && Math.abs(a.y - b.y) < context.size;

describe("unified marker placement", () => {
  it.each([
    { height: 360, width: 720, x: 0, y: 0 },
    { height: 320, width: 667, x: 0, y: 0 },
  ])(
    "retains separate same-direction IDs while avoiding HUD, dialogue and other markers: %j",
    (area) => {
      const targets = [marker("a"), marker("b"), marker("c")];
      const placements = layoutTargetMarkers({ ...context, area }, targets);
      expect(placements.map(({ target }) => target.id)).toEqual(["a", "b", "c"]);
      for (const [index, placement] of placements.entries()) {
        expect(placement.crowded).toBe(false);
        expect(placement.anchor).toEqual(placements[0]!.anchor);
        expect(placements.slice(0, index).some((other) => overlaps(placement.at, other.at))).toBe(
          false,
        );
        for (const blocked of context.blocked) {
          const { x, y } = placement.at;
          expect(
            x + 12 <= blocked.x ||
              x - 12 >= blocked.x + blocked.width ||
              y + 12 <= blocked.y ||
              y - 12 >= blocked.y + blocked.height,
          ).toBe(true);
        }
      }
    },
  );
  it("uses stable target ordering and keeps original direction when a UI footprint displaces a badge", () => {
    const a = marker("a"),
      b = marker("b");
    expect(layoutTargetMarkers(context, [a, b])).toEqual(layoutTargetMarkers(context, [b, a]));
    const [result] = layoutTargetMarkers(
      { ...context, blocked: [{ height: 360, width: 100, x: 620, y: 0 }] },
      [marker("east", 4000, -4000)],
    );
    expect(result!.at).not.toEqual(result!.anchor);
    expect(result!.anchor.x).toBe(708);
    expect(result!.target.id).toBe("east");
  });
  it("retains all identities with an explicit crowding result when UI occupies the entire area", () => {
    const results = layoutTargetMarkers({ ...context, blocked: [context.area] }, [
      marker("a"),
      marker("b"),
    ]);
    expect(results.map(({ target }) => target.id)).toEqual(["a", "b"]);
    expect(results.every(({ crowded }) => crowded)).toBe(true);
  });
});
