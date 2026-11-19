import { describe, expect, it } from "vitest";

import file from "../../public/art/enemy-weapons.json";
import { enemyPhaser, lance, mine, MINE_POP_MS, readEnemyWeaponsArt } from "./enemyWeaponsArt.ts";

const art = readEnemyWeaponsArt(file)!;

describe("shared enemy hit hooks", () => {
  it("shows one directional Lance flash at the actual drawn endpoint after the full tell", () => {
    const ageMs = art.lance.trackMs + art.lance.lockMs;
    const view = { ageMs, end: { x: 100, y: 60 }, muzzle: { x: 0, y: 60 }, stopped: true };
    const hit = lance(art, view, false, false);
    expect(hit.edged).toHaveLength(2);
    expect(hit.edged[0]).toMatchObject({
      from: { x: 82, y: 60 },
      kind: "line",
      to: { x: 104, y: 60 },
    });
    const vertical = lance(art, { ...view, muzzle: { x: 100, y: 0 } }, false, false);
    expect(vertical.edged[0]).toMatchObject({ from: { x: 100, y: 42 }, to: { x: 100, y: 64 } });
    expect(lance(art, { ...view, stopped: false }, false, false).edged).toEqual([]);
    expect(lance(art, { ...view, ageMs: ageMs + art.lance.spark.ms }, false, false).edged).toEqual(
      [],
    );
  });

  it("uses a single bright compact Phaser contact without changing its firing boundary", () => {
    const view = {
      ageMs: art.phaser.aimMs,
      end: { x: 100, y: 60 },
      muzzle: { x: 0, y: 60 },
      stopped: true,
    };
    const hit = enemyPhaser(art, view, false, false);
    expect(hit.edged.filter((shape) => shape.kind === "disc")).toHaveLength(1);
    expect(hit.edged.filter((shape) => shape.kind === "line")).toHaveLength(6);
    expect(enemyPhaser(art, { ...view, stopped: false }, false, false).edged).toEqual([]);
    expect(
      enemyPhaser(art, { ...view, ageMs: view.ageMs + art.phaser.spark.ms }, false, false).edged,
    ).toEqual([]);
    expect(enemyPhaser(art, view, false, true).edged).toHaveLength(1);
  });

  it("draws a fired Phaser on its ship's current line and keeps the hit at the fire-time contact", () => {
    const fireTime = {
      ageMs: art.phaser.aimMs + 40,
      end: { x: 100, y: 60 },
      muzzle: { x: 0, y: 60 },
      stopped: true,
    };
    const beam = { from: { x: 20, y: 90 }, to: { x: 110, y: 130 } };
    const drawn = enemyPhaser(art, { ...fireTime, beam }, false, false);
    const tapers = drawn.shapes.flatMap((shape) => (shape.kind === "taper" ? [shape] : []));
    expect(tapers.length).toBeGreaterThan(0);
    for (const taper of tapers) {
      expect(taper.tail.at.x).toBeCloseTo(20, 9);
      expect(taper.tail.at.y).toBeCloseTo(90, 9);
    }
    // The spark is the same as on the fire-time line: where the hit landed, along its direction.
    const still = enemyPhaser(art, fireTime, false, false);
    expect(drawn.edged).toEqual(still.edged);
  });

  it("routes mine pops to one expanding shockwave and preserves normal and reduced end times", () => {
    const at = { x: 20, y: 30 };
    const pop = (ageMs: number, reduced = false) =>
      mine(art, at, { ageMs: 3000, end: { ageMs, kind: "pop" }, lifeMs: 20000 }, reduced);
    const early = pop(0).shapes;
    const later = pop(MINE_POP_MS / 2).shapes;
    expect(early).toHaveLength(3);
    expect(later).toHaveLength(3);
    if (early[0]?.kind !== "ellipse" || later[0]?.kind !== "ellipse") {
      throw Error("shockwave missing");
    }
    expect(early[0].at).toEqual(at);
    expect(later[0].halfWidth).toBeGreaterThan(early[0].halfWidth);
    expect(pop(MINE_POP_MS).shapes).toEqual([]);
    expect(pop(art.mine.reducedPop.ms, true).shapes).toEqual([]);
    const held = pop(0, true).shapes[0];
    const faded = pop(art.mine.reducedPop.ms / 2, true).shapes[0];
    if (held?.kind !== "ellipse" || faded?.kind !== "ellipse") {
      throw Error("reduced shockwave missing");
    }
    expect(held.halfWidth).toBe(faded.halfWidth);
    expect(faded.alpha).toBeLessThan(held.alpha);
  });
});
