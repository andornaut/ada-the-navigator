import { describe, expect, it, vi } from "vitest";

import { type EdgeMarker, gameAreaPoint } from "../model/edgeMarkers.ts";
import type { IndicatorKind } from "../model/indicators.ts";
import type { FlightState } from "../model/types.ts";
import { LIGHT_FIELD } from "./lightField.ts";
import { drawEdgeMarkers, drawIndicators } from "./sceneHud.ts";

vi.mock("phaser", () => ({
  GameObjects: {},
  Math: {
    Vector2: class {
      x: number;
      y: number;
      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
      }
    },
  },
  ScaleModes: { LINEAR: 1, NEAREST: 0 },
  Textures: {},
}));
vi.mock("./sceneAssets.ts", () => ({ filterTexture: vi.fn() }));
vi.mock("./touchChrome.ts", () => ({ createUseCallout: vi.fn() }));

class Ink {
  calls: unknown[][] = [];
  setAlpha(...values: number[]) {
    this.calls.push(["setAlpha", ...values]);
    return this;
  }
  fillStyle(...values: number[]) {
    this.calls.push(["fillStyle", ...values]);
    return this;
  }
  fillCircle(...values: number[]) {
    this.calls.push(["fillCircle", ...values]);
    return this;
  }
  fillRect(...values: number[]) {
    this.calls.push(["fillRect", ...values]);
    return this;
  }
  lineStyle(...values: number[]) {
    this.calls.push(["lineStyle", ...values]);
    return this;
  }
  strokeCircle(...values: number[]) {
    this.calls.push(["strokeCircle", ...values]);
    return this;
  }
  strokeTriangle(...values: number[]) {
    this.calls.push(["strokeTriangle", ...values]);
    return this;
  }
  strokePoints(points: readonly { x: number; y: number }[], ...values: boolean[]) {
    this.calls.push(["strokePoints", points.map((p) => [p.x, p.y]), ...values]);
    return this;
  }
}

function fixture(kind: IndicatorKind = "objective", light = false, reducedMotion = false) {
  const at = { x: 500, y: -500 };
  const player = { x: 0, y: 0 };
  const edge = new Ink(),
    overlay = new Ink(),
    indicator = new Ink();
  const markers: EdgeMarker[] = [];
  const scene = {
    controls: {
      layout: () => ({
        insets: { bottom: 0, left: 0, right: 0, top: 0 },
        view: { height: 360, width: 720 },
      }),
    },
    edgeMarkerInk: edge,
    edgeMarkers: { update: () => markers },
    indicatorInk: indicator,
    light,
    litCaches: new Map(),
    model: { indicatorTargets: [{ ...at, id: "target", kind }], pennyMarkers: () => [] },
    overlay,
    palette: { pointOfInterest: 0xb8b3c9, threat: 0xe4574e },
    project: (p: { x: number; y: number }) => gameAreaPoint(player, p),
    reducedMotion,
    time: { now: 250 },
  };
  return {
    at,
    edge,
    flight: { player } as FlightState,
    indicator,
    markers,
    overlay,
    scene: scene as unknown as Parameters<typeof drawIndicators>[0],
  };
}

describe("canonical marker rendering", () => {
  it.each([
    [undefined, LIGHT_FIELD.ink],
    [0, 0],
    [0x235689, 0x235689],
  ])(
    "preserves the supplied foreground ink in both station paths, edgeInk=%s",
    (edgeInk, expected) => {
      const seen = fixture("station", true);
      Object.assign(seen.scene, { edgeInk });
      seen.markers.push({ ...seen.at, id: "station", kind: "station" });
      drawEdgeMarkers(seen.scene, seen.flight);
      const nearby = fixture("station", true);
      Object.assign(nearby.scene, { edgeInk });
      drawIndicators(nearby.scene);
      expect(nearby.edge.calls).toEqual(seen.edge.calls);
      expect(seen.edge.calls[0]).toEqual(["lineStyle", expect.any(Number), expected, 1]);
    },
  );

  it.each([false, true])(
    "uses exactly the same station draw path before and after discovery, light=%s",
    (light) => {
      const seen = fixture("station", light);
      seen.markers.push({ ...seen.at, id: "station", kind: "station" });
      drawEdgeMarkers(seen.scene, seen.flight);
      const nearby = fixture("station", light);
      drawIndicators(nearby.scene);
      expect(nearby.edge.calls).toEqual(seen.edge.calls);
      expect(nearby.overlay.calls).toEqual([]);
    },
  );

  it.each([false, true])(
    "keeps blocking and disabled guard icons identical under reduced motion, light=%s",
    (light) => {
      const normal = fixture("objective", light, false);
      normal.markers.push({ ...normal.at, bar: 1, id: "guard", kind: "guard" });
      drawEdgeMarkers(normal.scene, normal.flight);
      const reduced = fixture("objective", light, true);
      reduced.markers.push({ ...reduced.at, bar: 0.2, id: "guard", kind: "guard" });
      drawEdgeMarkers(reduced.scene, reduced.flight);
      expect(reduced.edge.calls).toEqual(normal.edge.calls);
      expect(normal.edge.calls.some((call) => call[0] === "fillCircle" && call[3] === 6)).toBe(
        true,
      );
      expect(normal.edge.calls.at(-2)).toEqual(["fillStyle", expect.any(Number), 1]);
    },
  );

  it.each([false, true])(
    "shares one direction icon for all quest target kinds, light=%s",
    (light) => {
      const baseline = fixture("objective", light);
      drawIndicators(baseline.scene);
      for (const kind of ["holodisk", "questItem", "job"] as const) {
        const other = fixture(kind, light, true);
        drawIndicators(other.scene);
        expect(other.overlay.calls).toEqual(baseline.overlay.calls);
        expect(other.indicator.calls).toEqual(baseline.indicator.calls);
      }
      const triangle = baseline.overlay.calls
        .find((call) => call[0] === "strokeTriangle")!
        .slice(1) as number[];
      const ys = [triangle[1]!, triangle[3]!, triangle[5]!];
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(12);
    },
  );

  it("retains the actual onscreen holodisk pulse and leaves other onscreen targets unmarked", () => {
    const f = fixture("holodisk");
    Object.assign(f.scene.model.indicatorTargets[0]!, { x: 0, y: 0 });
    drawIndicators(f.scene);
    expect(f.overlay.calls).toContainEqual(["strokeCircle", 360, 180, 28]);
    const plain = fixture("objective");
    Object.assign(plain.scene.model.indicatorTargets[0]!, { x: 0, y: 0 });
    drawIndicators(plain.scene);
    expect(plain.overlay.calls).toEqual([]);
  });
});
