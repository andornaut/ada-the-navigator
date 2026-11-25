import { describe, expect, it } from "vitest";

import file from "../../public/art/enemy-weapons.json";
import { impactFamily, type WeaponImpact } from "../model/weaponImpacts.ts";
import { readEnemyWeaponsArt } from "./enemyWeaponsArt.ts";
import { EFFECT_COLOURS, IMPACT_STYLE, impactEffect, SPARK_MS } from "./weaponEffects.ts";

const { ripple } = readEnemyWeaponsArt(file)!;
const context = { at: { x: 100, y: 60 }, reducedMotion: false, ripple };
const contact: WeaponImpact = { age: 0, family: "compact", id: "contact", x: 0, y: 0 };

const playerPhaser = (ms: number, reducedMotion = false) =>
  impactEffect(
    { ...context, reducedMotion },
    { ...contact, age: ms / 1000, direction: { x: 1, y: -1 }, family: "phaserRings" },
  );

describe("weapon impact families", () => {
  it("maps source weapons explicitly, including shared missile and laser families", () => {
    expect(impactFamily("rapidMissile")).toBe(impactFamily("heavyMissile"));
    expect(impactFamily("laser")).toBe(impactFamily("multiLaser"));
    expect(impactFamily("phaser")).toBe("compactBright");
    expect(impactFamily("scattershot")).toBe("pellet");
    expect(impactFamily("chargedLance")).toBe("lance");
    expect(impactFamily("ringBurst")).toBe("ripple");
    expect(impactFamily("mineLayer")).toBe("shockwave");
  });

  it("uses the same missile recipe at any radius and scales the envelope from the event", () => {
    const render = (radius: number) =>
      impactEffect(context, { ...contact, age: 0.18, blastRadius: radius, family: "missile" });
    const small = render(30);
    const large = render(60);
    expect(small.map((shape) => shape.kind)).toEqual(large.map((shape) => shape.kind));
    const ring = (shapes: ReturnType<typeof render>) =>
      shapes.find((shape) => shape.kind === "ellipse" && shape.part === "ring");
    // Each blast is a circle on screen of the event's radius.
    expect(ring(small)).toMatchObject({ halfHeight: 30, halfWidth: 30 });
    expect(ring(large)).toMatchObject({ halfHeight: 60, halfWidth: 60 });
    expect(impactEffect(context, { ...contact, family: "missile" })).toEqual([]);
  });

  it("keeps enemy Phaser brighter and longer than compact hits, with pellets ending first", () => {
    const compact = impactEffect(context, contact);
    const bright = impactEffect(context, { ...contact, family: "compactBright" });
    expect(compact[0]).toHaveProperty("alpha", 0.8);
    expect(bright[0]).toHaveProperty("alpha", 1);
    const age = (SPARK_MS * 0.6) / 1000;
    expect(impactEffect(context, { ...contact, age, family: "pellet" })).toEqual([]);
    expect(impactEffect(context, { ...contact, age })).not.toEqual([]);
    expect(impactEffect(context, { ...contact, age: (SPARK_MS * 0.9) / 1000 })).toEqual([]);
    expect(
      impactEffect(context, { ...contact, age: (SPARK_MS * 0.9) / 1000, family: "compactBright" }),
    ).not.toEqual([]);
  });

  it("grows one cream Phaser contact ring in held alpha steps over a young burst and core", () => {
    const { amber, cream, white } = EFFECT_COLOURS;
    const [ring, star, core] = playerPhaser(0);
    expect(ring).toEqual({
      alpha: 1,
      at: context.at,
      colour: cream,
      halfHeight: 3,
      halfWidth: 3,
      kind: "ellipse",
      stroke: 3,
    });
    // A four-point amber burst along the incoming direction (screen right) and a white core.
    expect(star).toMatchObject({ alpha: 1, colour: amber, kind: "polygon" });
    if (star?.kind !== "polygon") {
      throw Error("Phaser burst missing");
    }
    expect(star.points).toHaveLength(8);
    expect(star.points[0]!.x).toBeCloseTo(context.at.x + 5.5, 9);
    expect(star.points[0]!.y).toBeCloseTo(context.at.y, 9);
    expect(core).toEqual({ alpha: 1, at: context.at, colour: white, kind: "disc", radius: 2.2 });
    for (const [age, count, alpha] of [
      [71, 3, 1],
      [72, 1, 1],
      [80, 1, 0.6],
      [124, 1, 0.6],
      [125, 1, 0.3],
      [159, 1, 0.3],
    ] as const) {
      const shapes = playerPhaser(age);
      expect(shapes).toHaveLength(count);
      expect(shapes[0]).toHaveProperty("alpha", alpha);
    }
    expect(playerPhaser(160)).toEqual([]);
    const half = playerPhaser(80)[0];
    if (half?.kind !== "ellipse") {
      throw Error("Phaser ring missing");
    }
    // At k 0.5 the ring reaches 3 + 13 x 0.75 and thins to 3 - 0.8.
    expect(half.halfWidth).toBeCloseTo(12.75, 9);
    expect(half.halfHeight).toBe(half.halfWidth);
    expect(half.stroke).toBeCloseTo(2.2, 9);
  });

  it("holds a single stationary player Phaser ring under reduced motion", () => {
    const ring = {
      alpha: 1,
      at: context.at,
      colour: EFFECT_COLOURS.cream,
      halfHeight: 5.5,
      halfWidth: 5.5,
      kind: "ellipse",
      stroke: 1.75,
    };
    expect(playerPhaser(0, true)).toEqual([ring]);
    expect(playerPhaser(48, true)).toEqual([ring]);
    // From 48 ms it fades by the held fade: 0.6 at 92 ms, 0.3 at 120 ms.
    expect(playerPhaser(92, true)).toEqual([{ ...ring, alpha: 0.6 }]);
    expect(playerPhaser(120, true)).toEqual([{ ...ring, alpha: 0.3 }]);
    expect(playerPhaser(136, true)).toEqual([]);
  });

  it("requires actual Lance direction and turns its white dart and cream burst to it", () => {
    expect(impactEffect(context, { ...contact, family: "lance" })).toEqual([]);
    const render = (direction: { x: number; y: number }, age = 0) =>
      impactEffect(context, { ...contact, age, direction, family: "lance" });
    const tail = (direction: { x: number; y: number }, age = 0) => {
      const dart = render(direction, age)[0];
      if (dart?.kind !== "polygon") {
        throw Error("Lance dart missing");
      }
      return dart.points[0]!;
    };
    const [dart, star] = render({ x: 1, y: -1 });
    expect(dart).toMatchObject({ alpha: 1, colour: EFFECT_COLOURS.white, kind: "polygon" });
    expect(star).toMatchObject({ alpha: 1, colour: EFFECT_COLOURS.cream, kind: "polygon" });
    expect(tail({ x: 1, y: -1 }).x).toBeCloseTo(80, 9);
    expect(tail({ x: 1, y: -1 }).y).toBeCloseTo(60, 9);
    expect(tail({ x: 1, y: 1 }).x).toBeCloseTo(100, 9);
    expect(tail({ x: 1, y: 1 }).y).toBeCloseTo(40, 9);
    // Halfway it has shrunk to half and dropped to its 0.6 step.
    expect(tail({ x: 1, y: -1 }, (SPARK_MS * 0.5) / 1000).x).toBeCloseTo(90, 9);
    expect(render({ x: 1, y: -1 }, (SPARK_MS * 0.5) / 1000)[0]).toHaveProperty("alpha", 0.6);
  });

  it("draws the ring burst's ripple from its art: amber, thinning, at the held fade", () => {
    const render = (p: number, reducedMotion = false) =>
      impactEffect(
        { ...context, reducedMotion },
        { ...contact, age: (p * SPARK_MS) / 1000, family: "ripple" },
      );
    const [start] = render(0);
    expect(start).toMatchObject({
      alpha: 1,
      colour: EFFECT_COLOURS.amber,
      kind: "ellipse",
      part: "ring",
      stroke: 2.2,
    });
    if (start?.kind !== "ellipse") {
      throw Error("ripple missing");
    }
    // A ground ellipse of radius 12 x 0.2 at the start.
    expect(start.halfWidth).toBeCloseTo(12 * 0.2 * Math.SQRT2, 9);
    expect(render(0.5)[0]).toMatchObject({ alpha: 0.6 });
    expect((render(0.5)[0] as { stroke: number }).stroke).toBeCloseTo(1.7, 9);
    expect(render(0.8)[0]).toMatchObject({ alpha: 0.3 });
    expect(render(0.5, true)[0]).toMatchObject({ alpha: 0.6, stroke: 2 });
    expect(render(1)).toEqual([]);
    // Without the enemy weapons' art a ripple draws nothing.
    expect(
      impactEffect({ at: context.at, reducedMotion: false }, { ...contact, family: "ripple" }),
    ).toEqual([]);
  });

  it("expands ripples and shockwaves, holding their envelope under reduced motion", () => {
    for (const family of ["ripple", "shockwave"] as const) {
      const render = (age: number, reducedMotion = false) =>
        impactEffect({ ...context, reducedMotion }, { ...contact, age, family })[0];
      const early = render(0);
      const later = render(0.03);
      expect(early?.kind).toBe("ellipse");
      if (early?.kind !== "ellipse" || later?.kind !== "ellipse") {
        throw Error("ring missing");
      }
      expect(later.halfWidth).toBeGreaterThan(early.halfWidth);
      const held = render(0, true);
      const faded = render(0.15, true);
      expect(held?.kind).toBe("ellipse");
      if (held?.kind !== "ellipse" || faded?.kind !== "ellipse") {
        throw Error("ring missing");
      }
      expect(held.halfWidth).toBe(faded.halfWidth);
      expect(faded.alpha).toBeLessThan(held.alpha);
    }
  });

  it("draws Mine's amber ring over a cream ellipse, apart from Ring's single ripple", () => {
    const { amber, cream } = EFFECT_COLOURS;
    const life = (SPARK_MS * IMPACT_STYLE.shockwave.duration) / 1000;
    for (const reducedMotion of [false, true]) {
      const render = (family: "ripple" | "shockwave", p: number) =>
        impactEffect({ ...context, reducedMotion }, { ...contact, age: p * life, family });
      expect(render("ripple", 0.1)).toHaveLength(1);
      const [ring, inner] = render("shockwave", 0.1);
      if (ring?.kind !== "ellipse" || inner?.kind !== "ellipse") {
        throw Error("shockwave layers missing");
      }
      expect(ring).toMatchObject({ alpha: 1, colour: amber, part: "ring" });
      expect(ring.stroke).toBeCloseTo(2.4 - 0.12, 9);
      expect(inner).toMatchObject({ alpha: 1, colour: cream });
      expect(inner.stroke).toBeUndefined();
      expect(inner.halfWidth).toBeCloseTo(ring.halfWidth * IMPACT_STYLE.shockwave.inner, 9);
      for (const [p, ringAlpha, innerAlpha] of [
        [0.35, 1, 0.6],
        [0.55, 0.6, 0.6],
        [0.8, 0.3, undefined],
      ] as const) {
        const [outer, fill] = render("shockwave", p);
        expect(outer).toHaveProperty("alpha", ringAlpha);
        expect((fill as { alpha: number } | undefined)?.alpha).toBe(innerAlpha);
      }
    }
  });

  it("ends every family and refuses effects before contact", () => {
    for (const family of [
      "missile",
      "compact",
      "compactBright",
      "phaserRings",
      "pellet",
      "lance",
      "ripple",
      "shockwave",
    ] as const) {
      for (const reducedMotion of [true, false]) {
        for (const age of [-1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
          expect(
            impactEffect(
              { ...context, reducedMotion },
              { ...contact, age, blastRadius: 42, direction: { x: 1, y: 0 }, family },
            ),
          ).toEqual([]);
        }
      }
    }
  });
});
