import { describe, expect, it } from "vitest";

import { impactFamily, type WeaponImpact } from "../model/weaponImpacts.ts";
import { EFFECT_COLOURS, impactEffect, SPARK_MS } from "./weaponEffects.ts";

const context = { at: { x: 100, y: 60 }, reducedMotion: false };
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

  it("staggers the player Phaser rings and fades each from its own start", () => {
    const { amber, cream } = EFFECT_COLOURS;
    expect(playerPhaser(0)).toEqual([
      {
        alpha: 1,
        at: context.at,
        colour: cream,
        halfHeight: 2.75,
        halfWidth: 2.75,
        kind: "ellipse",
        stroke: 1.5,
      },
    ]);
    for (const [age, count] of [
      [25, 1],
      [26, 2],
      [51, 2],
      [52, 3],
      [108, 2],
      [134, 1],
      [160, 0],
    ] as const) {
      expect(playerPhaser(age)).toHaveLength(count);
    }
    const rings = playerPhaser(62);
    expect(rings.map(({ colour }) => colour)).toEqual([cream, amber, cream]);
    for (const [index, radius, opacity] of [
      [0, 10.93, 0.5],
      [1, 7.5, 0.665],
      [2, 4.07, 0.72],
    ] as const) {
      const ring = rings[index];
      if (ring?.kind !== "ellipse") {
        throw Error("Phaser ring missing");
      }
      expect(ring).toMatchObject({ at: context.at, halfHeight: ring.halfWidth, stroke: 1.5 });
      expect(ring.halfWidth).toBeCloseTo(radius);
      expect(ring.alpha).toBeCloseTo(opacity);
    }
  });

  it("holds a single stationary player Phaser ring under reduced motion", () => {
    const ring = {
      alpha: 0.95,
      at: context.at,
      colour: EFFECT_COLOURS.cream,
      halfHeight: 5.5,
      halfWidth: 5.5,
      kind: "ellipse",
      stroke: 1.75,
    };
    expect(playerPhaser(0, true)).toEqual([ring]);
    expect(playerPhaser(48, true)).toEqual([ring]);
    expect(playerPhaser(92, true)).toEqual([{ ...ring, alpha: 0.475 }]);
    expect(playerPhaser(136, true)).toEqual([]);
  });

  it("requires actual Lance direction and rotates its concentrated streak", () => {
    expect(impactEffect(context, { ...contact, family: "lance" })).toEqual([]);
    const render = (direction: { x: number; y: number }) =>
      impactEffect(context, { ...contact, direction, family: "lance" })[0];
    expect(render({ x: 1, y: -1 })).toMatchObject({ from: { x: 82, y: 60 }, kind: "line" });
    expect(render({ x: 1, y: 1 })).toMatchObject({ from: { x: 100, y: 42 }, kind: "line" });
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
      const faded = render(0.03, true);
      expect(held?.kind).toBe("ellipse");
      if (held?.kind !== "ellipse" || faded?.kind !== "ellipse") {
        throw Error("ring missing");
      }
      expect(held.halfWidth).toBe(faded.halfWidth);
      expect(faded.alpha).toBeLessThan(held.alpha);
    }
  });

  it("distinguishes Mine's two fronts and subtle fill from Ring's single ripple", () => {
    for (const reducedMotion of [false, true]) {
      const render = (family: "ripple" | "shockwave") =>
        impactEffect({ ...context, reducedMotion }, { ...contact, age: 0.04, family });
      expect(render("ripple")).toHaveLength(1);
      const shapes = render("shockwave");
      expect(shapes).toHaveLength(3);
      const rings = shapes.filter(
        (shape) => shape.kind === "ellipse" && shape.stroke !== undefined,
      );
      const fill = shapes.find((shape) => shape.kind === "ellipse" && shape.stroke === undefined);
      expect(rings).toHaveLength(2);
      if (
        rings[0]?.kind !== "ellipse" ||
        rings[1]?.kind !== "ellipse" ||
        fill?.kind !== "ellipse"
      ) {
        throw Error("shockwave layers missing");
      }
      expect(rings[1].halfWidth).toBeLessThan(rings[0].halfWidth);
      expect(fill.halfWidth).toBe(rings[0].halfWidth);
      expect(fill.alpha).toBeGreaterThan(0);
      expect(fill.alpha).toBeLessThan(rings[1].alpha);
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
