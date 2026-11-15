import { describe, expect, it, vi } from "vitest";

import { gameAreaPoint } from "../model/edgeMarkers.ts";
import type { IndicatorKind } from "../model/indicators.ts";
import { drawIndicators } from "./sceneHud.ts";

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
  const scene = {
    controls: {
      layout: () => ({
        insets: { bottom: 0, left: 0, right: 0, top: 0 },
        view: { height: 360, width: 720 },
      }),
    },
    edgeMarkerInk: edge,
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
    indicator,
    overlay,
    scene: scene as unknown as Parameters<typeof drawIndicators>[0],
  };
}

describe("canonical marker rendering", () => {
  it.each(["station", "objective", "holodisk", "questItem", "job"] as const)(
    "does not draw a duplicate offscreen %s marker in the canvas HUD",
    (kind) => {
      const f = fixture(kind);
      drawIndicators(f.scene);
      expect(f.edge.calls).toEqual([]);
      expect(f.overlay.calls).toEqual([]);
      expect(f.indicator.calls).toEqual([]);
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
