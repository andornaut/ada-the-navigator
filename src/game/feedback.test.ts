import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { HIT_FLASH, HIT_SHAKE } from "../data/layout.ts";
import { createEnemy } from "../model/enemyAi.ts";
import { wreckId } from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { syncFlightRegion } from "../model/geography.ts";
import { playOpening } from "../testing/launch.ts";
import { publicJson } from "../testing/publicArt.ts";
import {
  HIT_FLASH_FILL,
  HIT_SHAKE_SHARE,
  hitFlashAlpha,
  hitFlashBands,
  ModelFeedback,
} from "./feedback.ts";
import { readSpacePalette } from "./spacePalette.ts";

function launched() {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  const feedback = new ModelFeedback();
  feedback.observe(100, model.state);
  return { feedback, flight: model.state.flight!, state: model.state };
}

describe("model feedback", () => {
  it("tracks independent hardpoint damage even when hull HP does not change", () => {
    const { feedback, flight, state } = launched();
    const enemy = createEnemy(
      enemyCatalog.frigate,
      { archetype: "frigate", id: "frigate", packId: null, phase: 0 },
      { x: 20, y: 30 },
    );
    flight.objects = [
      { enemy, hp: enemy.hp, id: enemy.id, kind: "enemy", radius: 30, x: 20, y: 30 },
    ];
    feedback.observe(100, state);
    enemy.hardpoints[0]!.hp--;
    expect(feedback.observe(100, state)).toEqual(["hit"]);
    enemy.hardpoints[0]!.hp = 0;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(flight.objects[0]!.hp).toBe(enemyCatalog.frigate.hp);
  });

  it("copies mutable shield and cargo values rather than retaining the flight reference", () => {
    const { feedback, flight, state } = launched();
    flight.shield -= 10;
    flight.cargo++;
    expect(feedback.observe(100, state)).toEqual(["damage", "pickup"]);
    expect(feedback.observe(100, state)).toEqual([]);
  });

  it("draws no pulse around Ada while the shield recharges", () => {
    const { feedback, flight, state } = launched();
    flight.shield -= 10;
    feedback.observe(100, state);
    feedback.advance(1);
    flight.shield += 1;
    expect(feedback.observe(100, state)).toEqual([]);
    expect(feedback.pulses).toEqual([]);
  });

  it("does not report switching back to laser fire as a pickup", () => {
    const { feedback, flight, state } = launched();
    flight.weapon = "rapidMissile";
    feedback.observe(100, state);
    flight.weapon = "laser";
    expect(feedback.observe(100, state)).not.toContain("pickup");
  });

  it("reports collected Stardust as a pickup", () => {
    const { feedback, state } = launched();
    feedback.observe(100, state);
    state.economy.stardust += 5;
    expect(feedback.observe(100, state)).toEqual(["pickup"]);
  });

  it("ignores object streaming removals without recorded combat evidence", () => {
    const { feedback, flight, state } = launched();
    flight.objects.push({ hp: 4, id: "departing", kind: "enemy", radius: 10, x: 400, y: 400 });
    feedback.observe(100, state);
    flight.objects = [];
    expect(feedback.observe(100, state)).toEqual([]);
  });

  it("shows disabled feedback for removed enemies only after the progress counter increases", () => {
    const { feedback, flight, state } = launched();
    flight.objects = [{ hp: 4, id: "target", kind: "enemy", radius: 10, x: 20, y: 30 }];
    feedback.observe(100, state);
    flight.objects = [];
    state.progress[1].destroyedEnemies++;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(feedback.pulses.at(-1)).toMatchObject({ kind: "disabled", x: 20, y: 30 });
  });

  it("sounds a kill but draws no marker once the enemy's destruction starts", () => {
    const { feedback, flight, state } = launched();
    flight.objects = [{ hp: 4, id: "target", kind: "enemy", radius: 10, x: 20, y: 30 }];
    feedback.observe(100, state);
    flight.objects = [
      {
        hp: 1,
        id: wreckId("target"),
        kind: "wreck",
        radius: 10,
        wreck: { age: 0, archetype: "fighter", facing: { x: 0, y: -1 } },
        x: 20,
        y: 30,
      },
    ];
    state.progress[1].destroyedEnemies++;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(feedback.pulses).toEqual([]);
  });

  it("attributes a same-step kill only to the defeated enemy when an earlier enemy is archived", () => {
    const { feedback, flight, state } = launched();
    const archived = {
      hp: 4,
      id: "archived-first",
      kind: "enemy" as const,
      radius: 10,
      x: 9000,
      y: 9000,
    };
    const defeated = {
      hp: 4,
      id: "defeated-second",
      kind: "enemy" as const,
      radius: 10,
      x: 20,
      y: 30,
    };
    flight.objects = [archived, defeated];
    feedback.observe(100, state);
    syncFlightRegion(CONTENT, flight);
    flight.objects = [];
    state.progress[1].destroyedEnemies++;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(feedback.pulses).toEqual([{ age: 0, kind: "disabled", x: 20, y: 30 }]);
    expect(feedback.observe(100, state)).toEqual([]);
  });

  it("does not emit hit feedback when an archived target appears in a projectile's hit history", () => {
    const { feedback, flight, state } = launched();
    flight.objects = [{ hp: 4, id: "archived-hit", kind: "enemy", radius: 10, x: 9000, y: 9000 }];
    feedback.observe(100, state);
    syncFlightRegion(CONTENT, flight);
    flight.shots = [
      {
        damage: CONTENT.tuning.flight.playerShotDamage,
        enemy: false,
        hitIds: ["archived-hit"],
        id: "surviving-projectile",
        life: 1,
        piercing: true,
        velocity: { x: 1, y: 0 },
        x: 20,
        y: 30,
      },
    ];
    expect(feedback.observe(100, state)).toEqual([]);
    expect(feedback.pulses).toEqual([]);
    expect(state.progress[1].destroyedEnemies).toBe(0);
  });

  it("distinguishes deposits and discontinuous travel from ordinary motion", () => {
    const { feedback, flight, state } = launched();
    flight.player.x += 1;
    expect(feedback.observe(100, state)).toEqual([]);
    state.progress[1].deposited++;
    flight.player.x += 200;
    expect(feedback.observe(100, state)).toEqual(["deposit", "teleport"]);
    feedback.advance(0.7);
    expect(feedback.pulses).toEqual([]);
  });
});

describe("hit feedback", () => {
  it("flashes the threat red at full opacity on a hit, fading linearly to 0 over 200 ms", () => {
    const palette = readSpacePalette(publicJson("/art/space-palette.json"))!;
    expect(HIT_FLASH).toEqual({ colour: "#FF6B6B", duration: 200, width: 3 });
    expect(HIT_FLASH_FILL).toBe(palette.threat);
    expect(hitFlashAlpha(false, 0)).toBe(1);
    expect(hitFlashAlpha(false, 50)).toBeCloseTo(0.75, 9);
    expect(hitFlashAlpha(false, 100)).toBeCloseTo(0.5, 9);
    expect(hitFlashAlpha(false, 199)).toBeCloseTo(0.005, 9);
    expect(hitFlashAlpha(false, 200)).toBe(0);
    // Before any hit the latest hit time is -Infinity, so the time since it is Infinity.
    expect(hitFlashAlpha(false, Infinity)).toBe(0);
    expect(hitFlashAlpha(false, -1)).toBe(0);
  });

  it("draws no flash under reduced motion", () => {
    for (const since of [0, 50, 199]) {
      expect(hitFlashAlpha(true, since)).toBe(0);
    }
  });

  it("bands the game area's edge 3 wide inside it with square corners and no overlap", () => {
    const bands = hitFlashBands({ height: 360, width: 720, x: 0, y: 0 });
    expect(bands).toEqual([
      { height: 3, width: 720, x: 0, y: 0 },
      { height: 3, width: 720, x: 0, y: 357 },
      { height: 354, width: 3, x: 0, y: 3 },
      { height: 354, width: 3, x: 717, y: 3 },
    ]);
    const covered = bands.reduce((sum, band) => sum + band.width * band.height, 0);
    expect(covered).toBe(720 * 360 - 714 * 354);
  });

  it("shakes the view 2 logical px of the 720 base width for 100 ms", () => {
    expect(HIT_SHAKE).toEqual({ duration: 100, offset: 2 });
    expect(HIT_SHAKE_SHARE * 720).toBeCloseTo(2, 9);
  });
});
