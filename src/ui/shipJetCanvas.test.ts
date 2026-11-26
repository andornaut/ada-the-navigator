import { describe, expect, it } from "vitest";

import type { ShipJets } from "../game/shipJets.ts";
import { drawShipJets } from "./shipJetCanvas.ts";

const jets: ShipJets = {
  frame: 256,
  headings: [[{ anchor: { x: 128, y: 128 }, axis: { x: 0, y: 3.2 }, half: { x: 2, y: 0 } }]],
  layers: [{ colors: [0xff1100, 0xff1100], length: 1, width: 1 }],
  length: { base: 16, exponent: 2, scale: 0 },
};

function canvas() {
  const fills: { alpha: number; color: string }[] = [];
  const points: number[][] = [];
  let saved = 0;
  const context = {
    beginPath() {},
    closePath() {},
    fill() {
      fills.push({ alpha: context.globalAlpha, color: context.fillStyle });
    },
    fillStyle: "old",
    globalAlpha: 0.7,
    lineTo(x: number, y: number) {
      points.push([x, y]);
    },
    moveTo(x: number, y: number) {
      points.push([x, y]);
    },
    restore() {
      context.globalAlpha = saved;
    },
    save() {
      saved = context.globalAlpha;
    },
  };
  return { context: context as unknown as CanvasRenderingContext2D, fills, points };
}

describe("canvas jet adapter", () => {
  it("projects full-pose geometry once at the hull scale and restores alpha after whitening", () => {
    const { context, fills, points } = canvas();
    drawShipJets(
      context,
      jets,
      { displayHeight: 128, displayWidth: 128, pivot: { x: 0.5, y: 0.5 } },
      0,
      { x: 20, y: 30 },
      0.8,
      0.5,
    );
    expect(points[0]).toEqual([21, 30]);
    expect(points[1]![0]).toBe(20);
    expect(points[1]![1]).toBeCloseTo(55.6, 12);
    expect(points[2]).toEqual([19, 30]);
    expect(fills).toEqual([
      { alpha: 0.8, color: "#ff1100" },
      { alpha: 0.4, color: "#ffffff" },
    ]);
    expect(context.globalAlpha).toBe(0.7);
  });

  it("paints a layer only where the frame's larger side is within its maxDisplay", () => {
    const halo = { colors: [0x101a2e, 0x101a2e] as const, length: 1.1, maxDisplay: 42, width: 2 };
    const gated: ShipJets = { ...jets, layers: [{ ...halo, underHull: true }, ...jets.layers] };
    for (const [width, height, colours] of [
      [42, 42, ["#101a2e", "#ff1100"]],
      [24, 24, ["#101a2e", "#ff1100"]],
      [42, 43, ["#ff1100"]],
      [280, 280, ["#ff1100"]],
    ] as const) {
      const { context, fills } = canvas();
      const display = { displayHeight: height, displayWidth: width, pivot: { x: 0.5, y: 0.5 } };
      drawShipJets(context, gated, display, 0, { x: 0, y: 0 });
      expect(fills.map(({ color }) => color)).toEqual(colours);
    }
  });

  it("does not paint a missing heading or invent a material", () => {
    const { context, fills } = canvas();
    const display = { displayHeight: 256, displayWidth: 256, pivot: { x: 0.5, y: 0.5 } };
    drawShipJets(context, jets, display, 1, { x: 0, y: 0 });
    drawShipJets(context, { ...jets, layers: [] }, display, 0, { x: 0, y: 0 });
    expect(fills).toEqual([]);
  });
});
