import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { Weapon } from "../data/types.ts";
import { ensureDestination, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { playOpening } from "./test-launch.ts";
import type { FlightState } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launched(): GameModel {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  model.state.flight!.objects = [];
  return model;
}
function pickup(model: GameModel, weapon: Exclude<Weapon, "basic">): void {
  const flight = model.state.flight!;
  flight.objects.push({
    ...flight.player,
    hp: 1,
    id: `pickup:${flight.nextId++}`,
    kind: "pickup",
    radius: 10,
    weapon,
  });
  stepFlight(PROTOTYPE, 0.01, idle, flight);
}
function incoming(flight: FlightState, count = 1): void {
  for (let index = 0; index < count; index++) {
    flight.shots.push({
      ...flight.player,
      enemy: true,
      hitIds: [],
      id: `hit:${flight.nextId++}`,
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
  }
}

describe("owned unlimited weapons", () => {
  it("keeps collected upgrades selectable without spending ownership or resetting fire cooldown", () => {
    const model = launched();
    const flight = model.state.flight!;
    expect(model.weapons()).toEqual([{ id: "basic", locked: false, selected: true }]);
    pickup(model, "missiles");
    pickup(model, "tripleLaser");
    flight.fireCooldown = 0.25;
    expect(model.selectWeapon("missiles")).toBe(true);
    expect(flight.fireCooldown).toBe(0.25);
    expect(model.selectWeapon("basic")).toBe(true);
    expect(model.selectWeapon("tripleLaser")).toBe(true);
    expect(flight.ownedWeapons).toEqual(["missiles", "tripleLaser"]);
    expect(model.weapons()).toEqual([
      { id: "basic", locked: false, selected: false },
      { id: "missiles", locked: false, selected: false },
      { id: "tripleLaser", locked: false, selected: true },
    ]);
    const before = model.save();
    expect(model.selectWeapon("scattershot")).toBe(false);
    expect(model.save()).toBe(before);
  });

  it.each(["missiles", "tripleLaser", "scattershot"] as const)(
    "fires %s continuously without ammunition and preserves ownership",
    (weapon) => {
      const model = launched();
      pickup(model, weapon);
      const flight = model.state.flight!;
      stepFlight(PROTOTYPE, 1, { ...idle, aim: { x: 1, y: 0 } }, flight);
      expect(flight.weapon).toBe(weapon);
      expect(flight.ownedWeapons).toEqual([weapon]);
      expect(flight.shots.length).toBeGreaterThan(1);
    },
  );

  it("does not duplicate ownership when collecting the same upgrade repeatedly", () => {
    const model = launched();
    pickup(model, "missiles");
    expect(model.selectWeapon("basic")).toBe(true);
    pickup(model, "missiles");
    pickup(model, "missiles");
    expect(model.state.flight!.ownedWeapons).toEqual(["missiles"]);
    expect(model.weapons().filter((choice) => choice.id === "missiles")).toHaveLength(1);
  });

  it("depletes the shield without restoring it, so an equipped upgrade no longer absorbs depletion", () => {
    const model = launched();
    pickup(model, "missiles");
    const flight = model.state.flight!;
    flight.shield = PROTOTYPE.tuning.enemyDamage;
    incoming(flight);
    const events = stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(events).toContainEqual({ type: "depleted" });
    expect(flight.shield).toBe(0);
  });

  it("jumps home on basic depletion despite reserves, preserving story and upgrades for a fresh flight", () => {
    const model = launched();
    pickup(model, "tripleLaser");
    model.state.flight!.dangerFor = 0;
    model.state.flight!.weaponLockFor = 0;
    expect(model.selectWeapon("basic")).toBe(true);
    const flight = model.state.flight!;
    const seed = flight.seed;
    model.state.progress[1].deposited = 42;
    flight.shield = PROTOTYPE.tuning.enemyDamage;
    incoming(flight);
    model.step(0.01, idle);
    expect(model.state.mode).toBe("home");
    expect(model.state.flight).toBeNull();
    expect(model.state.progress[1].deposited).toBe(42);
    model.startSector(1);
    playOpening(model);
    expect(model.state.flight!.seed).not.toBe(seed);
    expect(model.weapons()).toEqual([
      { id: "basic", locked: false, selected: true },
      { id: "tripleLaser", locked: false, selected: false },
    ]);
    expect(model.state.progress[1].deposited).toBe(42);
  });

  it("keeps friendly arrivals protected without losing an owned upgrade", () => {
    const model = launched();
    pickup(model, "missiles");
    const flight = model.state.flight!;
    flight.objects.push({
      ...flight.player,
      hp: 1,
      id: "growers",
      kind: "destination",
      radius: 30,
    });
    flight.shield = PROTOTYPE.tuning.enemyDamage;
    flight.sinceDamage = 0;
    incoming(flight);
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.shield).toBe(PROTOTYPE.tuning.enemyDamage);
    expect(flight.weapon).toBe("missiles");
    expect(flight.ownedWeapons).toEqual(["missiles"]);
  });

  it("restores selected upgrade ownership without using the ammunition counter", () => {
    const source = launched();
    source.state.flight!.weapon = "scattershot";
    const saved = source.save();
    const model = new GameModel(PROTOTYPE, saved);
    expect(model.save()).toBe(saved);
    expect(model.weapons()).toContainEqual({ id: "scattershot", locked: false, selected: true });
    expect(model.save()).toBe(saved);
    expect(model.selectWeapon("basic")).toBe(true);
    expect(model.state.flight!.ownedWeapons).toEqual(["scattershot"]);
    const resumed = new GameModel(PROTOTYPE, model.save());
    expect(resumed.selectWeapon("scattershot")).toBe(true);
    expect(restoreSave(resumed.save())).toEqual(resumed.state);
  });

  it("rejects malformed ownership metadata without weakening snapshot validation", () => {
    const model = launched();
    pickup(model, "missiles");
    expect(restoreSave(model.save())).not.toBeNull();
    for (const ownedWeapons of [
      null,
      {},
      ["basic"],
      ["unknown"],
      ["missiles", "missiles"],
      ["missiles", 1],
      [],
      ["tripleLaser"],
      { missiles: true },
      ["__proto__"],
    ]) {
      const snapshot = JSON.parse(model.save()) as { flight: { ownedWeapons: unknown } };
      snapshot.flight.ownedWeapons = ownedWeapons;
      expect(restoreSave(snapshot)).toBeNull();
    }
    const legacy = JSON.parse(model.save()) as { flight: { ownedWeapons?: unknown } };
    delete legacy.flight.ownedWeapons;
    expect(restoreSave(legacy)).not.toBeNull();
  });

  it("rejects selection outside live flight and during dialogue", () => {
    const model = launched();
    pickup(model, "tripleLaser");
    model.state.dialogue = { choices: [], context: "test", text: "", title: "" };
    expect(model.selectWeapon("basic")).toBe(false);
    model.state.dialogue = null;
    model.returnHome();
    expect(model.selectWeapon("tripleLaser")).toBe(false);
    expect(model.weapons()).toEqual([]);
  });
});

it("collects every nearby cargo piece above the former limit and preserves large deposits", () => {
  const model = launched();
  const flight = model.state.flight!;
  flight.cargo = 1000;
  for (let index = 0; index < 25; index++) {
    flight.objects.push({
      ...flight.player,
      hp: 1,
      id: `cargo:${index}`,
      kind: "pickup",
      radius: 5,
      role: "cargo",
    });
  }
  stepFlight(PROTOTYPE, 0.01, idle, flight);
  expect(flight.cargo).toBe(1025);
  expect(flight.objects.filter((object) => object.role === "cargo")).toHaveLength(0);
  expect(restoreSave(model.save())?.flight?.cargo).toBe(1025);
  model.state.selectedSector = 2;
  model.state.unlocked.push(2);
  flight.sector = 2;
  const destination = ensureDestination(PROTOTYPE, "hub", flight);
  model.state.progress[2].known.push("hub");
  flight.player = { x: destination.x, y: destination.y };
  model.interact();
  expect(model.state.progress[2].deposited).toBe(1025);
  expect(flight.cargo).toBe(0);
});
