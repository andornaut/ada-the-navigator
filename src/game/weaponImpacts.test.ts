import { describe, expect, it } from "vitest";

import { impactFamily, type WeaponImpact } from "../model/weaponImpacts.ts";
import { impactEffect, SPARK_MS } from "./weaponEffects.ts";

const context = { at: { x: 100, y: 60 }, reducedMotion: false };
const contact: WeaponImpact = { age: 0, family: "compact", id: "contact", x: 0, y: 0 };

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
    expect(ring(small)).toMatchObject({ halfWidth: 30 * Math.SQRT2 });
    expect(ring(large)).toMatchObject({ halfWidth: 60 * Math.SQRT2 });
    expect(impactEffect(context, { ...contact, family: "missile" })).toEqual([]);
  });

  it("keeps Phaser brighter and longer than compact hits, with pellets ending first", () => {
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
      "pellet",
      "lance",
      "ripple",
      "shockwave",
    ] as const) {
      for (const reducedMotion of [true, false]) {
        for (const age of [-1, 1]) {
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
