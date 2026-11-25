import { describe, expect, it } from "vitest";

import { CORE_MANIFEST } from "../testing/publicArt.ts";
import {
  beam,
  BEAM_MISS_FADE,
  BEAM_MS,
  beamAlpha,
  beamKeys,
  blast,
  BLAST_SECONDS,
  burst,
  EFFECT_COLOURS,
  type EffectShape,
  fanBolt,
  fanVolley,
  headingFactor,
  heldAlpha,
  laserBolt,
  mineSolid,
  missileFlame,
  missileFrame,
  missileKind,
  missileSolid,
  pellet,
  type PolygonShape,
  readWeaponSolids,
  screenAngle,
  spark,
  SPARK_MS,
} from "./weaponEffects.ts";

// World directions of headings 14 (screen right), 2 (down) and 13 (between).
const heading = (index: number) => ({
  x: Math.cos((index * Math.PI) / 8),
  y: Math.sin((index * Math.PI) / 8),
});
const origin = { x: 0, y: 0 };
const ofKind = <K extends EffectShape["kind"]>(shapes: readonly EffectShape[], kind: K) =>
  shapes.filter((shape): shape is Extract<EffectShape, { kind: K }> => shape.kind === kind);
const xs = (shape: PolygonShape) => shape.points.map(({ x }) => x);
const reach = (shape: PolygonShape) =>
  Math.max(...shape.points.map(({ x, y }) => Math.hypot(x - origin.x, y - origin.y)));

describe("weapon effect conventions", () => {
  it.each([
    [14, 1],
    [6, 1],
    [13, 0.943],
    [12, 0.791],
    [11, 0.6],
    [10, 0.5],
    [2, 0.5],
  ])("gives heading %i the heading factor %f", (index, f) => {
    expect(headingFactor(heading(index))).toBeCloseTo(f, 3);
  });

  it("rotates each shot to its projected heading", () => {
    expect(screenAngle(heading(14))).toBeCloseTo(0, 9);
    expect(screenAngle(heading(2))).toBeCloseTo(Math.PI / 2, 9);
  });

  it("tells Rapid blasts from Heavy ones by radius", () => {
    expect(missileKind(30)).toBe("rapid");
    for (const radius of [60, 70]) {
      expect(missileKind(radius)).toBe("heavy");
    }
  });

  it("holds each alpha until its step ends, then the last", () => {
    const steps = [
      [10, 1],
      [20, 0.5],
    ] as const;
    expect([0, 9.9, 10, 19.9, 20, 99].map((t) => heldAlpha(t, steps, 0.2))).toEqual([
      1, 1, 0.5, 0.5, 0.2, 0.2,
    ]);
  });

  it("draws a burst's tips at its radius and its notches at the waist", () => {
    const star = burst(origin, 0, 4, 10, 0.3, EFFECT_COLOURS.amber, 1);
    expect(star.points).toHaveLength(8);
    const radii = star.points.map(({ x, y }) => Math.hypot(x, y));
    radii.forEach((radius, index) => expect(radius).toBeCloseTo(index % 2 ? 3 : 10, 9));
    expect(star.points[0]!.x).toBeCloseTo(10, 9);
  });
});

describe("bolt, pellet and fan", () => {
  it("draws the Laser bolt as a tail step, a pointed slug and a cream core behind its head", () => {
    const bolt = laserBolt(origin, 0);
    const [tail, slug, core] = bolt;
    expect(bolt.map(({ colour }) => colour)).toEqual([
      EFFECT_COLOURS.amber,
      EFFECT_COLOURS.amber,
      EFFECT_COLOURS.cream,
    ]);
    expect(Math.min(...xs(tail!))).toBeCloseTo(-27, 9);
    expect(Math.max(...xs(tail!))).toBeCloseTo(-14, 9);
    expect(Math.max(...tail!.points.map(({ y }) => y))).toBeCloseTo(0.75, 9);
    expect(slug!.points[0]).toEqual({ x: 0, y: 0 });
    expect(Math.min(...xs(slug!))).toBeCloseTo(-15.5, 9);
    expect(Math.max(...slug!.points.map(({ y }) => y))).toBeCloseTo(1.5, 9);
    expect(Math.min(...xs(core!))).toBeCloseTo(-8.68, 9);
    // Turned to its heading: straight down points the slug's tail up.
    expect(laserBolt(origin, Math.PI / 2)[1]!.points[3]!.y).toBeCloseTo(-15.5, 9);
    expect(laserBolt(origin, 0, 0.4).every(({ alpha }) => alpha === 0.4)).toBe(true);
  });

  it("lights the pellet with a small cream disc up and left of its centre", () => {
    const [body, light] = pellet({ x: 10, y: 10 });
    expect(body).toEqual({
      alpha: 1,
      at: { x: 10, y: 10 },
      colour: EFFECT_COLOURS.amber,
      kind: "disc",
      radius: 1.7,
    });
    expect(light).toMatchObject({ colour: EFFECT_COLOURS.cream, radius: 0.7 });
    expect(light!.at.x).toBeCloseTo(9.55, 9);
    expect(light!.at.y).toBeCloseTo(9.55, 9);
  });

  it("draws a close fan as one amber band through its heads over a cream band", () => {
    const polar = (degrees: number, radius: number) => ({
      x: radius * Math.cos((degrees * Math.PI) / 180),
      y: radius * Math.sin((degrees * Math.PI) / 180),
    });
    // Out of order across the fan: the band still runs from the clockwise head to the other.
    const heads = [0, -4, 4].map((degrees) => ({ at: polar(degrees, 20), velocity: heading(14) }));
    const shapes = fanVolley(origin, heads);
    expect(shapes.map(({ colour }) => colour)).toEqual([
      EFFECT_COLOURS.amber,
      EFFECT_COLOURS.cream,
    ]);
    const [amber, cream] = shapes as [PolygonShape, PolygonShape];
    const angle = ({ x, y }: { x: number; y: number }) => (Math.atan2(y, x) * 180) / Math.PI;
    // The outer edge lies on the heads; the end heads move 1.1 px outward.
    expect(amber.points).toHaveLength(6);
    expect(amber.points[1]!.x).toBeCloseTo(20, 9);
    expect(amber.points[1]!.y).toBeCloseTo(0, 9);
    const first = polar(-4, 20);
    expect(Math.hypot(amber.points[0]!.x - first.x, amber.points[0]!.y - first.y)).toBeCloseTo(
      1.1,
      9,
    );
    expect(angle(amber.points[0]!)).toBeLessThan(-4);
    expect(angle(amber.points[2]!)).toBeGreaterThan(4);
    // It runs back to h - 11 along each head's ray.
    expect(Math.hypot(amber.points[4]!.x, amber.points[4]!.y)).toBeCloseTo(9, 9);
    // Cream from h - 2.5 back to the amber's inner edge plus 4, on the outer bolts' rays.
    const creamRadii = cream.points.map(({ x, y }) => Math.hypot(x, y));
    [17.5, 17.5, 17.5, 13, 13, 13].forEach((radius, index) =>
      expect(creamRadii[index]).toBeCloseTo(radius, 9),
    );
    expect(angle(cream.points[0]!)).toBeCloseTo(-4, 9);
  });

  it("measures neighbouring heads apart on screen, under 5.6 px for the band", () => {
    const row = (gap: number) =>
      [-1, 0, 1].map((index) => ({ at: { x: 100, y: index * gap }, velocity: heading(14) }));
    expect(fanVolley(origin, row(5.5)).map(({ colour }) => colour)).toEqual([
      EFFECT_COLOURS.amber,
      EFFECT_COLOURS.cream,
    ]);
    const far = fanVolley(origin, row(5.7));
    expect(far).toHaveLength(3);
    expect(far[1]).toEqual(fanBolt({ x: 100, y: 0 }, screenAngle(heading(14))));
  });

  it("draws slugs 10 px long and 2.2 px wide for a lone bolt or heads at the nose", () => {
    const slug = fanBolt(origin, 0);
    expect(slug.colour).toBe(EFFECT_COLOURS.amber);
    expect(slug.points[2]!.x).toBeCloseTo(-10, 9);
    expect(Math.max(...slug.points.map(({ y }) => y))).toBeCloseTo(1.1, 9);
    const lone = [{ at: { x: 30, y: 0 }, velocity: heading(14) }];
    expect(fanVolley(origin, lone)).toEqual([fanBolt({ x: 30, y: 0 }, screenAngle(heading(14)))]);
    const start = [0, 1].map((index) => ({ at: { x: 3, y: index }, velocity: heading(14) }));
    expect(fanVolley(origin, start)).toHaveLength(2);
    expect(fanVolley(origin, [])).toEqual([]);
  });
});

describe("missiles", () => {
  it("flicker between two frames, 50 ms for Rapid and 90 ms for Heavy, held at 0 when reduced", () => {
    expect([0, 49, 50, 99, 100].map((ms) => missileFrame("rapid", false, ms))).toEqual([
      0, 0, 1, 1, 0,
    ]);
    expect([0, 89, 90, 180].map((ms) => missileFrame("heavy", false, ms))).toEqual([0, 0, 1, 0]);
    expect([50, 90, 150].map((ms) => missileFrame("heavy", true, ms))).toEqual([0, 0, 0]);
    expect(missileFrame("rapid", true, 50)).toBe(0);
  });

  it("draws the Rapid flame 12 then 15 f px behind its 7 px tail, cream half as wide and long", () => {
    const [amber, cream] = missileFlame("rapid", origin, heading(14), 0);
    expect(amber!.colour).toBe(EFFECT_COLOURS.amber);
    expect(xs(amber!)[0]).toBeCloseTo(-7, 9);
    expect(Math.min(...xs(amber!))).toBeCloseTo(-19, 9);
    expect(Math.min(...xs(cream!))).toBeCloseTo(-13, 9);
    expect(amber!.points[2]!.y - amber!.points[0]!.y).toBeCloseTo(2.6, 9);
    expect(cream!.points[2]!.y - cream!.points[0]!.y).toBeCloseTo(1.3, 9);
    expect(Math.min(...xs(missileFlame("rapid", origin, heading(14), 1)[0]!))).toBeCloseTo(-22, 9);
    // Heading 2 halves the flame and keeps the tail where the frame ends.
    const down = missileFlame("rapid", origin, heading(2), 0)[0]!;
    expect(Math.min(...down.points.map(({ y }) => y))).toBeCloseTo(-13, 9);
  });

  it("draws the Heavy flame 16.8 then 11.8 f px behind its 13.2 px tail, 5.6 px across", () => {
    const [amber] = missileFlame("heavy", origin, heading(14), 0);
    expect(Math.min(...xs(amber!))).toBeCloseTo(-30, 9);
    expect(amber!.points[2]!.y - amber!.points[0]!.y).toBeCloseTo(5.6, 9);
    expect(Math.min(...xs(missileFlame("heavy", origin, heading(14), 1)[0]!))).toBeCloseTo(-25, 9);
  });

  it("reads every heading and spin frame from the core manifest", () => {
    const solids = readWeaponSolids(CORE_MANIFEST.assets)!;
    expect(solids.rapid).toMatchObject({ height: 24.5, pivot: { x: 0.5, y: 0.5 }, width: 24.5 });
    expect(solids.heavy).toMatchObject({ height: 42, width: 42 });
    expect(solids.mine).toMatchObject({ height: 21, width: 21 });
    expect(solids.rapid.ids).toEqual(
      Array.from({ length: 32 }, (_, k) => `weapon-rapidMissile-${k}`),
    );
    expect(solids.heavy.ids[31]).toBe("weapon-heavyMissile-31");
    expect(solids.mine.ids).toEqual(Array.from({ length: 8 }, (_, j) => `weapon-mine-${j}`));
    expect(solids.mine.blink[7]).toBe("weapon-mine-blink-7");
  });

  it("reads no frames when any heading or spin step is missing", () => {
    const assets = CORE_MANIFEST.assets;
    expect(readWeaponSolids(assets.filter(({ id }) => id !== "weapon-heavyMissile-9"))).toBe(
      undefined,
    );
    expect(readWeaponSolids(assets.filter(({ id }) => id !== "weapon-mine-blink-3"))).toBe(
      undefined,
    );
    // The last frame alone may go: the count follows the rows, but the blink set must match.
    expect(readWeaponSolids(assets.filter(({ id }) => id !== "weapon-mine-blink-7"))).toBe(
      undefined,
    );
    const resized = assets.map((asset) =>
      asset.id === "weapon-rapidMissile-4" ? { ...asset, displayWidth: 30 } : asset,
    );
    expect(readWeaponSolids(resized)).toBeUndefined();
    expect(readWeaponSolids([])).toBeUndefined();
  });

  it("picks the frame for the nearest of 32 world headings", () => {
    const solids = readWeaponSolids(CORE_MANIFEST.assets)!;
    const at = (k: number) => ({
      x: Math.cos((k * Math.PI) / 16) * 400,
      y: Math.sin((k * Math.PI) / 16) * 400,
    });
    expect(missileSolid(solids, "rapid", at(0))).toBe("weapon-rapidMissile-0");
    expect(missileSolid(solids, "heavy", at(28))).toBe("weapon-heavyMissile-28");
    expect(missileSolid(solids, "rapid", at(-1))).toBe("weapon-rapidMissile-31");
    expect(missileSolid(solids, "rapid", at(4.4))).toBe("weapon-rapidMissile-4");
  });

  it("wraps the mine's spin step by its frame count, from the blink set while it blinks", () => {
    const solids = readWeaponSolids(CORE_MANIFEST.assets)!;
    expect([0, 1, 7, 8, 9, 32].map((step) => mineSolid(solids, step, false))).toEqual(
      [0, 1, 7, 0, 1, 0].map((j) => `weapon-mine-${j}`),
    );
    expect(mineSolid(solids, 10, true)).toBe("weapon-mine-blink-2");
  });
});

describe("missile blasts", () => {
  it("lasts 340 ms, its longest effect", () => {
    expect(BLAST_SECONDS).toBe(0.34);
  });

  it("grows an amber ring by an ease-out cubic in held alpha steps, thinning from 4 to 2 px", () => {
    const ring = (t: number) =>
      ofKind(blast(origin, 60, false, t), "ellipse").find(({ part }) => part === "ring")!;
    expect(ring(0)).toMatchObject({ alpha: 1, colour: EFFECT_COLOURS.amber, stroke: 4 });
    expect(ring(90).halfWidth).toBeCloseTo(60 * (1 - 0.5 ** 3), 9);
    expect(ring(180)).toMatchObject({ alpha: 0.66, halfHeight: 60, halfWidth: 60 });
    expect(ring(179).alpha).toBe(1);
    expect(ring(260).alpha).toBe(0.33);
    expect(ring(170).stroke).toBeCloseTo(3, 9);
    expect(blast(origin, 60, false, 340)).toEqual([]);
    // No tint fills the circle.
    expect(
      ofKind(blast(origin, 60, false, 100), "ellipse").filter(({ stroke }) => stroke === undefined),
    ).toEqual([]);
  });

  it("draws a 1.2 px cream line inside the ring once it passes 6 px", () => {
    const lines = (t: number) =>
      ofKind(blast(origin, 60, false, t), "ellipse").filter(({ part }) => part !== "ring");
    expect(lines(0)).toEqual([]);
    const [line] = lines(100);
    const r = 60 * (1 - (1 - 100 / 180) ** 3);
    expect(line).toMatchObject({ colour: EFFECT_COLOURS.cream, stroke: 1.2 });
    expect(line!.halfWidth).toBeCloseTo(r - 2.2, 9);
  });

  it("throws eight cream debris wedges past the ring, alpha 1 to 108 ms and 0.6 to 220 ms", () => {
    const debris = (t: number) =>
      ofKind(blast(origin, 60, false, t), "polygon").filter(({ part }) => part === undefined);
    expect(debris(100)).toHaveLength(8);
    const r = 60 * (1 - (1 - 100 / 180) ** 3);
    for (const wedge of debris(100)) {
      expect(wedge.colour).toBe(EFFECT_COLOURS.cream);
      expect(reach(wedge)).toBeCloseTo(r + 10, 9);
    }
    const first = debris(100)[0]!.points[1]!;
    expect((Math.atan2(first.y, first.x) * 180) / Math.PI).toBeCloseTo(22.5, 9);
    expect(debris(107)[0]!.alpha).toBe(1);
    expect(debris(108)[0]!.alpha).toBe(0.6);
    expect(debris(220)).toEqual([]);
  });

  it("flashes amber and cream eight-point bursts over a white core, then a 0.55 step", () => {
    const flash = (t: number) =>
      ofKind(blast(origin, 60, false, t), "polygon").filter(({ part }) => part === "flash");
    const [amber, cream] = flash(0);
    expect(amber!.points).toHaveLength(16);
    expect(reach(amber!)).toBeCloseTo(60 * 0.425, 9);
    expect(Math.hypot(amber!.points[1]!.x, amber!.points[1]!.y)).toBeCloseTo(60 * 0.425 * 0.62, 9);
    expect(reach(cream!)).toBeCloseTo(60 * 0.425 * 0.66, 9);
    expect(Math.atan2(cream!.points[0]!.y, cream!.points[0]!.x)).toBeCloseTo(Math.PI / 8, 9);
    const [core] = ofKind(blast(origin, 60, false, 0), "disc");
    expect(core).toMatchObject({ alpha: 1, at: origin, colour: EFFECT_COLOURS.white });
    expect(core!.radius).toBeCloseTo(60 * 0.425 * 0.3, 9);
    expect(reach(flash(30)[0]!)).toBeCloseTo(60 * 0.425 * 0.55, 9);
    expect(flash(60)).toEqual([]);
  });

  it("holds a still ring at R under reduced motion in the same alpha steps", () => {
    expect(blast(origin, 30, true, 0)).toEqual([
      {
        alpha: 1,
        at: origin,
        colour: EFFECT_COLOURS.amber,
        halfHeight: 30,
        halfWidth: 30,
        kind: "ellipse",
        part: "ring",
        stroke: 3,
      },
    ]);
    expect(blast(origin, 60, true, 200)[0]).toMatchObject({ alpha: 0.66, halfWidth: 60 });
    expect(blast(origin, 60, true, 299)[0]).toMatchObject({ alpha: 0.33 });
    expect(blast(origin, 60, true, 300)).toEqual([]);
  });
});

describe("the Phaser beam", () => {
  it("retains the 150 ms beam and 160 ms spark lifetimes", () => {
    expect(BEAM_MS).toBe(150);
    expect(SPARK_MS).toBe(160);
    expect(beam(origin, { x: 100, y: 0 }, true, false, 149).length).toBeGreaterThan(0);
    expect(beam(origin, { x: 100, y: 0 }, true, false, 150)).toEqual([]);
    expect(spark(origin, 0, false, 159).length).toBeGreaterThan(0);
    expect(spark(origin, 0, false, 160)).toEqual([]);
  });

  it("keys its width and alpha over 150 ms and holds one band alpha in three steps", () => {
    expect(beamKeys(0)).toEqual({ a: 0.85, w: 0.55 });
    expect(beamKeys(20)).toEqual({ a: 1, w: 1 });
    expect(beamKeys(70)).toEqual({ a: 1, w: 1 });
    const fading = beamKeys(110);
    expect(fading.a).toBeCloseTo(0.5, 9);
    expect(fading.w).toBeCloseTo(0.7, 9);
    expect([1, 0.61, 0.6, 0.31, 0.3, 0.01].map(beamAlpha)).toEqual([1, 1, 0.6, 0.6, 0.3, 0.3]);
  });

  it("draws opaque amber, cream and white bands with butt ends and an opaque bloom", () => {
    const hit = beam(origin, { x: 100, y: 0 }, true, false, 30);
    const bands = ofKind(hit, "polygon");
    expect(bands.map(({ colour }) => colour)).toEqual([
      EFFECT_COLOURS.amber,
      EFFECT_COLOURS.cream,
      EFFECT_COLOURS.white,
    ]);
    expect(bands.every(({ alpha }) => alpha === 1)).toBe(true);
    // Butt ends: four corners, widths 8 to 5, 4.6 to 2.8 and 2.2 to 1.3 at w 1.
    const corners = [
      [0, -4],
      [100, -2.5],
      [100, 2.5],
      [0, 4],
    ];
    expect(bands[0]!.points).toHaveLength(4);
    bands[0]!.points.forEach(({ x, y }, index) => {
      expect(x).toBeCloseTo(corners[index]![0]!, 9);
      expect(y).toBeCloseTo(corners[index]![1]!, 9);
    });
    expect(bands[1]!.points[0]!.y).toBeCloseTo(-2.3, 9);
    expect(bands[2]!.points[1]!.y).toBeCloseTo(-0.65, 9);
    expect(ofKind(hit, "disc").map(({ alpha, radius }) => [radius, alpha])).toEqual([
      [5, 1],
      [3.1, 1],
      [1.6, 1],
    ]);
    // Late in the flash every band and disc drops to the same held alpha.
    const late = beam(origin, { x: 100, y: 0 }, true, false, 140);
    expect(new Set(late.map((shape) => (shape as { alpha: number }).alpha))).toEqual(
      new Set([0.3]),
    );
  });

  it("tapers every band of a miss to a point over its last 28 px", () => {
    const miss = ofKind(beam(origin, { x: 453, y: 0 }, false, false, 30), "polygon");
    for (const band of miss) {
      expect(band.points).toHaveLength(5);
      expect(band.points[1]!.x).toBeCloseTo(453 - BEAM_MISS_FADE, 9);
      expect(band.points[2]!.x).toBeCloseTo(453, 9);
      expect(band.points[2]!.y).toBeCloseTo(0, 9);
    }
  });

  it("draws a steady 6 px cream line over a 12 px amber edge under reduced motion", () => {
    const steady = ofKind(beam(origin, { x: 100, y: 0 }, true, true, 60), "polygon");
    expect(
      steady.map(({ alpha, colour, points }) => [colour, points[3]!.y - points[0]!.y, alpha]),
    ).toEqual([
      [EFFECT_COLOURS.amber, 12, 0.35],
      [EFFECT_COLOURS.cream, 6, 1],
    ]);
    expect(ofKind(beam(origin, { x: 100, y: 0 }, true, true, 130), "polygon")[1]!.alpha).toBe(0.6);
    const miss = ofKind(beam(origin, { x: 100, y: 0 }, false, true, 60), "polygon");
    expect(miss[1]!.points).toHaveLength(5);
  });
});

describe("the hit spark", () => {
  it("plays six ray wedges, a core and three fleck diamonds over 160 ms, turned by the hit", () => {
    const start = spark(origin, 0, false, 0);
    const rays = ofKind(start, "polygon");
    expect(rays).toHaveLength(6);
    expect(rays[0]!.colour).toBe(EFFECT_COLOURS.white);
    // A wedge 2.6 wide at 1.5 px with its tip at 8.5 px along 30 degrees.
    expect(rays[0]!.points[1]!.x).toBeCloseTo(8.5 * Math.cos(Math.PI / 6), 9);
    expect(rays[0]!.points[1]!.y).toBeCloseTo(8.5 * Math.sin(Math.PI / 6), 9);
    const base = rays[0]!.points;
    expect(Math.hypot(base[2]!.x - base[0]!.x, base[2]!.y - base[0]!.y)).toBeCloseTo(2.6, 9);
    expect(ofKind(start, "disc")).toEqual([expect.objectContaining({ radius: 3.5 })]);
    const later = spark(origin, 0, false, 0.4 * 160);
    expect(ofKind(later, "polygon")[0]).toMatchObject({ alpha: 0.6, colour: EFFECT_COLOURS.cream });
    const flecks = ofKind(later, "polygon").filter(({ colour }) => colour === EFFECT_COLOURS.amber);
    expect(flecks).toHaveLength(3);
    expect(flecks.every(({ alpha }) => alpha === 1)).toBe(true);
    expect(ofKind(spark(origin, 0, false, 0.7 * 160), "polygon")).toHaveLength(3);
    expect(ofKind(spark(origin, 0, false, 0.7 * 160), "polygon")[0]!.alpha).toBe(0.5);
    const turned = ofKind(spark(origin, Math.PI / 2, false, 0), "polygon")[0]!.points[1]!;
    const unturned = rays[0]!.points[1]!;
    expect(turned.x).toBeCloseTo(-unturned.y, 9);
    expect(turned.y).toBeCloseTo(unturned.x, 9);
    expect(spark(origin, 0, false, 160)).toEqual([]);
  });

  it("becomes an unrotated cream ring under reduced motion", () => {
    expect(spark(origin, 1, true, 80)).toEqual([
      expect.objectContaining({ alpha: 0.5, halfWidth: 3, kind: "ellipse", stroke: 1.5 }),
    ]);
  });
});
