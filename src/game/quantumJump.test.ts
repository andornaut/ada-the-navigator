import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import data from "../../public/art/quantum-jump.json";
import { type SheetArt, sheetFrame } from "../ui/jumpOverlay.ts";
import {
  canvasFit,
  emergencyGlow,
  emergencyStartMs,
  irisRadius,
  jumpStepAt,
  posePaths,
  readQuantumJump,
  reducedShipWeights,
  reducedWeights,
  spriteHeading,
  switchMs,
  tunnelScale,
  warpPoseSize,
} from "./quantumJump.ts";

const jump = readQuantumJump(data)!;
const sheet = (id: string): SheetArt => {
  const asset = manifest.assets.find((entry) => entry.id === id) as unknown as SheetArt & {
    path: string;
  };
  return { ...asset, url: asset.path };
};

describe("quantum jump data", () => {
  it("reads Art's effect and rejects malformed data", () => {
    expect(jump.durationMs).toBe(1000);
    expect(jump.frames.map((frame) => frame.name)).toEqual([
      "space",
      "charge",
      "close",
      "tight",
      "jump",
      "open",
      "clear",
    ]);
    expect(readQuantumJump({ ...data, version: 2 })).toBeUndefined();
    expect(
      readQuantumJump({ ...data, frames: [{ ms: 0, name: "space", startMs: 0 }] }),
    ).toBeUndefined();
    expect(
      readQuantumJump({
        ...data,
        frames: [
          { ms: 10, name: "x", startMs: 0, steps: [{ iris: { radius: 4, reach: 1 }, ms: 10 }] },
        ],
      }),
    ).toBeUndefined();
    // A phase's steps fill its ms exactly, and a ship step names a pose at a positive scale.
    expect(
      readQuantumJump({ ...data, frames: [{ ms: 10, name: "x", startMs: 0, steps: [{ ms: 5 }] }] }),
    ).toBeUndefined();
    expect(
      readQuantumJump({
        ...data,
        frames: [
          {
            ms: 10,
            name: "x",
            startMs: 0,
            steps: [{ ms: 10, ship: { pose: "bank-8", scale: 0 } }],
          },
        ],
      }),
    ).toBeUndefined();
    expect(jump.frames.map((frame) => frame.steps.length)).toEqual([1, 3, 3, 2, 1, 6, 2]);
  });

  it("starts emergency effects without a blank hold while preserving reduced fades and normal lead-in", () => {
    expect(jumpStepAt(jump, emergencyStartMs(false, jump))?.frame.name).toBe("charge");
    expect(jumpStepAt(jump, emergencyStartMs(false, jump))?.step.glow).toBeDefined();
    expect(reducedWeights(jump, emergencyStartMs(true, jump))?.source).toBe(1);
    expect(reducedWeights(jump, emergencyStartMs(true, jump) + 1)?.still).toBeGreaterThan(0);
    expect(jumpStepAt(jump, 0)?.frame.name).toBe("space");
  });

  it("holds each step for its ms, the destination from 600 ms and nothing from 1000", () => {
    expect(jumpStepAt(jump, 0)?.step).toEqual({ ms: 100 });
    expect(jumpStepAt(jump, 99)?.frame.name).toBe("space");
    expect(jumpStepAt(jump, 149)?.step.ship).toEqual({ pose: "sprite", scale: 1, turn: 0.333 });
    expect(jumpStepAt(jump, 150)?.step.ship?.turn).toBe(0.667);
    expect(jumpStepAt(jump, 250)?.step.tunnel).toBe("t0");
    expect(jumpStepAt(jump, 519)?.frame.name).toBe("tight");
    expect(jumpStepAt(jump, 520)).toMatchObject({ frame: { bright: true, name: "jump" } });
    expect(jumpStepAt(jump, 520)?.step.star).toBe(true);
    expect(jumpStepAt(jump, 600)?.frame.destination).toBe(true);
    expect(jumpStepAt(jump, 899)?.step.iris).toEqual({ radius: 320 });
    expect(jumpStepAt(jump, 999)?.step.iris).toEqual({ reach: 0.96 });
    expect(jumpStepAt(jump, 1000)).toBeNull();
  });

  it("switches scenes only while the source is fully covered", () => {
    expect(switchMs(jump, false)).toBe(520);
    expect(jumpStepAt(jump, switchMs(jump, false))?.frame.bright).toBe(true);
    expect(switchMs(jump, true)).toBe(400);
    expect(reducedWeights(jump, 400)?.still).toBe(1);
  });

  it("cross-fades through the still under reduced motion in 900 ms", () => {
    expect(reducedWeights(jump, 50)).toEqual({ destination: 0, source: 1, still: 0 });
    expect(reducedWeights(jump, 250)).toEqual({ destination: 0, source: 0.5, still: 0.5 });
    expect(reducedWeights(jump, 650)).toEqual({ destination: 0.5, source: 0, still: 0.5 });
    expect(reducedWeights(jump, 800)).toEqual({ destination: 1, source: 0, still: 0 });
    expect(reducedWeights(jump, 900)).toBeNull();
  });

  it("holds the ship under reduced motion until 550 ms, then cross-fades it by 750", () => {
    expect(reducedShipWeights(jump, 0)).toEqual({ destination: 0, source: 1 });
    expect(reducedShipWeights(jump, 550)).toEqual({ destination: 0, source: 1 });
    expect(reducedShipWeights(jump, 650)).toEqual({ destination: 0.5, source: 0.5 });
    expect(reducedShipWeights(jump, 750)).toEqual({ destination: 1, source: 0 });
  });

  it("tints only the charge frame red for Astra's emergency jump", () => {
    const charge = jumpStepAt(jump, 150)!;
    const close = jumpStepAt(jump, 300)!;
    expect(emergencyGlow(jump, charge.frame, charge.step)).toBe("emergency");
    expect(emergencyGlow(jump, close.frame, close.step)).toBe("full");
    expect(jump.emergency.charge.wash).toEqual({ alpha: 0.15, colour: "#e43b44" });
    expect(jump.emergency.still).toBe("still-emergency");
  });

  it("sizes the iris by reach or radius and fits the field like a storybook background", () => {
    const phone = { height: 360, width: 779 };
    expect(irisRadius(phone, { radius: 66 })).toBe(66);
    expect(irisRadius(phone, { reach: 0.645 })).toBeCloseTo((0.645 * Math.hypot(779, 360)) / 2);
    expect(canvasFit({ height: 540, width: 960 }, phone)).toEqual({ scale: 1, x: -90.5, y: -90 });
    const wide = canvasFit({ height: 540, width: 960 }, { height: 600, width: 1280 });
    expect(wide.scale).toBeCloseTo(1280 / 960);
    expect(wide.x).toBeCloseTo(0);
  });

  it("reads the warp's nine poses with a path for each of the five paints", () => {
    const { warp } = jump;
    expect(warp.heading).toBe(24);
    expect(warp.tunnel).toBe("quantum-jump-tunnel");
    expect(warp.poses.map((pose) => pose.id)).toEqual([
      "bank-8",
      "bank-16",
      "bank-24",
      "bank-30",
      "stretch-30",
      "settle-24",
      "settle-16",
      "settle-10",
      "settle-5",
    ]);
    expect(warpPoseSize(warp, 1)).toBe(112);
    expect(posePaths(warp, "cobalt").size).toBe(9);
    expect(posePaths(warp, "cobalt").get("bank-8")).toBe(
      "/art/quantum-jump-ship/cobalt/bank-8.svg",
    );
    expect(posePaths(warp, "unknown").get("bank-8")).toBe(
      "/art/quantum-jump-ship/classic/bank-8.svg",
    );
    // Every pose names the same paints.
    const [first, second] = data.warp.poses;
    const uneven = { ...data.warp, poses: [first, { ...second, paths: { classic: "/x.svg" } }] };
    expect(readQuantumJump({ ...data, warp: uneven })).toBeUndefined();
  });

  it("turns the sprite the shortest way to the arrival heading, on whole frames", () => {
    expect(spriteHeading(8, 24, undefined, 32)).toBe(24);
    expect(spriteHeading(20, 24, 0.5, 32)).toBe(22);
    expect(spriteHeading(20, 24, 1, 32)).toBe(24);
    // From 4 the short way to 24 runs down through 0, over -12 frames.
    expect(spriteHeading(4, 24, 0.333, 32)).toBe(0);
    expect(spriteHeading(4, 24, 0.667, 32)).toBe(28);
  });

  it("scales the tunnel to cover the view from the jump centre", () => {
    const canvas = { height: 540, width: 960 };
    expect(tunnelScale(canvas, { x: 360, y: 180 }, { height: 360, width: 720 })).toBe(1);
    expect(tunnelScale(canvas, { x: 100, y: 180 }, { height: 360, width: 1100 })).toBeCloseTo(
      2000 / 960,
    );
  });

  it("locates every named frame in Art's sheets", () => {
    const field = sheet("quantum-jump-field");
    const glow = sheet("quantum-jump-glow");
    const tunnel = sheet(jump.warp.tunnel);
    const poses = new Set(jump.warp.poses.map((pose) => pose.id));
    for (const frame of jump.frames) {
      for (const step of frame.steps) {
        if (step.tunnel) {
          expect(sheetFrame(tunnel, step.tunnel), frame.name).not.toBeNull();
        }
        if (step.glow) {
          expect(sheetFrame(glow, step.glow), frame.name).not.toBeNull();
        }
        if (step.ship && step.ship.pose !== "sprite") {
          expect(poses.has(step.ship.pose), frame.name).toBe(true);
        }
      }
    }
    expect(sheetFrame(glow, "emergency")).toEqual({ height: 112, width: 112, x: 336, y: 0 });
    expect(sheetFrame(field, jump.reducedMotion.still)).not.toBeNull();
    expect(sheetFrame(field, jump.emergency.still)).not.toBeNull();
    expect(sheetFrame(sheet("quantum-jump-star"), "jump")).not.toBeNull();
  });
});
