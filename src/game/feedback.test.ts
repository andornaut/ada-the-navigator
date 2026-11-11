import { describe, expect, it } from "vitest";

import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { createEnemy } from "../model/enemy-ai.ts";
import { GameModel } from "../model/game.ts";
import { syncFlightRegion } from "../model/geography.ts";
import { ModelFeedback } from "./feedback.ts";

function launched() {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  model.choose("0");
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

  it("does not report switching back to basic fire as a pickup", () => {
    const { feedback, flight, state } = launched();
    flight.weapon = "missiles";
    feedback.observe(100, state);
    flight.weapon = "basic";
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
    state.progress[1].disabledEnemies++;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(feedback.pulses.at(-1)).toMatchObject({ kind: "disabled", x: 20, y: 30 });
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
    syncFlightRegion(PROTOTYPE, flight);
    flight.objects = [];
    state.progress[1].disabledEnemies++;
    expect(feedback.observe(100, state)).toEqual(["disabled"]);
    expect(feedback.pulses).toEqual([{ age: 0, kind: "disabled", x: 20, y: 30 }]);
    expect(feedback.observe(100, state)).toEqual([]);
  });

  it("does not emit hit feedback when an archived target appears in a projectile's hit history", () => {
    const { feedback, flight, state } = launched();
    flight.objects = [{ hp: 4, id: "archived-hit", kind: "enemy", radius: 10, x: 9000, y: 9000 }];
    feedback.observe(100, state);
    syncFlightRegion(PROTOTYPE, flight);
    flight.shots = [
      {
        damage: PROTOTYPE.tuning.flight.playerShotDamage,
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
    expect(state.progress[1].disabledEnemies).toBe(0);
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
