import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { createEnemy } from "./ai/index.ts";
import { stationGuardSite } from "./stationGuardSite.ts";
import type { FlightState, SpaceObject } from "./types.ts";

function fixture() {
  const site: SpaceObject = {
    hp: 1,
    id: "site",
    kind: "destination",
    radius: 20,
    x: 9999,
    y: -500,
  };
  const enemy = createEnemy(
    enemyDefinition(1, "frigate", "guard"),
    { archetype: "frigate", id: "guard", packId: null, phase: 0 },
    { x: -200, y: 300 },
  );
  const guard = { enemy, routeId: site.id };
  const flight: Pick<FlightState, "objects" | "world"> = {
    objects: [site],
    world: { notables: {}, version: 1 },
  };
  return { flight, guard, site };
}

it("resolves exact loaded identity before retained state and returns the site's own canonical center", () => {
  const { flight, guard, site } = fixture();
  flight.world.notables[site.id] = null;
  flight.objects.unshift({ ...site, id: "nearest-other-site", x: 0, y: 0 });
  expect(stationGuardSite({ content: CONTENT, flight }, guard)).toEqual({
    center: { x: site.x, y: site.y },
    clearanceRadius: CONTENT.tuning.exclusionRadius,
    homeCandidate: { ...guard.enemy.home },
    id: site.id,
    status: "present",
  });
});

it("resolves a full retained friendly station without activation or array-presence assumptions", () => {
  const { flight, guard, site } = fixture();
  const station: SpaceObject = { ...site, kind: "station" };
  flight.objects = [];
  flight.world.notables[site.id] = station;
  expect(stationGuardSite({ content: CONTENT, flight }, guard)).toEqual({
    center: { x: station.x, y: station.y },
    clearanceRadius: ECONOMY.station.exclusionRadius,
    homeCandidate: { ...guard.enemy.home },
    id: site.id,
    status: "present",
  });
});

it("distinguishes explicit removal from unresolved identity and never substitutes a nearby site", () => {
  const { flight, guard, site } = fixture();
  flight.objects = [{ ...site, id: "other" }];
  expect(stationGuardSite({ content: CONTENT, flight }, guard)).toEqual({ status: "unresolved" });
  flight.world.notables[site.id] = null;
  expect(stationGuardSite({ content: CONTENT, flight }, guard)).toEqual({ status: "removed" });
  expect(stationGuardSite({ content: CONTENT, flight }, {})).toEqual({ status: "unresolved" });
  flight.world.notables[site.id] = { ...site, id: "mismatched" };
  expect(stationGuardSite({ content: CONTENT, flight }, guard)).toEqual({ status: "unresolved" });
});

it("excludes hostile actors and gives an invalid loaded association precedence over a retained site", () => {
  const { flight, guard, site } = fixture();
  const hostile: SpaceObject = { ...site, kind: "enemy" };
  flight.objects = [hostile];
  flight.world.notables[site.id] = site;
  expect(stationGuardSite({ content: CONTENT, flight }, guard)).toEqual({ status: "unresolved" });
  flight.objects = [];
  flight.world.notables[site.id] = hostile;
  expect(stationGuardSite({ content: CONTENT, flight }, guard)).toEqual({ status: "unresolved" });
});

it("returns detached, unvalidated home and center copies without mutations or random draws", () => {
  const { flight, guard, site } = fixture();
  const before = structuredClone({ flight, guard });
  const random = vi.spyOn(crypto, "getRandomValues");
  random.mockClear();
  try {
    const result = stationGuardSite({ content: CONTENT, flight }, guard);
    expect(result.status).toBe("present");
    if (result.status !== "present") {
      throw new Error("Missing site");
    }
    expect(result.homeCandidate).toEqual(guard.enemy.home);
    result.center.x += 100;
    result.homeCandidate!.y += 100;
    expect({ flight, guard }).toEqual(before);
    expect(site.x).toBe(9999);
    expect(random).not.toHaveBeenCalled();
    const withoutEnemy = stationGuardSite({ content: CONTENT, flight }, { routeId: site.id });
    expect(withoutEnemy.status === "present" && withoutEnemy.homeCandidate).toBeNull();
  } finally {
    random.mockRestore();
  }
});
