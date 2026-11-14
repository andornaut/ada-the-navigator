import { expect, it } from "vitest";

import {
  capitalProfile,
  HEAVY_FIRE_RATE,
  HOSTILE_STATION_SIGNATURE,
  hostileStationSignatureTiers,
  platformSignatureTiers,
  signatureLoadout,
  SMALL_CRAFT_SIGNATURES,
} from "./enemySignatures.ts";

it("states the approved small-craft weapons and heavy fire multiplier", () => {
  expect(SMALL_CRAFT_SIGNATURES).toEqual({
    fighter: "multiLaser",
    interceptor: "phaser",
    retaliator: "rapidMissile",
    swarm: "laser",
  });
  expect(HEAVY_FIRE_RATE).toBe(1.2);
});

it("keeps early capitals lance-only and late capital profiles exclusive with aft mines", () => {
  const mounts = [
    "weapon-left",
    "weapon-right",
    "weapon-rear-left",
    "weapon-rear-right",
    "claw-left",
    "claw-right",
    "stern-left",
    "stern-right",
  ];
  for (const position of [1, 2, 3, 4] as const) {
    expect(capitalProfile(position, "capital:saved")).toBe("lance");
  }
  for (const position of [5, 6] as const) {
    const profiles = new Set<string>();
    for (let index = 0; index < 16; index++) {
      const id = `capital:${index}`;
      const profile = capitalProfile(position, id);
      profiles.add(profile);
      const loadout = signatureLoadout("capital", position, id, mounts);
      const special = profile === "mine" ? "mineLayer" : "chargedLance";
      expect(loadout.get(profile === "mine" ? "stern-right" : "weapon-left")).toBe(special);
      expect([...loadout.values()].filter((weapon) => weapon === special)).toHaveLength(1);
      expect(new Set(loadout.values())).toEqual(new Set(["scattershot", special]));
      expect([...signatureLoadout("capital", position, id, mounts)]).toEqual([...loadout]);
    }
    expect([...profiles].sort()).toEqual(["lance", "mine"]);
  }
});

it("assigns exactly the provided frigate mounts without adding an engine or weapon", () => {
  expect([...signatureLoadout("frigate", 1, "frigate:saved", ["port", "starboard"])]).toEqual([
    ["port", "heavyMissile"],
    ["starboard", "laser"],
  ]);
});

it("exports approved v1 platform and station tiers with capped unused mounts", () => {
  const platforms = platformSignatureTiers();
  expect(platforms.map((tier) => tier.positions)).toEqual([
    [5, 5],
    [6, 6],
  ]);
  expect(platforms.map((tier) => Object.values(tier.mounts).filter(Boolean).length)).toEqual([
    2, 3,
  ]);
  expect(Object.keys(platforms[0]!.mounts)).toEqual(["port", "starboard", "aft"]);
  expect(platforms[0]!.mounts.aft).toBeNull();
  const stations = hostileStationSignatureTiers();
  expect(stations.map((tier) => tier.positions)).toEqual([
    [4, 4],
    [5, 5],
    [6, 6],
  ]);
  expect(stations.map((tier) => Object.values(tier.mounts).filter(Boolean).length)).toEqual([
    6, 7, 8,
  ]);
  expect(Object.keys(stations[0]!.mounts)).toEqual(
    Array.from({ length: 8 }, (_, index) => `weapon-${index}`),
  );
  expect(HOSTILE_STATION_SIGNATURE.remaining).toBe("rapidMissile");
  expect(HOSTILE_STATION_SIGNATURE.special).toEqual({ mount: "weapon-5", weapon: "ringBurst" });
});
