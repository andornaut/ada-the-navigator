import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { grantAllWeapons } from "./cheats.ts";
import { GameModel } from "./game.ts";
import { stationsNear } from "./stations.ts";
import { playOpening } from "./test-launch.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function launched(): GameModel {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  model.state.flight!.objects = [];
  return model;
}

describe("grant all weapons", () => {
  it("adds every weapon to the flight only, leaving selection and saved ownership unchanged", () => {
    const model = launched();
    const flight = model.state.flight!;
    Object.assign(flight, {
      cargo: 12345,
      fireCooldown: 0.37,
      ownedWeapons: ["tripleLaser"],
      shield: 42,
      weapon: "tripleLaser",
    });
    model.save();
    const economy = structuredClone(model.state.economy);
    expect(grantAllWeapons(model.state)).toBe(true);
    expect(flight.ownedWeapons).toEqual(["tripleLaser", "missiles", "scattershot"]);
    expect(flight.grantedWeapons).toEqual(["missiles", "scattershot"]);
    expect(flight).toMatchObject({ cargo: 12345, fireCooldown: 0.37, shield: 42 });
    expect(flight.weapon).toBe("tripleLaser");
    const serialized = model.save();
    expect(model.state.economy).toEqual(economy);
    // A resumed flight keeps its granted weapons until the flight ends.
    expect(new GameModel(PROTOTYPE, serialized).state).toEqual(model.state);
    expect(grantAllWeapons(model.state)).toBe(true);
    expect(model.save()).toBe(serialized);
  });

  it("ends granted weapons with the flight", () => {
    const model = launched();
    grantAllWeapons(model.state);
    model.state.flight!.weapon = "missiles";
    model.save();
    expect(model.state.economy).toMatchObject({ ownedWeapons: [], weapon: "basic" });
    model.returnHome();
    model.startSector(1);
    playOpening(model);
    expect(model.weapons().map((choice) => choice.id)).toEqual(["basic"]);
  });

  it("costs nothing saved when a granted weapon is lost in a quantum jump", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.levels.weapons.tripleLaser = 2;
    flight.ownedWeapons = ["tripleLaser"];
    grantAllWeapons(model.state);
    flight.weapon = "missiles";
    model.state.economy.stardust = 30;
    flight.shield = PROTOTYPE.tuning.enemyDamage;
    flight.shots.push({
      ...flight.player,
      enemy: true,
      hitIds: [],
      id: "hit",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
    model.step(0.01, idle);
    expect(model.state.mode).toBe("home");
    expect(model.state.economy).toMatchObject({ ownedWeapons: ["tripleLaser"], stardust: 20 });
    expect(model.state.economy.levels.weapons.tripleLaser).toBe(2);
    expect(model.state.notice).not.toContain("was lost");
  });

  it("makes a granted weapon really owned when it is found or bought", () => {
    const model = launched();
    const flight = model.state.flight!;
    grantAllWeapons(model.state);
    flight.objects.push({
      ...flight.player,
      hp: 1,
      id: "found",
      kind: "pickup",
      radius: 10,
      weapon: "scattershot",
    });
    model.step(0.01, idle);
    expect(model.state.economy.ownedWeapons).toEqual(["scattershot"]);
    expect(model.state.economy.stardust).toBe(0);
    model.state.docked = stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 })[0]!.id;
    model.state.economy.stardust = 150;
    expect(model.buy({ kind: "weapon", weapon: "missiles" })).toEqual({
      kind: "bought",
      price: 150,
    });
    expect(model.state.economy.ownedWeapons).toEqual(["scattershot", "missiles"]);
    expect(flight.grantedWeapons).toEqual(["tripleLaser"]);
    expect(model.weapons().map((choice) => choice.id)).toEqual([
      "basic",
      "missiles",
      "tripleLaser",
      "scattershot",
    ]);
  });

  it("does not change a home or dialogue save", () => {
    const model = new GameModel(PROTOTYPE);
    const home = model.save();
    expect(grantAllWeapons(model.state)).toBe(false);
    expect(model.save()).toBe(home);
    model.startSector(1);
    model.state.dialogue = { choices: [], context: "grower", text: "", title: "" };
    const dialogue = model.save();
    expect(grantAllWeapons(model.state)).toBe(false);
    expect(model.save()).toBe(dialogue);
  });
});
