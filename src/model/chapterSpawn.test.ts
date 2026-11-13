import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { spawnChapterEnemy, syncFlightRegion } from "./flight.ts";
import { GameModel } from "./game.ts";
import { recordObjectRemoval } from "./geography.ts";

function launched() {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 6];
  model.startGalaxy(6);
  const flight = model.state.flight!;
  flight.objects = [];
  return flight;
}

describe("required chapter encounters", () => {
  it("registers a canonical persistent enemy and counts its pack member only once", () => {
    const flight = launched();
    const options = { home: { x: 20, y: 30 }, packId: "chapter:pack", routeId: "chapter:site" };
    const enemy = spawnChapterEnemy(
      CONTENT,
      "fighter",
      "chapter:one",
      { x: 0, y: 0 },
      flight,
      options,
    )!;
    expect(enemy.persistent).toBe(true);
    expect(enemy.routeId).toBe("chapter:site");
    expect(enemy.enemy!.home).toEqual(options.home);
    enemy.enemy!.hp = 1;
    expect(spawnChapterEnemy(CONTENT, "fighter", enemy.id, { x: 0, y: 0 }, flight, options)).toBe(
      enemy,
    );
    expect(enemy.enemy!.hp).toBe(1);
    expect(flight.combat!.initialPackSizes["chapter:pack"]).toBe(1);
    expect(flight.objects.filter((o) => o.id === enemy.id)).toHaveLength(1);
  });

  it("reactivates the exact retained survivor rather than rerolling its state", () => {
    const flight = launched();
    const point = { x: 40000, y: 40000 };
    const enemy = spawnChapterEnemy(CONTENT, "frigate", "chapter:retained", point, flight)!;
    enemy.enemy!.hp = 1;
    syncFlightRegion(CONTENT, flight);
    expect(flight.objects).not.toContain(enemy);
    expect(flight.world.notables[enemy.id]).toBe(enemy);
    expect(spawnChapterEnemy(CONTENT, "frigate", enemy.id, point, flight)).toBe(enemy);
    expect(enemy.enemy!.hp).toBe(1);
    expect(flight.world.notables).not.toHaveProperty(enemy.id);
  });

  it("never resurrects a recorded casualty or increases its pack denominator", () => {
    const flight = launched();
    const options = { packId: "chapter:pack" };
    const enemy = spawnChapterEnemy(
      CONTENT,
      "fighter",
      "chapter:fallen",
      { x: 0, y: 0 },
      flight,
      options,
    )!;
    recordObjectRemoval(CONTENT, enemy, flight);
    flight.objects = [];
    expect(
      spawnChapterEnemy(CONTENT, "fighter", enemy.id, { x: 0, y: 0 }, flight, options),
    ).toBeNull();
    expect(flight.objects).toEqual([]);
    expect(flight.combat!.initialPackSizes["chapter:pack"]).toBe(1);
  });

  it("clears the whole drift footprint while preserving story destinations", () => {
    const flight = launched();
    flight.objects = [
      {
        hp: 1,
        id: "drift",
        kind: "rock",
        orbit: { phase: 0, radius: 1000, rate: 0, x: 0, y: 0 },
        radius: 10,
        x: 1000,
        y: 0,
      },
      { hp: 1, id: "site", kind: "destination", radius: 30, x: 0, y: 0 },
    ];
    spawnChapterEnemy(CONTENT, "frigate", "chapter:clear", { x: 0, y: 0 }, flight);
    expect(flight.objects.map((o) => o.id)).toEqual(["site", "chapter:clear"]);
  });
});
