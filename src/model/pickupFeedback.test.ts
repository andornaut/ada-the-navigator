import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import type { Weapon } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { GameModel } from "./game.ts";
import { gainSnapshot, itemGains } from "./itemGains.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function pickup(upgrade = false) {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  const flight = model.state.flight!;
  flight.ownedWeapons = ["multiLaser"];
  flight.weapon = "multiLaser";
  flight.weaponSwitchFor = 0;
  flight.ammo.multiLaser = 5;
  flight.objects = [
    {
      ...flight.player,
      hp: 1,
      id: "drop:1",
      kind: "pickup",
      radius: 10,
      ...(upgrade ? { upgrade: true } : { ammoPack: true }),
    },
  ];
  return model;
}

describe("applied ammo pickup feedback", () => {
  it("reports the full applied pack even when the equipped weapon fires in that frame", () => {
    const model = pickup();
    const flight = model.state.flight!;
    const before = gainSnapshot(model.state.economy.paints, model.ship);
    model.step(0.01, { ...idle, aim: { x: 1, y: 0 } });
    expect(flight.shots.length).toBeGreaterThan(0);
    const pack = ECONOMY.ammo.pack.multiLaser;
    expect(flight.ammo.multiLaser - 5).toBeLessThan(pack);
    expect(model.drainPickupFeedback()).toEqual([
      { added: pack, kind: "ammo", weapon: "multiLaser" },
    ]);
    expect(itemGains(false, before, gainSnapshot(model.state.economy.paints, model.ship))).toEqual(
      [],
    );
    expect(model.drainPickupFeedback()).toEqual([]);
    model.step(0.01, idle);
    expect(model.drainPickupFeedback()).toEqual([]);
  });

  it("reports actual fallback ammo from an upgrade pickup once", () => {
    const model = pickup(true);
    const flight = model.state.flight!;
    for (const track of ["shield", "engine", "tractor"] as const) {
      flight.levels[track] = ECONOMY.trackPrices[track].length + 1;
    }
    for (const weapon of Object.keys(ECONOMY.weaponUpgradePrices) as Weapon[]) {
      flight.levels.weapons[weapon] = ECONOMY.weaponUpgradePrices[weapon].length + 1;
    }
    model.step(0.01, idle);
    expect(model.drainPickupFeedback()).toEqual([
      { added: ECONOMY.ammo.pack.multiLaser, kind: "ammo", weapon: "multiLaser" },
    ]);
    expect(model.drainPickupFeedback()).toEqual([]);
  });

  it("does not serialize or replay queued feedback when a save resumes", () => {
    const model = pickup();
    model.step(0.01, idle);
    const save = model.save();
    const loaded = relaunch(CONTENT, save);
    expect(loaded.state.flight?.ammo.multiLaser).toBe(model.state.flight!.ammo.multiLaser);
    expect(loaded.drainPickupFeedback()).toEqual([]);
    expect(model.drainPickupFeedback().length).toBe(1);
    expect(model.save()).toBe(save);
  });

  it("discards unshown feedback when the flight ends", () => {
    const model = pickup();
    model.step(0.01, idle);
    model.returnHome();
    expect(model.state.mode).toBe("home");
    expect(model.drainPickupFeedback()).toEqual([]);
  });
});
