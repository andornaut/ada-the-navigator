import { describe, expect, it } from "vitest";

import {
  beam,
  BEAM_MISS_FADE,
  BEAM_MS,
  beamKeys,
  blast,
  BLAST_SECONDS,
  EFFECT_COLOURS,
  type EffectShape,
  headingFactor,
  heavyMissile,
  missileFrame,
  missileKind,
  rapidMissile,
  screenAngle,
  spark,
  SPARK_MS,
  type TaperShape,
} from "./weaponEffects.ts";

// World directions of headings 14 (screen right), 2 (down) and 13 (between).
const heading = (index: number) => ({
  x: Math.cos((index * Math.PI) / 8),
  y: Math.sin((index * Math.PI) / 8),
});
const origin = { x: 0, y: 0 };
const ofKind = <K extends EffectShape["kind"]>(shapes: readonly EffectShape[], kind: K) =>
  shapes.filter((shape): shape is Extract<EffectShape, { kind: K }> => shape.kind === kind);

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
    expect(missileKind(25)).toBe("rapid");
    for (const radius of [70]) {
      expect(missileKind(radius)).toBe("heavy");
    }
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

  it("draws the Rapid streak 20 then 23 times f past the body, then core, fins and body", () => {
    const right = rapidMissile(origin, heading(14), 0);
    expect(right.map(({ kind }) => kind)).toEqual([
      "taper",
      "taper",
      "polygon",
      "polygon",
      "polygon",
    ]);
    const streak = right[0] as TaperShape;
    expect(streak.tail.at.x).toBeCloseTo(-26, 9);
    expect(streak.head).toMatchObject({ alpha: 0.85, width: 1.6 });
    expect((rapidMissile(origin, heading(14), 1)[0] as TaperShape).tail.at.x).toBeCloseTo(-29, 9);
    // Heading 2 halves the trail; the body keeps its screen size.
    const down = rapidMissile(origin, heading(2), 0);
    expect((down[0] as TaperShape).tail.at.y).toBeCloseTo(-16, 9);
    expect(ofKind(down, "polygon")[2]!.points[2]!.y).toBeCloseTo(-7, 9);
    expect(ofKind(right, "polygon")[2]!.colour).toBe(EFFECT_COLOURS.white);
  });

  it("draws the Heavy plume 30 then 25 px long at heading 14 over an ink keyline", () => {
    const frame0 = heavyMissile(origin, heading(14), 0);
    expect((frame0[0] as TaperShape).tail.at.x).toBeCloseTo(-30, 9);
    expect((heavyMissile(origin, heading(14), 1)[0] as TaperShape).tail.at.x).toBeCloseTo(-25, 9);
    expect(ofKind(frame0, "polygon").map(({ colour }) => colour)).toEqual([
      EFFECT_COLOURS.ink,
      EFFECT_COLOURS.ink,
      EFFECT_COLOURS.ink,
      EFFECT_COLOURS.cream,
      EFFECT_COLOURS.cream,
      EFFECT_COLOURS.white,
      EFFECT_COLOURS.amber,
      EFFECT_COLOURS.cream,
    ]);
  });
});

describe("missile blasts", () => {
  it("lasts as long as the Heavy blast, its longest effect", () => {
    expect(BLAST_SECONDS).toBe(0.34);
  });

  it("grows the ring by an ease-out cubic and draws one flash in two steps", () => {
    const at0 = blast(origin, 25, false, 0);
    const ellipses = ofKind(at0, "ellipse");
    // Tint and ring at 0.5, then the flash's four ellipses of radius 25 x 0.42.
    const flash = ellipses.slice(2);
    expect(flash).toHaveLength(4);
    expect(flash[1]!.halfWidth).toBeCloseTo(25 * 0.42 * Math.SQRT2, 9);
    expect(flash[1]!.alpha).toBeCloseTo(0.85 * 0.95, 9);
    const step2 = ofKind(blast(origin, 25, false, 20), "ellipse");
    expect(step2.at(-3)!.halfWidth).toBeCloseTo(25 * 0.42 * 0.55 * Math.SQRT2, 9);
    expect(ofKind(blast(origin, 25, false, 40), "ellipse")).toHaveLength(3);
    // The ring reaches R at G and fades to 0 at T.
    const grown = ofKind(blast(origin, 25, false, 110), "ellipse")[1]!;
    expect(grown.halfWidth).toBeCloseTo(25 * Math.SQRT2, 9);
    expect(grown.halfHeight).toBeCloseTo(25 * Math.SQRT1_2, 9);
    expect(grown.alpha).toBe(1);
    expect(ofKind(blast(origin, 25, false, 165), "ellipse")[1]!.alpha).toBeCloseTo(0.5, 9);
    expect(blast(origin, 25, false, 220)).toEqual([]);
  });

  it("throws eight cream debris lines from a Heavy blast until G + 40", () => {
    expect(ofKind(blast(origin, 60, false, 100), "line")).toHaveLength(8);
    expect(ofKind(blast(origin, 60, false, 220), "line")).toHaveLength(0);
    expect(ofKind(blast(origin, 25, false, 50), "line")).toHaveLength(0);
    expect(ofKind(blast(origin, 85, false, 0), "ellipse")[2]!.halfWidth).toBeCloseTo(
      85 * 0.34 * 1.25 * Math.SQRT2,
      9,
    );
  });

  it("draws a static fading ring and tint at R under reduced motion, with no flash", () => {
    const rapid = blast(origin, 25, true, 0);
    expect(rapid).toEqual([
      expect.objectContaining({ alpha: 0.15, halfWidth: 25 * Math.SQRT2, kind: "ellipse" }),
      expect.objectContaining({ alpha: 0.9, kind: "ellipse", stroke: 2 }),
    ]);
    expect(ofKind(blast(origin, 60, true, 150), "ellipse")[1]).toMatchObject({ stroke: 3 });
    expect(ofKind(blast(origin, 60, true, 150), "ellipse")[1]!.alpha).toBeCloseTo(0.45, 9);
    expect(blast(origin, 25, true, 200)).toEqual([]);
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

  it("keys its width and alpha over 150 ms", () => {
    expect(beamKeys(0)).toEqual({ a: 0.85, w: 0.55 });
    expect(beamKeys(20)).toEqual({ a: 1, w: 1 });
    expect(beamKeys(70)).toEqual({ a: 1, w: 1 });
    const fading = beamKeys(110);
    expect(fading.a).toBeCloseTo(0.5, 9);
    expect(fading.w).toBeCloseTo(0.7, 9);
    expect(beam(origin, { x: 100, y: 0 }, true, false, 150)).toEqual([]);
  });

  it("tapers glow, body and core from the nose and fades a miss over its last 28 px", () => {
    const miss = beam(origin, { x: 453, y: 0 }, false, false, 30);
    const tapers = ofKind(miss, "taper");
    expect(tapers).toHaveLength(6);
    const [glowSolid, glowFade] = tapers;
    expect(glowSolid!.tail.width).toBeCloseTo(8, 9);
    expect(glowSolid!.head.at.x).toBeCloseTo(453 - BEAM_MISS_FADE, 9);
    expect(glowFade!.head).toMatchObject({ alpha: 0 });
    expect(glowFade!.head.width).toBeCloseTo(5, 9);
    expect(glowSolid!.tail.alpha).toBeCloseTo(0.38, 9);
    // The muzzle bloom over the nose.
    expect(
      ofKind(miss, "disc")
        .slice(-3)
        .map(({ radius }) => radius),
    ).toEqual([5, 2.9, 1.6]);
  });

  it("ends a hit hard at the contact with a round cap", () => {
    const hit = beam(origin, { x: 100, y: 0 }, true, false, 30);
    const tapers = ofKind(hit, "taper");
    expect(tapers).toHaveLength(3);
    expect(tapers.every(({ head }) => head.at.x === 100 && head.alpha > 0)).toBe(true);
  });

  it("draws a steady 2 px cream line over a 4 px amber edge under reduced motion", () => {
    const steady = ofKind(beam(origin, { x: 100, y: 0 }, true, true, 60), "taper");
    expect(steady.map(({ colour, tail }) => [colour, tail.width, tail.alpha])).toEqual([
      [EFFECT_COLOURS.amber, 4, 0.35],
      [EFFECT_COLOURS.cream, 2, 1],
    ]);
    expect(
      ofKind(beam(origin, { x: 100, y: 0 }, true, true, 120), "taper")[1]!.tail.alpha,
    ).toBeCloseTo(0.5, 9);
    expect(ofKind(beam(origin, { x: 100, y: 0 }, false, true, 60), "taper")).toHaveLength(4);
  });
});

describe("the hit spark", () => {
  it("plays rays, core and flecks over 160 ms, rotated by the beam", () => {
    const start = spark(origin, 0, false, 0);
    expect(ofKind(start, "line")).toHaveLength(6);
    expect(ofKind(start, "line")[0]!.colour).toBe(EFFECT_COLOURS.white);
    expect(ofKind(start, "disc")).toEqual([expect.objectContaining({ radius: 3.5 })]);
    const later = spark(origin, 0, false, 0.3 * 160);
    expect(ofKind(later, "line")[0]!.colour).toBe(EFFECT_COLOURS.cream);
    expect(ofKind(later, "disc").filter(({ radius }) => radius === 1.1)).toHaveLength(3);
    expect(ofKind(spark(origin, 0, false, 0.7 * 160), "line")).toHaveLength(0);
    const turned = ofKind(spark(origin, Math.PI / 2, false, 0), "line")[0]!;
    const unturned = ofKind(start, "line")[0]!;
    expect(turned.to.x).toBeCloseTo(-unturned.to.y, 9);
    expect(turned.to.y).toBeCloseTo(unturned.to.x, 9);
    expect(spark(origin, 0, false, 160)).toEqual([]);
  });

  it("becomes an unrotated cream ring under reduced motion", () => {
    expect(spark(origin, 1, true, 80)).toEqual([
      expect.objectContaining({ alpha: 0.5, halfWidth: 3, kind: "ellipse", stroke: 1.5 }),
    ]);
  });
});
