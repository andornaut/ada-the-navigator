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
import {
  type EffectShape,
  IMPACT_STYLE,
  type LineShape,
  type PolygonShape,
} from "./weaponEffects.ts";

const art = readEnemyWeaponsArt(file)!;
const CORAL = 0xd68b72;
const PLATE = 0xe6a890;
const WHITE = 0xffffff;
const INK = 0x181425;
const lines = (shapes: readonly EffectShape[]) =>
  shapes.filter((shape): shape is LineShape => shape.kind === "line");
const length = ({ from, to }: LineShape) => Math.hypot(to.x - from.x, to.y - from.y);
const polygons = (shapes: readonly EffectShape[]) =>
  shapes.filter((shape): shape is PolygonShape => shape.kind === "polygon");
// A beam band tapering to a point over a miss's end has five corners; a butt end, four.
const tapered = (shapes: readonly EffectShape[]) =>
  polygons(shapes).filter(({ points }) => points.length === 5);

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
    reference.phaser.reducedMotion.line.colour = "teal";
    expect(readEnemyWeaponsArt(reference)).toBeUndefined();
    expect(readEnemyWeaponsArt(undefined)).toBeUndefined();
  });
});

describe("ring burst", () => {
  it("draws the spawn circle as a 2 px ground ellipse, alpha 1 to 90 ms then 0.5 to 180", () => {
    const at = { x: 10, y: 20 };
    const [ring] = ringEmission(art, at, 30, [], false, 89).shapes;
    expect(ring).toMatchObject({ alpha: 1, at, colour: CORAL, kind: "ellipse", stroke: 2 });
    expect((ring as { halfWidth: number }).halfWidth).toBeCloseTo(30 * Math.SQRT2, 9);
    expect((ring as { halfHeight: number }).halfHeight).toBeCloseTo(30 / Math.SQRT2, 9);
    expect(ringEmission(art, at, 30, [], false, 90).shapes[0]).toMatchObject({ alpha: 0.5 });
    expect(ringEmission(art, at, 30, [], false, 179).shapes[0]).toMatchObject({ alpha: 0.5 });
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

  it("draws a coralSide tail wedge, a coral dart and its white core along the heading", () => {
    const right = ringDart(art, { x: 0, y: 0 }, { x: 1, y: -1 });
    const [tail, body, core] = right.shapes as [PolygonShape, PolygonShape, PolygonShape];
    expect(tail).toMatchObject({ colour: 0xa8654f, kind: "polygon" });
    expect(body).toMatchObject({ colour: CORAL, kind: "polygon" });
    expect(core).toMatchObject({ colour: WHITE, kind: "polygon" });
    // Heading 14 projects to screen right: the nose points along +x and the tail ends at -10,
    // whatever the heading factor.
    expect(body.points[0]!.x).toBeCloseTo(2.6, 9);
    expect(body.points[1]!.y).toBeCloseTo(-2.3, 9);
    expect(core.points[0]!.x).toBeCloseTo(1, 9);
    expect(tail.points[1]!.x).toBeCloseTo(-10, 9);
    const down = ringDart(art, { x: 0, y: 0 }, { x: 1, y: 1 }).shapes[0] as PolygonShape;
    expect(down.points[1]!.y).toBeCloseTo(-10, 9);
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

  it("shows the frame for its spin step, held at 0 under reduced motion, and its hint late", () => {
    const at = { x: 0, y: 0 };
    const live = (ageMs: number, reduced = false) =>
      mine(art, at, { ageMs, lifeMs: 20_000 }, reduced);
    // 60 degrees a second: 500 ms is 30 degrees, spin step 2; 1500 ms is 90, a quarter turn.
    expect(live(500).solid).toEqual({ alpha: 1, blink: false, scale: 1, step: 2 });
    expect(live(1500).solid?.step).toBe(0);
    expect(live(1700).solid?.step).toBe(1);
    expect(live(500, true).solid).toEqual({ alpha: 1, blink: false, scale: 1, step: 0 });
    // Its lamp blinks from the blink set, never under reduced motion.
    expect(live(1050).solid?.blink).toBe(true);
    expect(live(1050, true).solid?.blink).toBe(false);
    expect(live(500).shapes).toEqual([]);
    // With 2 s left the hint arc spans half a turn from 12 o'clock.
    const late = lines(live(18_000).shapes);
    expect(late.length).toBeGreaterThan(0);
    expect(late[0]!.from.x).toBeCloseTo(0, 9);
    expect(late[0]!.from.y).toBeCloseTo(-11, 9);
    expect(late.at(-1)!.to.x).toBeCloseTo(0, 9);
    expect(late.at(-1)!.to.y).toBeCloseTo(11, 9);
    expect(live(18_000).edged).toEqual(late);
  });

  it("fizzles over 200 ms and pops over 220 ms, then draws nothing", () => {
    const at = { x: 0, y: 0 };
    const fizzle = (ageMs: number, reduced = false) =>
      mine(art, at, { ageMs: 20_000, end: { ageMs, kind: "fizzle" }, lifeMs: 20_000 }, reduced);
    // The frame shrinks by 1 - p^2 on its white lamp among four coral flecks.
    expect(fizzle(100).solid).toMatchObject({ alpha: 1, blink: true, scale: 0.75 });
    expect(fizzle(100).shapes).toHaveLength(4);
    expect(fizzle(100).shapes.every((shape) => shape.colour === CORAL)).toBe(true);
    expect(fizzle(200)).toEqual({ edged: [], shapes: [] });
    expect(fizzle(100, true)).toEqual({
      edged: [],
      shapes: [],
      solid: { alpha: 0.5, blink: false, scale: 1, step: 0 },
    });
    const pop = (ageMs: number, reduced = false) =>
      mine(art, at, { ageMs: 3000, end: { ageMs, kind: "pop" }, lifeMs: 20_000 }, reduced);
    const ring = pop(110).shapes.find(
      (shape) => shape.kind === "ellipse" && shape.stroke !== undefined,
    ) as { halfWidth: number };
    expect(ring.halfWidth).toBeCloseTo(IMPACT_STYLE.shockwave.radius * 0.6 * Math.SQRT2, 9);
    expect(pop(110).solid).toBeUndefined();
    expect(pop(20).shapes.filter((shape) => shape.kind === "disc")).toHaveLength(0);
    expect(pop(220).shapes).toEqual([]);
    // The ring and the cream ellipse; only the ring takes an ink edge.
    expect(pop(100, true).shapes).toHaveLength(2);
    expect(pop(100, true).edged).toHaveLength(1);
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

  it("fires opaque coral, plate and white bands for 300 ms, tapering at full length", () => {
    expect(beamAt(art.lance, 30)).toEqual({ a: 1, w: 1.2 });
    const beam = lance(art, view(1030), false, false).shapes;
    const bands = polygons(beam);
    expect(bands.map(({ colour }) => colour)).toEqual([CORAL, PLATE, WHITE]);
    expect(bands.every(({ alpha }) => alpha === 1)).toBe(true);
    // Coral 9 px times w at the nose, and opaque bloom discs 6.5, 4.2 and 2.3 times w.
    expect(bands[0]!.points[0]!.y).toBeCloseTo((-9 * 1.2) / 2, 9);
    const bloom = beam.flatMap((shape) => (shape.kind === "disc" ? [shape.radius] : []));
    expect(bloom).toEqual([6.5 * 1.2, 4.2 * 1.2, 2.3 * 1.2]);
    // At full length every band tapers to a point over the last 28 px.
    expect(tapered(beam)).toHaveLength(3);
    for (const band of tapered(beam)) {
      expect(band.points[1]!.x).toBeCloseTo(200 - 28, 9);
      expect(band.points[2]!.x).toBeCloseTo(200, 9);
    }
    const stopped = lance(art, view(1030, true), false, false);
    expect(tapered(stopped.shapes)).toEqual([]);
    expect(stopped.shapes.length).toBeGreaterThan(beam.length);
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

  it("shows a still 1.5 px dashed aim line, solid pale coral for its last 100 ms, and a chevron", () => {
    const aiming = enemyPhaser(art, view(100), false, false);
    const dashed = lines(aiming.shapes);
    expect(dashed.length).toBeGreaterThan(2);
    expect(dashed.every(({ colour, width }) => colour === CORAL && width === 1.5)).toBe(true);
    const [chevron] = polygons(aiming.shapes);
    expect(chevron).toMatchObject({ colour: CORAL });
    expect(chevron!.points.map(({ x, y }) => [x, y])).toEqual([
      [103, 0],
      [99, -3],
      [99, 3],
    ]);
    expect(aiming.edged).toContain(chevron);
    const solid = enemyPhaser(art, view(350), false, false);
    expect(lines(solid.shapes)).toHaveLength(1);
    expect(lines(solid.shapes)[0]).toMatchObject({ colour: PLATE, width: 1.5 });
    expect(length(lines(solid.shapes)[0]!)).toBeCloseTo(100, 9);
    expect(polygons(solid.shapes)[0]).toMatchObject({ colour: PLATE });
  });

  it("tapers a missing beam over its last 28 px and sparks a hit", () => {
    const miss = enemyPhaser(art, view(420), false, false).shapes;
    expect(tapered(miss)).toHaveLength(3);
    expect(polygons(miss).map(({ colour }) => colour)).toEqual([CORAL, PLATE, WHITE]);
    // Coral 8 to 5, plate 4.6 to 2.8 and white 2.2 to 1.3 times w.
    expect(polygons(miss)[1]!.points[0]!.y).toBeCloseTo(-2.3, 9);
    const hit = enemyPhaser(art, view(420, true), false, false).shapes;
    expect(tapered(hit)).toEqual([]);
    expect(hit.length).toBeGreaterThan(miss.length);
    expect(enemyPhaser(art, view(400 + 160), false, false).shapes).toEqual([]);
  });

  it("draws a steady reduced-motion beam that holds, then steps down", () => {
    const at = (ms: number) =>
      polygons(enemyPhaser(art, view(400 + ms, true), false, true).shapes).map(
        (shape) => shape.alpha,
      );
    expect(at(50)).toEqual([0.35, 1]);
    const late = at(120);
    expect(late[0]).toBeCloseTo(0.35 * 0.6, 9);
    expect(late[1]).toBe(0.6);
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
