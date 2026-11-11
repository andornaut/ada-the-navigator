import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import data from "../../public/art/quantum-jump.json";
import { type SheetArt, sheetFrame } from "../ui/jump-overlay.ts";
import {
  canvasFit,
  cockpitFocus,
  emergencyGlow,
  irisRadius,
  jumpFrameAt,
  readQuantumJump,
  reducedWeights,
  switchMs,
} from "./quantum-jump.ts";

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
        frames: [{ iris: { radius: 4, reach: 0.5 }, ms: 10, name: "x", startMs: 0 }],
      }),
    ).toBeUndefined();
  });

  it("holds each frame for its duration, with nothing after 1000 ms", () => {
    expect(jumpFrameAt(jump, 0)?.name).toBe("space");
    expect(jumpFrameAt(jump, 99)?.name).toBe("space");
    expect(jumpFrameAt(jump, 100)?.name).toBe("charge");
    expect(jumpFrameAt(jump, 519)?.name).toBe("tight");
    expect(jumpFrameAt(jump, 520)?.name).toBe("jump");
    expect(jumpFrameAt(jump, 600)?.destination).toBe(true);
    expect(jumpFrameAt(jump, 999)?.name).toBe("clear");
    expect(jumpFrameAt(jump, 1000)).toBeNull();
  });

  it("switches scenes only while the source is fully covered", () => {
    expect(switchMs(jump, false)).toBe(520);
    expect(jumpFrameAt(jump, switchMs(jump, false))?.bright).toBe(true);
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

  it("tints only the charge frame red for Astra's emergency jump", () => {
    const charge = jumpFrameAt(jump, 150)!;
    const close = jumpFrameAt(jump, 300)!;
    expect(emergencyGlow(jump, charge)).toBe("emergency");
    expect(emergencyGlow(jump, close)).toBe("full");
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

  it("centres a cockpit jump on the canopy focus, scaled with the cockpit as it grows", () => {
    // 150 design px down the 390 design px framing, 41.54 logical above centre at scale 1.
    const phone = cockpitFocus({ height: 360, width: 779 });
    expect(phone.x).toBeCloseTo(389.5);
    expect(phone.y).toBeCloseTo(180 - 41.54, 1);
    const large = cockpitFocus({ height: 1080, width: 1920 });
    expect(large.x).toBeCloseTo(960);
    expect(large.y).toBeCloseTo(540 - 2 * 41.54, 1);
  });

  it("locates every named frame in Art's sheets", () => {
    const field = sheet("quantum-jump-field");
    const glow = sheet("quantum-jump-glow");
    for (const frame of jump.frames) {
      if (frame.field) {
        expect(sheetFrame(field, frame.field), frame.name).not.toBeNull();
      }
      if (frame.glow) {
        expect(sheetFrame(glow, frame.glow), frame.name).not.toBeNull();
      }
    }
    expect(sheetFrame(field, "still")).toEqual({ height: 540, width: 960, x: 0, y: 2700 });
    expect(sheetFrame(glow, "emergency")).toEqual({ height: 112, width: 112, x: 336, y: 0 });
    expect(sheetFrame(field, jump.reducedMotion.still)).not.toBeNull();
    expect(sheetFrame(field, jump.emergency.still)).not.toBeNull();
    expect(sheetFrame(sheet("quantum-jump-star"), "jump")).not.toBeNull();
  });
});
