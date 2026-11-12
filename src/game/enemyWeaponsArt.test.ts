import { describe, expect, it } from "vitest";

import file from "../../public/art/enemy-weapons.json";
import manifest from "../../public/art/manifest.json";
import {
  beamAt,
  dashes,
  enemyInkEdges,
  enemyPhaser,
  type EnemyWeaponsArt,
  lance,
  mine,
  mineBlink,
  readEnemyWeaponsArt,
  ringDart,
  ringEmission,
} from "./enemyWeaponsArt.ts";
import type { EffectShape, LineShape, TaperShape } from "./weaponEffects.ts";

const art = readEnemyWeaponsArt(file)!;
const CORAL = 0xd68b72;
const PLATE = 0xe6a890;
const WHITE = 0xffffff;
const INK = 0x181425;
const lines = (shapes: readonly EffectShape[]) =>
  shapes.filter((shape): shape is LineShape => shape.kind === "line");
const length = ({ from, to }: LineShape) => Math.hypot(to.x - from.x, to.y - from.y);

describe("enemy weapons art", () => {
  it("is linked from the core manifest and reads Art's colours", () => {
    expect((manifest as { enemyWeapons?: string }).enemyWeapons).toBe("/art/enemy-weapons.json");
    expect(art.colours).toEqual({
      coralSide: 0xa8654f,
      ink: INK,
      obstacle: CORAL,
      plate: PLATE,
      weapon: 0xf0bd68,
      white: WHITE,
    });
  });

  it("rejects another version, a bad colour or a missing timing", () => {
    const copy = () => JSON.parse(JSON.stringify(file)) as typeof file;
    expect(readEnemyWeaponsArt({ ...copy(), version: 2 })).toBeUndefined();
    const colour = copy();
    colour.colours.plate = "pale";
    expect(readEnemyWeaponsArt(colour)).toBeUndefined();
    const timing = copy();
    delete (timing.lance as { trackMs?: number }).trackMs;
    expect(readEnemyWeaponsArt(timing)).toBeUndefined();
    const reference = copy();
    reference.phaser.layers[1]!.colour = "teal";
    expect(readEnemyWeaponsArt(reference)).toBeUndefined();
    expect(readEnemyWeaponsArt(undefined)).toBeUndefined();
  });
});

describe("ring burst", () => {
  it("draws the spawn circle as a ground ellipse fading over 180 ms", () => {
    const at = { x: 10, y: 20 };
    const [ring] = ringEmission(art, at, 30, [], false, 90).shapes;
    expect(ring).toMatchObject({ alpha: 0.5, at, colour: CORAL, kind: "ellipse", stroke: 1.5 });
    expect((ring as { halfWidth: number }).halfWidth).toBeCloseTo(30 * Math.SQRT2, 9);
    expect((ring as { halfHeight: number }).halfHeight).toBeCloseTo(30 / Math.SQRT2, 9);
    expect(ringEmission(art, at, 30, [], false, 180).shapes).toEqual([]);
  });

  it("shrinks a muzzle disc at each bolt's origin, with no discs under reduced motion", () => {
    const origins = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ];
    const discs = ringEmission(art, { x: 0, y: 0 }, 30, origins, false, 30).shapes.filter(
      (shape) => shape.kind === "disc",
    );
    // A coral disc and its white core at each origin until 60 ms.
    expect(discs).toHaveLength(4);
    expect(discs[0]).toMatchObject({ colour: CORAL, radius: 3.6 + (0.6 - 3.6) * 0.25 });
    expect(ringEmission(art, { x: 0, y: 0 }, 30, origins, false, 90).shapes).toHaveLength(3);
    expect(ringEmission(art, { x: 0, y: 0 }, 30, origins, true, 30).shapes).toHaveLength(1);
  });

  it("draws a dart turned to the bolt's projected heading, its tail scaled by the heading", () => {
    const right = ringDart(art, { x: 0, y: 0 }, { x: 1, y: -1 });
    const [tail, body, core] = right.shapes as [EffectShape, EffectShape, EffectShape];
    expect(body).toMatchObject({ colour: CORAL, kind: "polygon" });
    expect(core).toMatchObject({ colour: WHITE, kind: "polygon" });
    // Heading 14 projects to screen right: the nose points along +x and the tail runs 3 + 9.
    expect((body as unknown as { points: { x: number }[] }).points[0]!.x).toBeCloseTo(2.2, 9);
    expect((tail as { tail: { at: { x: number } } }).tail.at.x).toBeCloseTo(-12, 9);
    expect(right.edged).toEqual([body]);
  });
});

describe("mine", () => {
  it("blinks white by its remaining life, the phase counted from the drop", () => {
    expect(mineBlink(art, 50, 10_000)).toBe(true);
    expect(mineBlink(art, 150, 10_000)).toBe(false);
    expect(mineBlink(art, 1050, 3000)).toBe(true);
    expect(mineBlink(art, 1110, 3000)).toBe(false);
    expect(mineBlink(art, 270, 1000)).toBe(true);
    expect(mineBlink(art, 340, 1000)).toBe(false);
  });

  it("spins its spikes, holds them still under reduced motion and shows its hint late", () => {
    const at = { x: 0, y: 0 };
    const tipAngle = (shapes: readonly EffectShape[]) => {
      const [tip] = (shapes[0] as unknown as { points: { x: number; y: number }[] }).points;
      return (Math.atan2(tip!.y, tip!.x) * 180) / Math.PI;
    };
    expect(tipAngle(mine(art, at, { ageMs: 500, lifeMs: 20_000 }, false).shapes)).toBeCloseTo(
      30,
      6,
    );
    expect(tipAngle(mine(art, at, { ageMs: 500, lifeMs: 20_000 }, true).shapes)).toBeCloseTo(0, 6);
    const early = mine(art, at, { ageMs: 500, lifeMs: 20_000 }, false).shapes;
    expect(lines(early)).toEqual([]);
    // With 2 s left the hint arc spans half a turn from 12 o'clock.
    const late = lines(mine(art, at, { ageMs: 18_000, lifeMs: 20_000 }, false).shapes);
    expect(late.length).toBeGreaterThan(0);
    expect(late[0]!.from.x).toBeCloseTo(0, 9);
    expect(late[0]!.from.y).toBeCloseTo(-11, 9);
    expect(late.at(-1)!.to.x).toBeCloseTo(0, 9);
    expect(late.at(-1)!.to.y).toBeCloseTo(11, 9);
  });

  it("fizzles over 200 ms and pops over 220 ms, then draws nothing", () => {
    const at = { x: 0, y: 0 };
    const fizzle = (ageMs: number, reduced = false) =>
      mine(art, at, { ageMs: 20_000, end: { ageMs, kind: "fizzle" }, lifeMs: 20_000 }, reduced);
    expect(fizzle(100).shapes.length).toBeGreaterThan(0);
    expect(fizzle(200).shapes).toEqual([]);
    expect(
      fizzle(100, true).shapes.every((shape) => (shape as { alpha: number }).alpha === 0.5),
    ).toBe(true);
    const pop = (ageMs: number, reduced = false) =>
      mine(art, at, { ageMs: 3000, end: { ageMs, kind: "pop" }, lifeMs: 20_000 }, reduced);
    const ring = pop(110).shapes.find(
      (shape) => shape.kind === "ellipse" && shape.stroke !== undefined,
    ) as { halfWidth: number };
    expect(ring.halfWidth).toBeCloseTo(16, 9);
    expect(pop(20).shapes.filter((shape) => shape.kind === "disc").length).toBe(8);
    expect(pop(220).shapes).toEqual([]);
    expect(pop(100, true).shapes).toHaveLength(2);
    expect(pop(200, true).shapes).toEqual([]);
  });
});

describe("charged lance", () => {
  const view = (ageMs: number, stopped = false) => ({
    ageMs,
    end: { x: 200, y: 0 },
    muzzle: { x: 0, y: 0 },
    stopped,
  });

  it("marches its tracking dashes outward at 60 px/s, still under reduced motion", () => {
    const at = (ms: number, reduced = false) =>
      lines(lance(art, view(ms), false, reduced).shapes)[0]!;
    expect(at(0).from.x).toBeCloseTo(0, 9);
    expect(at(0).to.x).toBeCloseTo(6, 9);
    // 100 ms marches 6 px: the first full dash starts at 6.
    expect(at(100).to.x).toBeCloseTo(2, 9);
    expect(at(100, true).to.x).toBeCloseTo(6, 9);
    expect(
      lines(lance(art, view(0), false, false).shapes).every((line) => line.colour === CORAL),
    ).toBe(true);
  });

  it("locks to a still pale-coral line with white pulses, none under reduced motion", () => {
    const locked = (ms: number, reduced = false) =>
      lines(lance(art, view(ms), false, reduced).shapes);
    expect(locked(800)).toHaveLength(1);
    expect(locked(800)[0]).toMatchObject({ colour: PLATE, width: 1.5 });
    expect(locked(730)[0]!.colour).toBe(WHITE);
    expect(locked(930)[0]!.colour).toBe(WHITE);
    expect(locked(730, true)[0]!.colour).toBe(PLATE);
  });

  it("fires its beam for 300 ms, fading at full length and sparking where it is stopped", () => {
    expect(beamAt(art.lance, 30)).toEqual({ a: 1, w: 1.2 });
    const beam = lance(art, view(1030), false, false).shapes;
    expect(beam.some((shape) => shape.kind === "taper")).toBe(true);
    // At full length every layer fades to alpha 0 over the last 28 px.
    const faded = beam.filter((shape) => shape.kind === "taper" && shape.head.alpha === 0);
    expect(faded).toHaveLength(3);
    for (const shape of faded) {
      expect(shape.kind === "taper" && shape.tail.at.x).toBeCloseTo(200 - 28, 9);
    }
    const stopped = lance(art, view(1030, true), false, false);
    expect(
      stopped.shapes.filter((shape) => shape.kind === "taper" && shape.head.alpha === 0),
    ).toEqual([]);
    expect(stopped.shapes.length).toBeGreaterThan(beam.length - faded.length);
    expect(lance(art, view(1300), false, false).shapes).toEqual([]);
  });

  it("turns its glow and outer bloom to ink on a light field", () => {
    const light = lance(art, view(1030), true, false).shapes;
    expect(light.filter((shape) => shape.colour === INK).length).toBeGreaterThan(0);
    const dark = lance(art, view(1030), false, false).shapes;
    expect(dark.filter((shape) => shape.colour === INK)).toEqual([]);
  });
});

describe("enemy Phaser", () => {
  const view = (ageMs: number, stopped = false) => ({
    ageMs,
    end: { x: 100, y: 0 },
    muzzle: { x: 0, y: 0 },
    stopped,
  });

  it("shows a still dashed aim line, solid pale coral for its last 100 ms, with an end tick", () => {
    const dashed = lines(enemyPhaser(art, view(100), false, false).shapes);
    expect(dashed.length).toBeGreaterThan(2);
    expect(dashed.at(-1)).toMatchObject({ colour: CORAL });
    expect(length(dashed.at(-1)!)).toBeCloseTo(5, 9);
    const solid = lines(enemyPhaser(art, view(350), false, false).shapes);
    expect(solid).toHaveLength(2);
    expect(solid[0]).toMatchObject({ colour: PLATE, width: 1 });
    expect(length(solid[0]!)).toBeCloseTo(100, 9);
  });

  it("fades a missing beam over its last 28 px and sparks a hit", () => {
    const miss = enemyPhaser(art, view(420), false, false).shapes;
    const faded = miss.filter((shape) => shape.kind === "taper" && shape.head.alpha === 0);
    expect(faded.length).toBe(3);
    const hit = enemyPhaser(art, view(420, true), false, false).shapes;
    expect(hit.filter((shape) => shape.kind === "taper" && shape.head.alpha === 0)).toEqual([]);
    expect(enemyPhaser(art, view(400 + 160), false, false).shapes).toEqual([]);
  });

  it("draws a steady reduced-motion beam that holds, then fades", () => {
    const at = (ms: number) =>
      enemyPhaser(art, view(400 + ms, true), false, true)
        .shapes.filter((shape): shape is TaperShape => shape.kind === "taper")
        .map((shape) => shape.tail.alpha);
    expect(at(50)).toEqual([0.35, 1]);
    expect(at(120)).toEqual([0.35 * 0.5, 0.5]);
  });
});

describe("light-field edges and dashes", () => {
  it("dashes a line 6 on 4 off, shifted by the march offset", () => {
    const stroke = { alpha: 1, colour: CORAL, width: 1 };
    const plain = dashes({ x: 0, y: 0 }, { x: 25, y: 0 }, 6, 4, 0, stroke);
    expect(plain.map(({ from, to }) => [from.x, to.x])).toEqual([
      [0, 6],
      [10, 16],
      [20, 25],
    ]);
    const marched = dashes({ x: 0, y: 0 }, { x: 25, y: 0 }, 6, 4, 3, stroke);
    expect(marched.map(({ from, to }) => [from.x, to.x])).toEqual([
      [3, 9],
      [13, 19],
      [23, 25],
    ]);
  });

  it("runs ink 1 px past each end of a stroke, 2 px wider, so a 6 px dash has an 8 px edge", () => {
    const [edge] = enemyInkEdges(art.colours.ink, art.lightField.edge, [
      {
        alpha: 0.5,
        colour: CORAL,
        from: { x: 0, y: 0 },
        kind: "line",
        round: false,
        to: { x: 6, y: 0 },
        width: 1,
      },
    ]) as [LineShape];
    expect(edge).toMatchObject({ alpha: 0.5, colour: INK, width: 3 });
    expect(edge.from.x).toBeCloseTo(-1, 9);
    expect(edge.to.x).toBeCloseTo(7, 9);
    expect(art.lightField.dash).toEqual([8, 2]);
  });
});

/** The art type stays exported for the scene. */
export type { EnemyWeaponsArt };
