import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { canRechargeShield, rechargeShield } from "./shieldRecharge.ts";
import type { FlightState } from "./types.ts";
import { noLevels, shipTuning } from "./upgrades.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function fixture(level = 1, cargo = 100, fraction = 0.5) {
  const ship = shipTuning(ECONOMY, CONTENT, { ...noLevels(), shield: level });
  const state: Parameters<typeof rechargeShield>[2] = {
    cargo,
    shield: ship.shieldMax * fraction,
    sinceDamage: 30,
  };
  const advance = (seconds: number) => {
    state.sinceDamage += seconds;
    return rechargeShield(ship, seconds, state);
  };
  return { advance, ship, state };
}
function calm(flight: FlightState): void {
  flight.objects = [];
  flight.shots = [];
  flight.dangerFor = 0;
}
function launched() {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  calm(model.state.flight!);
  return model;
}

describe("ore-funded shield recharge", () => {
  it.each([1, 2, 3])("funds a full recharge with 100 whole ore at shield level %i", (level) => {
    const { advance, ship, state } = fixture(level, 100, Number.EPSILON);
    expect(advance(ship.shieldMax / ship.shieldRechargeRate)).toBe(100);
    expect(state.shield).toBe(ship.shieldMax);
    expect(state.cargo).toBe(0);
    expect(state.shieldOreSpent).toBe(100);
    expect(state.shieldRechargeCredit).toBeCloseTo(0, 10);
    expect(advance(100)).toBe(0);
  });

  it.each([1, 2, 3])(
    "uses partial ore loads proportionally at level %i without an instant heal",
    (level) => {
      const { advance, ship, state } = fixture(level, 3);
      const before = state.shield;
      expect(advance(0.001)).toBe(1);
      expect(state.shield - before).toBeCloseTo(ship.shieldRechargeRate * 0.001, 12);
      expect(state.shieldRechargeCredit).toBeGreaterThan(0);
      advance(20);
      expect(state.shield).toBeCloseTo(before + ship.shieldMax * 0.03, 10);
      expect(state.cargo).toBe(0);
      expect(state.shieldOreSpent).toBe(3);
      expect(canRechargeShield(ship, state)).toBe(false);
    },
  );

  it.each([1, 2, 3])(
    "preserves funding and fractional HP across frame partitions at level %i",
    (level) => {
      const single = fixture(level);
      const partitioned = fixture(level);
      single.state.sinceDamage = partitioned.state.sinceDamage = 29.75;
      single.advance(7.75);
      for (let frame = 0; frame < 775; frame++) {
        partitioned.advance(0.01);
      }
      expect(partitioned.state.shield).toBeCloseTo(single.state.shield, 9);
      expect(partitioned.state.cargo).toBe(single.state.cargo);
      expect(partitioned.state.shieldOreSpent).toBe(single.state.shieldOreSpent);
      expect(partitioned.state.shieldRechargeCredit).toBeCloseTo(
        single.state.shieldRechargeCredit!,
        9,
      );
    },
  );

  it("waits the full 30 seconds after a hit before using ore or paid credit", () => {
    const { advance, state } = fixture();
    state.sinceDamage = 0;
    advance(29);
    advance(1);
    expect(state.shield).toBe(5);
    expect(state.cargo).toBe(100);
    expect(state.shieldRechargeCredit).toBeUndefined();
    advance(0.03);
    const credit = state.shieldRechargeCredit;
    state.shield--;
    state.sinceDamage = 0;
    const hp = state.shield;
    advance(30);
    expect(state.shield).toBe(hp);
    expect(state.shieldRechargeCredit).toBe(credit);
    expect(state.cargo).toBe(99);
    advance(0.03);
    expect(state.cargo).toBe(99);
    expect(state.shieldRechargeCredit).toBeLessThan(credit!);
  });

  it.each([1, 2, 3])("recharges freely only to 10 percent with no ore at level %i", (level) => {
    const { advance, ship, state } = fixture(level, 0, 0.025);
    advance(100);
    expect(state.shield).toBeCloseTo(ship.shieldMax * 0.1, 12);
    expect(state.shieldOreSpent).toBeUndefined();
    expect(state.shieldRechargeCredit).toBeUndefined();
    state.shield = ship.shieldMax * 0.35;
    advance(100);
    expect(state.shield).toBe(ship.shieldMax * 0.35);
    expect(canRechargeShield(ship, state)).toBe(false);
  });

  it("spends available ore below the free floor, then recharges to the floor for free", () => {
    const { advance, state } = fixture(1, 2, 0.01);
    advance(100);
    expect(state.cargo).toBe(0);
    expect(state.shieldOreSpent).toBe(2);
    expect(state.shield).toBe(1);
  });

  it("keeps partly used credit across an actual hit, save and resume without rebilling", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.shield = 5;
    flight.cargo = 3;
    flight.sinceDamage = 30;
    expect(stepFlight(CONTENT, 0.03, idle, flight)).toContainEqual({
      amount: 1,
      total: 1,
      type: "shieldOreSpent",
    });
    const credit = flight.shieldRechargeCredit!;
    const hp = flight.shield;
    flight.shots = [
      {
        ...flight.player,
        damage: 1,
        enemy: true,
        hitIds: [],
        id: "hit",
        life: 1,
        piercing: false,
        velocity: { x: 0, y: 0 },
      },
    ];
    stepFlight(CONTENT, 0.01, idle, flight);
    expect(flight.shield).toBe(hp - 1);
    expect(flight.sinceDamage).toBe(0);
    expect(flight.shieldRechargeCredit).toBe(credit);
    const saved = model.save();
    expect(restoreSave(saved)!.flight!.shieldRechargeCredit).toBe(credit);
    const resumed = relaunch(CONTENT, saved);
    const restored = resumed.state.flight!;
    expect(restored.shieldOreSpent).toBe(1);
    stepFlight(CONTENT, 30, idle, restored);
    expect(restored.shield).toBe(hp - 1);
    expect(restored.shieldRechargeCredit).toBe(credit);
    expect(
      stepFlight(CONTENT, 0.03, idle, restored).some(({ type }) => type === "shieldOreSpent"),
    ).toBe(false);
    expect(restored.cargo).toBe(2);
    expect(restored.shieldRechargeCredit).toBeLessThan(credit);
  });

  it("reports actual ore paid cumulatively across steps and saves for ten-ore HUD ticks", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.shield = 5;
    flight.cargo = 100;
    flight.sinceDamage = 30;
    const first = stepFlight(CONTENT, 5.4, idle, flight).filter(
      (event) => event.type === "shieldOreSpent",
    );
    expect(first).toEqual([{ amount: 9, total: 9, type: "shieldOreSpent" }]);
    const resumed = relaunch(CONTENT, model.save());
    calm(resumed.state.flight!);
    expect(stepFlight(CONTENT, 0.03, idle, resumed.state.flight!)).toContainEqual({
      amount: 1,
      total: 10,
      type: "shieldOreSpent",
    });
    expect(resumed.state.flight!.shieldOreSpent).toBe(10);
    expect(resumed.state.economy.stardust).toBe(model.state.economy.stardust);
  });

  it("retains credit and paid total between flights and reports recharge availability", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.shield = 5;
    flight.cargo = 1;
    flight.sinceDamage = 30;
    stepFlight(CONTENT, 0.03, idle, flight);
    expect(model.shieldRecharging).toBe(true);
    const credit = flight.shieldRechargeCredit;
    model.returnHome();
    model.startGalaxy(1);
    expect(model.state.flight!.shieldRechargeCredit).toBe(credit);
    expect(model.state.flight!.shieldOreSpent).toBe(1);
    expect(model.shieldRecharging).toBe(false);
    model.state.flight!.shield = 5;
    model.state.flight!.shieldRechargeCredit = 0;
    model.state.flight!.cargo = 0;
    expect(model.shieldRecharging).toBe(false);
    model.state.flight!.shield = 0.5;
    expect(model.shieldRecharging).toBe(true);
  });

  it("accepts saves without optional accounting and rejects invalid credit, paid totals and fractional ore", () => {
    const model = launched();
    const saved = JSON.parse(model.save());
    expect(restoreSave(saved)).not.toBeNull();
    for (const scope of ["flight", "economy"]) {
      for (const [key, value] of [
        ["shieldRechargeCredit", -0.001],
        ["shieldRechargeCredit", 0.011],
        ["shieldRechargeCredit", "0.001"],
        ["shieldOreSpent", -1],
        ["shieldOreSpent", 0.5],
        ["shieldOreSpent", Number.MAX_SAFE_INTEGER + 1],
        ["cargo", 0.5],
      ]) {
        const broken = structuredClone(saved);
        broken[scope][key as string] = value;
        expect(restoreSave(broken), `${scope}.${key}=${value}`).toBeNull();
      }
    }
  });
});
