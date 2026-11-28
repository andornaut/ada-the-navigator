import { expect, it } from "vitest";

import {
  ANDROMEDA_REDACT,
  CARTWHEEL_CLAIM,
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "./capitalBosses.ts";
import { enemyDefinition, PHANTOM_FLAGSHIP_ID } from "./enemyCatalog.ts";
import {
  capitalProfile,
  HOSTILE_STATION_SIGNATURE,
  hostileStationHullHp,
  hostileStationSignatureTiers,
  platformSignatureTiers,
  signatureLoadout,
  SMALL_CRAFT_SIGNATURES,
} from "./enemySignatures.ts";
import { ROUTE, ROUTE_POSITION } from "./galaxies.ts";

it("states the approved small-craft weapons", () => {
  expect(SMALL_CRAFT_SIGNATURES).toEqual({
    fighter: "multiLaser",
    interceptor: "phaser",
    retaliator: "rapidMissile",
    swarm: "laser",
  });
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
      expect(new Set(loadout.values())).toEqual(new Set(["laser", "scattershot", special]));
      expect([...loadout.values()].filter((weapon) => weapon === "scattershot")).toHaveLength(2);
      expect([...signatureLoadout("capital", position, id, mounts)]).toEqual([...loadout]);
    }
    expect([...profiles].sort()).toEqual(["lance", "mine"]);
  }
});

it.each([
  [1, SUNFLOWER_CAPITAL_BOSS.id, { chargedLance: 1, rapidMissile: 1, scattershot: 2 }],
  [3, WHIRLPOOL_CAPITAL_BOSS.id, { chargedLance: 1, rapidMissile: 3 }],
  [4, NEEDLE_CADENCE.id, { heavyMissile: 3, phaser: 1, scattershot: 2 }],
  [5, ANDROMEDA_REDACT.id, { multiLaser: 2, phaser: 2, scattershot: 2 }],
  [2, CARTWHEEL_CLAIM.id, { laser: 4, mineLayer: 2, scattershot: 2 }],
  [6, PHANTOM_FLAGSHIP_ID, { chargedLance: 2, heavyMissile: 2, laser: 2, mineLayer: 2 }],
] as const)(
  "arms the authored capital in galaxy %i with its reviewed loadout",
  (galaxy, id, turrets) => {
    const guns = enemyDefinition(galaxy, "capital", id).hardpoints.filter(
      (part) => part.kind === "weapon",
    );
    expect(guns.filter((part) => part.fixed).map((part) => part.fire.weapon)).toEqual([
      "laser",
      "laser",
    ]);
    const counts = new Map<string, number>();
    for (const { fire, fixed } of guns) {
      if (!fixed) {
        counts.set(fire.weapon, (counts.get(fire.weapon) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries(counts)).toEqual(turrets);
    expect(new Set(guns.map((part) => part.fire.weapon)).size).toBeLessThanOrEqual(4);
  },
);

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

it("uses explicit station hull HP without early station tiers", () => {
  expect(ROUTE.map((galaxy) => hostileStationHullHp(ROUTE_POSITION[galaxy]))).toEqual([
    undefined,
    undefined,
    undefined,
    175,
    200,
    225,
  ]);
});
