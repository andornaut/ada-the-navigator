import { describe, expect, it } from "vitest";

import file from "../../public/art/enemy-weapons.json";
import { enemyPhaser, lance, mine, MINE_POP_MS, readEnemyWeaponsArt } from "./enemyWeaponsArt.ts";

const art = readEnemyWeaponsArt(file)!;

describe("shared enemy hit hooks", () => {
  it("shows one directional Lance flash at the actual drawn endpoint after the full tell", () => {
    const ageMs = art.lance.trackMs + art.lance.lockMs;
    const view = { ageMs, end: { x: 100, y: 60 }, muzzle: { x: 0, y: 60 }, stopped: true };
    // The white dart runs from 20 px behind the contact to 4 px past it.
    const dart = (effect: { edged: readonly { kind: string }[] }) => {
      const shape = effect.edged.at(-2);
      if (shape?.kind !== "polygon") {
        throw Error("Lance dart missing");
      }
      const { points } = shape as unknown as { points: { x: number; y: number }[] };
      return [points[0]!, points[2]!].map(({ x, y }) => [Math.round(x), Math.round(y)]);
    };
    const hit = lance(art, view, false);
    // The beam's coral band and bloom disc, then the contact's dart and burst.
    expect(hit.edged).toHaveLength(4);
    expect(dart(hit)).toEqual([
      [80, 60],
      [104, 60],
    ]);
    const vertical = lance(art, { ...view, muzzle: { x: 100, y: 0 } }, false);
    expect(dart(vertical)).toEqual([
      [100, 40],
      [100, 64],
    ]);
    expect(lance(art, { ...view, stopped: false }, false).edged).toHaveLength(2);
    // Once the contact ends only the beam's coral band and bloom disc take the edge.
    expect(lance(art, { ...view, ageMs: ageMs + art.lance.spark.ms }, false).edged).toHaveLength(2);
  });

  it("uses a single bright compact Phaser contact without changing its firing boundary", () => {
    const view = {
      ageMs: art.phaser.aimMs,
      end: { x: 100, y: 60 },
      muzzle: { x: 0, y: 60 },
      stopped: true,
    };
    const hit = enemyPhaser(art, view, false);
    // The beam's coral band and bloom disc, then the spark's core and six rays.
    expect(hit.edged.filter((shape) => shape.kind === "disc")).toHaveLength(2);
    expect(hit.edged.filter((shape) => shape.kind === "polygon")).toHaveLength(7);
    expect(enemyPhaser(art, { ...view, stopped: false }, false).edged).toHaveLength(2);
    expect(
      enemyPhaser(art, { ...view, ageMs: view.ageMs + art.phaser.spark.ms }, false).edged,
    ).toEqual([]);
    // Reduced motion: the coral band and the still contact ring.
    expect(enemyPhaser(art, view, true).edged).toHaveLength(2);
  });

  it("draws a fired Phaser on its ship's current line and keeps the hit at the fire-time contact", () => {
    const fireTime = {
      ageMs: art.phaser.aimMs + 40,
      end: { x: 100, y: 60 },
      muzzle: { x: 0, y: 60 },
      stopped: true,
    };
    const beam = { from: { x: 20, y: 90 }, to: { x: 110, y: 130 } };
    const drawn = enemyPhaser(art, { ...fireTime, beam }, false);
    // Each band's butt end straddles the ship's current muzzle.
    const bands = drawn.shapes.slice(0, 3);
    expect(bands).toHaveLength(3);
    for (const band of bands) {
      if (band.kind !== "polygon") {
        throw Error("beam band missing");
      }
      const [first, last] = [band.points[0]!, band.points.at(-1)!];
      expect((first.x + last.x) / 2).toBeCloseTo(20, 9);
      expect((first.y + last.y) / 2).toBeCloseTo(90, 9);
    }
    // The spark is the same as on the fire-time line: where the hit landed, along its direction.
    const still = enemyPhaser(art, fireTime, false);
    expect(drawn.edged.slice(2)).toEqual(still.edged.slice(2));
  });

  it("routes mine pops to one expanding shockwave and preserves normal and reduced end times", () => {
    const at = { x: 20, y: 30 };
    const pop = (ageMs: number, reduced = false) =>
      mine(art, at, { ageMs: 3000, end: { ageMs, kind: "pop" }, lifeMs: 20000 }, reduced);
    const early = pop(0).shapes;
    const later = pop(MINE_POP_MS / 2).shapes;
    expect(early).toHaveLength(2);
    expect(later).toHaveLength(2);
    if (early[0]?.kind !== "ellipse" || later[0]?.kind !== "ellipse") {
      throw Error("shockwave missing");
    }
    expect(early[0].at).toEqual(at);
    expect(later[0].halfWidth).toBeGreaterThan(early[0].halfWidth);
    expect(pop(MINE_POP_MS).shapes).toEqual([]);
    expect(pop(art.mine.reducedPopMs, true).shapes).toEqual([]);
    const held = pop(0, true).shapes[0];
    const faded = pop(art.mine.reducedPopMs / 2, true).shapes[0];
    if (held?.kind !== "ellipse" || faded?.kind !== "ellipse") {
      throw Error("reduced shockwave missing");
    }
    expect(held.halfWidth).toBe(faded.halfWidth);
    expect(faded.alpha).toBeLessThan(held.alpha);
  });
});
