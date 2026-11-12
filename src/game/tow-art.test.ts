import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { JOB_POOL, JOB_TUNING } from "../data/jobs.ts";
import { ART_MANIFEST } from "../testing/public-art.ts";
import {
  craftFrame,
  craftHeading,
  readStrandedCraft,
  readTowLine,
  STRANDED_CRAFT,
  towBeads,
  towCurve,
  type TowFrame,
  towOffset,
} from "./tow-art.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
const manifest = ART_MANIFEST as unknown as { assets: TowFrame[]; tow: string };
const tow = json(manifest.tow);

describe("tow art", () => {
  it("names a stranded craft for each of Cartwheel's rescue items", () => {
    expect(Object.keys(STRANDED_CRAFT).sort()).toEqual([...JOB_POOL[2]!.craft].sort());
  });

  it("reads the cable's layers, beads and cap", () => {
    const line = readTowLine(tow)!;
    expect(line.layers).toEqual([
      { color: "#4F5462", width: 2.5 },
      { color: "#B8BFC9", width: 1.2 },
    ]);
    expect(line.beads).toEqual({ color: "#4F5462", radius: 0.9, spacing: 12, start: 6 });
    expect(line.cap.map(({ radius }) => radius)).toEqual([1.8, 0.8]);
    expect(readTowLine({ ...(tow as object), version: 2 })).toBeUndefined();
  });

  it("reads both craft at 16 headings: the pod's blink pair and the hauler's one frame", () => {
    const craft = readStrandedCraft(tow, manifest.assets);
    const pod = craft.get("stranded-ore-pod")!;
    expect(pod.frames.map((set) => set.map(({ id }) => id))[3]).toEqual([
      "craft-stranded-ore-pod-3-a",
      "craft-stranded-ore-pod-3-b",
    ]);
    expect(pod.frameMs).toBe(700);
    expect(craft.get("stranded-hauler")!.frames[3]!.map(({ id }) => id)).toEqual([
      "craft-stranded-hauler-3",
    ]);
    expect(craftFrame(pod, 3, false, 700).id).toBe("craft-stranded-ore-pod-3-b");
    expect(craftFrame(pod, 3, true, 700).id).toBe("craft-stranded-ore-pod-3-a");
    // A missing heading frame leaves the craft out.
    const partial = manifest.assets.filter(({ id }) => id !== "craft-stranded-hauler-7");
    expect(readStrandedCraft(tow, partial).has("stranded-hauler")).toBe(false);
  });

  it("faces the craft toward Ada and offsets the tow point in display px", () => {
    expect(craftHeading({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(craftHeading({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(4);
    const pod = readStrandedCraft(tow, manifest.assets).get("stranded-ore-pod")!;
    const frame = pod.frames[2]![0]!;
    // Heading 2's lug at (32, 33.835) of the 64 px frame, shown at 28 px.
    expect(towOffset(pod, frame, 2).x).toBeCloseTo(0, 9);
    expect(towOffset(pod, frame, 2).y).toBeCloseTo((33.835 - 32) * (28 / 64), 9);
  });

  it("draws the line straight when taut and sagged by sqrt(3 d (L - d) / 8) when slack", () => {
    const length = JOB_TUNING.tow.line;
    const still = { x: 0, y: 0 };
    const taut = towCurve(length, still, { x: 0, y: 0 }, { x: length, y: 0 });
    expect(taut.every(({ y }) => Math.abs(y) < 1e-9)).toBe(true);
    const chord = 40;
    const slack = towCurve(length, still, { x: 0, y: 0 }, { x: chord, y: 0 });
    const middle = slack[(slack.length - 1) / 2]!;
    expect(middle.x).toBeCloseTo(chord / 2, 9);
    // With no sideways velocity it sags screen-down: world +y here.
    expect(middle.y).toBeCloseTo(Math.sqrt((3 * chord * (length - chord)) / 8), 9);
    // Away from Ada's sideways velocity.
    const moving = towCurve(length, { x: 0, y: 50 }, { x: 0, y: 0 }, { x: chord, y: 0 });
    expect(moving[(moving.length - 1) / 2]!.y).toBeLessThan(0);
  });

  it("spaces beads every 12 px from 6 px off the craft end", () => {
    const beads = readTowLine(tow)!.beads;
    const points = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ];
    expect(towBeads(beads, points).map(({ x }) => x)).toEqual([34, 22, 10]);
  });
});
