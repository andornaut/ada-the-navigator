import { describe, expect, it } from "vitest";

import { type GainSnapshot, itemGains } from "./item-gains.ts";

const BASE: GainSnapshot = {
  aboard: null,
  holodisks: 1,
  weapons: [
    { ammo: null, id: "laser" },
    { ammo: 40, id: "rapidMissile" },
  ],
};

describe("item gains", () => {
  it("finds nothing when nothing changes, or when ammunition is spent or cargo delivered", () => {
    expect(itemGains(false, BASE, BASE)).toEqual([]);
    const spent = {
      ...BASE,
      weapons: [BASE.weapons[0]!, { ammo: 39, id: "rapidMissile" as const }],
    };
    expect(itemGains(false, BASE, spent)).toEqual([]);
    const carrying = { ...BASE, aboard: { kind: "carrying" as const, name: "spare parts" } };
    expect(itemGains(false, carrying, BASE)).toEqual([]);
  });

  it("finds a holodisk, a new weapon, an ammunition pack and what Ada newly carries, in that order", () => {
    const next: GainSnapshot = {
      aboard: { kind: "towing", name: "a scrap barge" },
      holodisks: 2,
      weapons: [
        ...BASE.weapons.slice(0, 1),
        { ammo: 240, id: "rapidMissile" },
        { ammo: 600, id: "phaser" },
      ],
    };
    expect(itemGains(false, BASE, next)).toEqual([
      { kind: "holodisk" },
      { kind: "weapon", weapon: "phaser" },
      { kind: "ammo", weapon: "rapidMissile" },
      { aboard: { kind: "towing", name: "a scrap barge" }, kind: "aboard" },
    ]);
  });

  it("counts weapons and ammunition only as drops, never a station's purchases", () => {
    const bought: GainSnapshot = {
      ...BASE,
      weapons: [...BASE.weapons, { ammo: 600, id: "phaser" }],
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
