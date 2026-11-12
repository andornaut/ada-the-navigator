import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { Weapon } from "../data/types.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { grantAllWeapons } from "./cheats.ts";
import { ensureDestination, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import type { FlightState } from "./types.ts";
import { noAmmo } from "./weapons.ts";

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

describe("owned upgrade weapons", () => {
  it("keeps collected upgrades selectable without spending ownership or resetting fire cooldown", () => {
    const model = launched();
    const flight = model.state.flight!;
    expect(model.weapons()).toEqual([{ ammo: null, id: "basic", selected: true }]);
    pickup(model, "rapidMissile");
    pickup(model, "multiLaser");
    flight.fireCooldown = 0.25;
    // Each switch waits out the one before it.
    flight.weaponSwitchFor = 0;
    expect(model.selectWeapon("rapidMissile")).toBe(true);
    expect(flight.fireCooldown).toBe(0.25);
    flight.weaponSwitchFor = 0;
    expect(model.selectWeapon("basic")).toBe(true);
    flight.weaponSwitchFor = 0;
    expect(model.selectWeapon("multiLaser")).toBe(true);
    expect(flight.ownedWeapons).toEqual(["rapidMissile", "multiLaser"]);
    // Each found weapon includes three packs.
    expect(model.weapons()).toEqual([
      { ammo: null, id: "basic", selected: false },
      { ammo: 600, id: "rapidMissile", selected: false },
      { ammo: 600, id: "multiLaser", selected: true },
    ]);
    const before = model.save();
    expect(model.selectWeapon("scattershot")).toBe(false);
    expect(model.save()).toBe(before);
  });

  it.each(["rapidMissile", "multiLaser", "scattershot"] as const)(
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
    pickup(model, "rapidMissile");
    model.state.flight!.weaponSwitchFor = 0;
    expect(model.selectWeapon("basic")).toBe(true);
    pickup(model, "rapidMissile");
    pickup(model, "rapidMissile");
    expect(model.state.flight!.ownedWeapons).toEqual(["rapidMissile"]);
    expect(model.weapons().filter((choice) => choice.id === "rapidMissile")).toHaveLength(1);
  });

  it("depletes the shield without restoring it, so an equipped upgrade no longer absorbs depletion", () => {
    const model = launched();
    pickup(model, "rapidMissile");
    const flight = model.state.flight!;
    flight.shield = PROTOTYPE.tuning.enemyDamage;
    incoming(flight);
    const events = stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(events).toContainEqual({ type: "depleted" });
    expect(flight.shield).toBe(0);
  });

  it("jumps home on basic depletion despite reserves, preserving story and upgrades for a fresh flight", () => {
    const model = launched();
    pickup(model, "multiLaser");
    model.state.flight!.weaponSwitchFor = 0;
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
      { ammo: null, id: "basic", selected: true },
      { ammo: 600, id: "multiLaser", selected: false },
    ]);
    expect(model.state.progress[1].deposited).toBe(42);
  });

  it("keeps friendly arrivals protected without losing an owned upgrade", () => {
    const model = launched();
    pickup(model, "rapidMissile");
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
    expect(flight.weapon).toBe("rapidMissile");
    expect(flight.ownedWeapons).toEqual(["rapidMissile"]);
  });

  it("restores selected upgrade ownership and its ammunition", () => {
    const source = launched();
    source.state.flight!.weapon = "scattershot";
    source.state.flight!.ammo.scattershot = 42;
    const saved = source.save();
    const model = relaunch(PROTOTYPE, saved);
    expect(model.save()).toBe(saved);
    expect(model.weapons()).toContainEqual({ ammo: 42, id: "scattershot", selected: true });
    expect(model.save()).toBe(saved);
    expect(model.selectWeapon("basic")).toBe(true);
    expect(model.state.flight!.ownedWeapons).toEqual(["scattershot"]);
    // The switch wait is saved, so the resumed flight waits it out before switching back.
    const resumed = relaunch(PROTOTYPE, model.save());
    expect(resumed.selectWeapon("scattershot")).toBe(false);
    resumed.state.flight!.weaponSwitchFor = 0;
    expect(resumed.selectWeapon("scattershot")).toBe(true);
    expect(restoreSave(resumed.save())).toEqual(resumed.state);
  });

  it("rejects malformed ownership metadata without weakening snapshot validation", () => {
    const model = launched();
    pickup(model, "rapidMissile");
    expect(restoreSave(model.save())).not.toBeNull();
    for (const ownedWeapons of [
      null,
      {},
      ["basic"],
      ["unknown"],
      ["rapidMissile", "rapidMissile"],
      ["rapidMissile", 1],
      [],
      ["multiLaser"],
      { rapidMissile: true },
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
    pickup(model, "multiLaser");
    model.state.dialogue = { choices: [], context: "test", text: "", title: "" };
    expect(model.selectWeapon("basic")).toBe(false);
    model.state.dialogue = null;
    model.returnHome();
    expect(model.selectWeapon("multiLaser")).toBe(false);
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

describe("ammunition", () => {
  const aim = { ...idle, aim: { x: 0, y: -1 } };

  it("switches to Basic at once when the equipped weapon runs out, ignoring the switch wait", () => {
    const model = launched();
    pickup(model, "rapidMissile");
    const flight = model.state.flight!;
    expect(flight.weapon).toBe("rapidMissile");
    // The find just started the switch wait.
    expect(flight.weaponSwitchFor).toBeGreaterThan(0);
    flight.ammo.rapidMissile = 1;
    model.step(0.01, aim);
    expect(flight.ammo.rapidMissile).toBe(0);
    expect(flight.weapon).toBe("basic");
    expect(model.state.notice).toBe("Out of ammo.");
    expect(model.state.economy.ammo.rapidMissile).toBe(0);
  });

  it("refuses an empty weapon until ammunition is bought", () => {
    const model = launched();
    pickup(model, "phaser");
    const flight = model.state.flight!;
    flight.weaponSwitchFor = 0;
    expect(model.selectWeapon("basic")).toBe(true);
    flight.weaponSwitchFor = 0;
    flight.ammo.phaser = 0;
    expect(model.weapons()).toContainEqual({ ammo: 0, id: "phaser", selected: false });
    expect(model.selectWeapon("phaser")).toBe(false);
    expect(flight.weapon).toBe("basic");
    model.state.docked = "station";
    model.state.economy.stardust = 10;
    expect(model.buy({ kind: "ammo", weapon: "phaser" })).toEqual({ kind: "bought", price: 6 });
    expect(flight.ammo.phaser).toBe(55);
    expect(model.state.economy.stardust).toBe(4);
    model.state.docked = null;
    expect(model.selectWeapon("phaser")).toBe(true);
  });

  it("keeps every weapon's ammunition across flights and the jump home", () => {
    const model = launched();
    pickup(model, "multiLaser");
    pickup(model, "scattershot");
    const flight = model.state.flight!;
    flight.ammo.multiLaser = 123;
    flight.ammo.scattershot = 45;
    expect(flight.weapon).toBe("multiLaser");
    flight.shield = PROTOTYPE.tuning.enemyDamage;
    incoming(flight);
    model.step(0.01, idle);
    expect(model.state.mode).toBe("home");
    expect(model.state.economy.ownedWeapons).toEqual(["multiLaser", "scattershot"]);
    expect(model.state.economy.ammo).toMatchObject({ multiLaser: 123, scattershot: 45 });
    model.startSector(1);
    playOpening(model);
    expect(model.state.flight!.ammo).toMatchObject({ multiLaser: 123, scattershot: 45 });
    // Finding it again gives one pack, as for any weapon Ada owns.
    model.state.flight!.objects = [];
    pickup(model, "multiLaser");
    expect(model.state.flight!.ammo.multiLaser).toBe(123 + 200);
  });

  it("keeps a granted weapon's flight ammunition out of the economy", () => {
    const model = launched();
    expect(grantAllWeapons(model.state)).toBe(true);
    const flight = model.state.flight!;
    expect(flight.ammo).toEqual({
      heavyMissile: 150,
      multiLaser: 600,
      phaser: 165,
      rapidMissile: 600,
      scattershot: 390,
    });
    model.step(0.01, idle);
    expect(model.state.economy.ammo).toEqual(noAmmo());
    expect(restoreSave(model.save())?.flight?.ammo).toEqual(flight.ammo);
  });
});
