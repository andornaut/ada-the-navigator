import { describe, expect, it, vi } from "vitest";

import { JET_PROFILE } from "../../art/tools/ship-jet-layers.ts";
import { plumePolygon } from "../../art/tools/ship-plume.ts";
import manifest from "../../public/art/manifest.json";
import data from "../../public/art/quantum-jump.json";
import jetData from "../../public/art/ship-jets.json";
import {
  AUTHORED_JET_LENGTH,
  engineJets,
  jetPlumes,
  jetShapePolygons,
  jetsInFront,
  readEngineJets,
} from "../art/index.ts";
import { createJumpOverlay, type SheetArt, sheetFrame } from "../ui/jumpOverlay.ts";
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

  it("reads seven full-pose jet geometries without changing coast or pose scaling", () => {
    expect(jump.warp.poses.filter((pose) => pose.jets)).toHaveLength(7);
    for (const pose of jump.warp.poses) {
      if (pose.jets) {
        expect(pose.jets.frame).toBe(jump.warp.frame);
        expect(pose.jets.headings).toHaveLength(1);
        expect(pose.jets.length).toEqual({ base: 16, exponent: 2, scale: 0 });
        expect(pose.jets.headings[0]).toHaveLength(2);
        const layers = jetData.engineLevels[0]!.layers;
        // Every warp mouth draws its plume above the hull and redraws the hull in its occluders.
        expect(jetData.profile).toEqual(JET_PROFILE);
        expect(jetsInFront(pose.jets, 0)).toBe(true);
        for (const mouth of pose.jets.headings[0]!) {
          const plumes = jetShapePolygons(mouth, layers, pose.jets.length.base, 1, JET_PROFILE);
          expect(plumes.map(({ layerIndex }) => layerIndex)).toEqual(layers.map((_, i) => i));
          for (const { layerIndex, points } of plumes) {
            const expected = plumePolygon(
              JET_PROFILE,
              {
                anchor: [mouth.anchor.x, mouth.anchor.y],
                axis: [mouth.axis.x, mouth.axis.y],
                half: [mouth.half.x, mouth.half.y],
              },
              layers[layerIndex]!,
              AUTHORED_JET_LENGTH,
            ).flat();
            const actual = points.flatMap(({ x, y }) => [x, y]);
            expect(actual).toHaveLength(expected.length);
            actual.forEach((value, at) => expect(value).toBeCloseTo(expected[at]!, 12));
          }
        }
      }
    }
    // One settle-10 mouth has no nearer hull surface; its empty list still draws in front.
    const settle = jump.warp.poses.find(({ id }) => id === "settle-10")!.jets!;
    expect(settle.headings[0]!.some(({ occluders }) => occluders?.length === 0)).toBe(true);
    expect(jump.warp.poses.find(({ id }) => id === "bank-8")?.jets).toBeUndefined();
    expect(jump.warp.poses.find(({ id }) => id === "settle-5")?.jets).toBeUndefined();
  });

  it("draws no halo on any warp pose at any step's scale", () => {
    const material = engineJets(readEngineJets(jetData)!, 1);
    expect(material.layers.some(({ underHull }) => underHull)).toBe(true);
    const drawn = jump.frames.flatMap(({ steps }) =>
      steps.flatMap(({ ship }) => {
        const pose = jump.warp.poses.find(({ id }) => id === ship?.pose);
        return pose?.jets ? [{ jets: pose.jets, scale: ship!.scale }] : [];
      }),
    );
    expect(drawn.length).toBeGreaterThan(0);
    for (const { jets, scale } of drawn) {
      const size = warpPoseSize(jump.warp, scale);
      expect(size).toBeGreaterThan(42);
      const plumes = jetPlumes(
        {
          ...jets,
          layers: material.layers,
          ...(material.profile ? { profile: material.profile } : {}),
        },
        { displayHeight: size, displayWidth: size, pivot: { x: 0.5, y: 0.5 } },
        0,
        1,
      );
      expect(plumes.length).toBeGreaterThan(0);
      expect(plumes.some(({ underHull }) => underHull)).toBe(false);
    }
  });

  it("rejects malformed, wrong-frame and multi-heading optional pose jets but supports absent geometry", () => {
    const geometry = {
      frame: data.warp.frame,
      headings: [{ index: 0, mouths: [{ anchor: [128, 128], axis: [0, 1], half: [2, 0] }] }],
      length: { base: 16, exponent: 2, scale: 0 },
      version: 1,
    };
    for (const jets of [
      null,
      { ...geometry, frame: 96 },
      { ...geometry, version: 2 },
      { ...geometry, headings: [...geometry.headings, { ...geometry.headings[0], index: 1 }] },
      {
        ...geometry,
        headings: [
          {
            index: 0,
            mouths: [{ anchor: [0, 0], axis: [0, 1], half: [2, 0], occluders: {} }],
          },
        ],
      },
    ]) {
      const value = structuredClone(data);
      Object.assign(value.warp.poses[0]!, { jets });
      expect(readQuantumJump(value)).toBeUndefined();
    }
    const legacy = structuredClone(data);
    for (const pose of legacy.warp.poses) {
      Reflect.deleteProperty(pose, "jets");
    }
    expect(readQuantumJump(legacy)).toBeDefined();
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
    expect(warp.heading).toBe(48);
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
    expect(spriteHeading(16, 48, undefined, 64)).toBe(48);
    expect(spriteHeading(40, 48, 0.5, 64)).toBe(44);
    expect(spriteHeading(40, 48, 1, 64)).toBe(48);
    // From 8 the short way to 48 runs down through 0, over -24 frames.
    expect(spriteHeading(8, 48, 0.333, 64)).toBe(0);
    expect(spriteHeading(8, 48, 0.667, 64)).toBe(56);
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

it.each([false, true])(
  "holds the covered arrival until ready (reduced motion %s)",
  (reducedMotion) => {
    let render: FrameRequestCallback = () => {};
    const cancel = vi.fn();
    const remove = vi.fn();
    const fillRect = vi.fn();
    const canvas = {
      getContext: () => ({
        clearRect: vi.fn(),
        fillRect,
        restore: vi.fn(),
        save: vi.fn(),
        setTransform: vi.fn(),
      }),
      remove,
      setAttribute: vi.fn(),
      style: {},
    };
    const host = { append: vi.fn(), clientHeight: 160, clientWidth: 320 } as unknown as HTMLElement;
    vi.stubGlobal("document", { createElement: () => canvas, hidden: false });
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    vi.stubGlobal("Image", class {});
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
    vi.stubGlobal("cancelAnimationFrame", cancel);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      render = callback;
      return 1;
    });
    try {
      const overlay = createJumpOverlay(() => 0, host, {
        field: sheet("quantum-jump-field"),
        glow: sheet("quantum-jump-glow"),
        jump,
        star: sheet("quantum-jump-star"),
        tunnel: sheet("quantum-jump-tunnel"),
      });
      const onSwitch = vi.fn();
      const onDone = vi.fn();
      const arrivalReady = vi.fn(() => false);
      const source = { center: { x: 160, y: 80 }, heading: null, specks: [] };
      const cover = switchMs(jump, reducedMotion);
      overlay.play({
        arrivalReady,
        destination: () => source,
        emergency: false,
        onCover: vi.fn(),
        onDone,
        onSwitch,
        reducedMotion,
        source,
      });
      render(cover);
      expect(onSwitch).not.toHaveBeenCalled();
      expect(fillRect).toHaveBeenCalledOnce();
      render(cover + 16);
      expect(onSwitch).toHaveBeenCalledOnce();
      render(cover + 1000);
      expect(overlay.active()).toBe(true);
      expect(fillRect).toHaveBeenCalledTimes(3);
      expect(onDone).not.toHaveBeenCalled();
      if (reducedMotion) {
        // The offline path must finish even while the optional loader stays busy.
        render(cover + 2500);
        expect(arrivalReady).toHaveReturnedWith(false);
      } else {
        arrivalReady.mockReturnValue(true);
        render(cover + 1016);
        expect(overlay.active()).toBe(true);
        expect(fillRect).toHaveBeenCalledTimes(3);
        render(cover + 2000);
      }
      expect(remove).toHaveBeenCalledOnce();
      expect(onSwitch).toHaveBeenCalledOnce();
      expect(onDone).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
