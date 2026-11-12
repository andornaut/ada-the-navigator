import { describe, expect, it } from "vitest";

import { type GainSnapshot, itemGains } from "./itemGains.ts";

const BASE: GainSnapshot = {
  aboard: null,
  holodisks: 1,
  levels: { engine: 1, shield: 1, tractor: 1 },
  paints: ["classic"],
  weapons: [
    { ammo: null, id: "laser", level: 1 },
    { ammo: 40, id: "rapidMissile", level: 1 },
  ],
};

describe("item gains", () => {
  it("finds nothing when nothing changes, or when ammunition is spent or cargo delivered", () => {
    expect(itemGains(false, BASE, BASE)).toEqual([]);
    const spent = {
      ...BASE,
      weapons: [BASE.weapons[0]!, { ammo: 39, id: "rapidMissile" as const, level: 1 }],
    };
    expect(itemGains(false, BASE, spent)).toEqual([]);
    const carrying = { ...BASE, aboard: { kind: "carrying" as const, name: "spare parts" } };
    expect(itemGains(false, carrying, BASE)).toEqual([]);
  });

  it("finds a holodisk, a new weapon, an ammunition pack and what Ada newly carries, in that order", () => {
    const next: GainSnapshot = {
      ...BASE,
      aboard: { kind: "towing", name: "a scrap barge" },
      holodisks: 2,
      weapons: [
        ...BASE.weapons.slice(0, 1),
        { ammo: 240, id: "rapidMissile", level: 1 },
        { ammo: 600, id: "phaser", level: 1 },
      ],
    };
    expect(itemGains(false, BASE, next)).toEqual([
      { kind: "holodisk" },
      { kind: "weapon", weapon: "phaser" },
      { kind: "ammo", weapon: "rapidMissile" },
      { aboard: { kind: "towing", name: "a scrap barge" }, kind: "aboard" },
    ]);
  });

  it("finds an upgrade drop's weapon level, Shield, Engine or Tractor beam level and paint scheme", () => {
    const next: GainSnapshot = {
      ...BASE,
      levels: { engine: 2, shield: 3, tractor: 2 },
      paints: ["classic", "cobalt"],
      weapons: [BASE.weapons[0]!, { ammo: 40, id: "rapidMissile", level: 2 }],
    };
    expect(itemGains(false, BASE, next)).toEqual([
      { kind: "weaponLevel", level: 2, weapon: "rapidMissile" },
      { kind: "level", level: 3, track: "shield" },
      { kind: "level", level: 2, track: "engine" },
      { kind: "level", level: 2, track: "tractor" },
      { kind: "paint", scheme: "cobalt" },
    ]);
  });

  it("counts weapons, levels, paint and ammunition only as drops, never a station's purchases", () => {
    const bought: GainSnapshot = {
      ...BASE,
      levels: { ...BASE.levels, shield: 2 },
      paints: ["classic", "iris"],
      weapons: [
        { ammo: null, id: "laser", level: 2 },
        { ammo: 240, id: "rapidMissile", level: 1 },
        { ammo: 600, id: "phaser", level: 1 },
      ],
    };
    expect(itemGains(true, BASE, bought)).toEqual([]);
  });

  it("finds a new carried item when the item or how Ada holds it changes", () => {
    const parts = { ...BASE, aboard: { kind: "carrying" as const, name: "spare parts" } };
    const towing = { ...BASE, aboard: { kind: "towing" as const, name: "spare parts" } };
    expect(itemGains(false, parts, parts)).toEqual([]);
    expect(itemGains(false, parts, towing)).toEqual([{ aboard: towing.aboard, kind: "aboard" }]);
  });
});
