import { expect, it } from "vitest";

import { enemyDefinition } from "../data/enemyCatalog.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SPAWNER_POLICIES, spawnerStage } from "../data/spawnerCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { createEnemy } from "./ai/index.ts";
import {
  worldEncounterPopulationRefusal,
  worldEngagementAdmissions,
  worldFitsEncounter,
  worldFitsHostileStation,
  worldHostileStationPopulationRefusal,
  worldLocalCap,
} from "./spawn/encounters/index.ts";
import type { SpaceObject, Vec } from "./types.ts";

const policy = SPAWNER_POLICIES[6];
const stage = spawnerStage(6, 0);
const point = { x: 0, y: 0 };
function ship(
  id: string,
  archetype: "capital" | "fighter" = "fighter",
  at: Vec = point,
): SpaceObject {
  const definition = enemyDefinition(6, archetype, id);
  const enemy = createEnemy(definition, { archetype, id, packId: null, phase: 0 }, at);
  return { ...at, enemy, hp: enemy.hp, id, kind: "enemy", radius: definition.sizeRatio * 10 };
}
const station = (id: string): SpaceObject => ({
  ...point,
  hp: 1,
  id,
  kind: "station",
  radius: 100,
});

it("applies a single two-slot allowance without changing geographic caps or stacking sources", () => {
  expect(stage.localCap).toBe(6);
  const capital = ship("capital", "capital");
  const stations = [station("hostile-a"), station("hostile-b")];
  expect(worldLocalCap({}, policy, stage, 10, point, false, [])).toBe(6);
  expect(worldLocalCap({}, policy, stage, 10, point, false, [capital])).toBe(8);
  expect(
    worldLocalCap(
      { hostileStationIds: new Set(stations.map((station) => station.id)) },
      policy,
      stage,
      10,
      point,
      true,
      [capital, ...stations],
    ),
  ).toBe(8);
  expect(stage.localCap).toBe(6);
});

it("admits the complete capital group within its own allowance, retaining the one-capital limit", () => {
  const plan = {
    archetype: "capital",
    count: 1,
    escorts: { archetype: "fighter", count: 6 },
  } as const;
  expect(worldFitsEncounter({}, policy, stage, ROUTE_POSITION[6], [], point, plan)).toBe(true);
  expect(
    worldFitsEncounter({}, policy, stage, ROUTE_POSITION[6], [ship("fighter")], point, plan),
  ).toBe(true);
  expect(
    worldFitsEncounter({}, policy, stage, ROUTE_POSITION[6], [ship("a"), ship("b")], point, plan),
  ).toBe(false);
  expect(
    worldFitsEncounter(
      {},
      policy,
      stage,
      ROUTE_POSITION[6],
      [ship("capital", "capital")],
      point,
      plan,
    ),
  ).toBe(false);
  expect(plan.escorts.count).toBe(6);
});

it("reports the first population refusal in encounter and hostile station admission order", () => {
  const plan = {
    archetype: "capital",
    count: 1,
    escorts: { archetype: "fighter", count: 6 },
  } as const;
  const narrow = { ...stage, maxNearbyArchetypes: 1 };
  const capital = ship("occupied-capital", "capital");
  const refusal = (constraints: typeof stage, objects: readonly SpaceObject[]) =>
    worldEncounterPopulationRefusal(
      {},
      policy,
      constraints,
      ROUTE_POSITION[6],
      objects,
      point,
      plan,
    );
  expect(refusal(stage, [])).toBeUndefined();
  expect(refusal(narrow, [capital, ship("occupied-fighter")])).toBe("local-cap");
  expect(refusal(narrow, [capital])).toBe("archetype-cap");
  expect(refusal(stage, [capital])).toBe("capital-cap");

  const station = { defenders: 8, id: "hostile-station", reach: 10 };
  const registered = { hostileStationIds: new Set([station.id]) };
  expect(worldHostileStationPopulationRefusal({}, policy, narrow, [], point, station)).toBe(
    "unregistered-hostile-station",
  );
  expect(worldHostileStationPopulationRefusal(registered, policy, narrow, [], point, station)).toBe(
    "local-cap",
  );
  const emptyStation = { ...station, defenders: 0 };
  expect(worldFitsHostileStation(registered, policy, narrow, [], point, emptyStation)).toBe(true);
});

it("shares spawn and engagement budgets around capitals and explicit hostile stations", () => {
  for (const qualifying of ["capital", "hostileStation", "friendlyStation"] as const) {
    const old = Array.from({ length: 6 }, (_, index) => ship(`old:${index}`));
    if (qualifying === "capital") {
      old[0] = ship("capital", "capital");
    }
    old.forEach((ship) => {
      ship.enemy!.engaged = true;
    });
    const context = {
      hostileStationIds: qualifying === "hostileStation" ? new Set(["station"]) : new Set<string>(),
    };
    const candidates = [ship("waiting:a"), ship("waiting:b"), ship("waiting:c")];
    const objects = [
      ...old,
      ...candidates,
      ...(qualifying === "capital" ? [] : [station("station")]),
    ];
    const before = structuredClone(objects);
    const admitted = worldEngagementAdmissions(
      context,
      policy,
      stage,
      objects,
      new Set(candidates.map((ship) => ship.id)),
      point,
    );
    expect(candidates.filter((ship) => admitted.has(ship.id))).toHaveLength(
      qualifying === "friendlyStation" ? 0 : 2,
    );
    expect(
      worldFitsEncounter(
        context,
        policy,
        stage,
        ROUTE_POSITION[6],
        [...old, ...objects.filter((object) => object.kind === "station")],
        point,
        { archetype: "fighter", count: 2 },
      ),
    ).toBe(qualifying !== "friendlyStation");
    expect(
      worldFitsEncounter(
        context,
        policy,
        stage,
        ROUTE_POSITION[6],
        [...old, ...objects.filter((object) => object.kind === "station")],
        point,
        { archetype: "fighter", count: 3 },
      ),
    ).toBe(false);
    expect(objects).toEqual(before);
  }
});

it("uses the existing inclusive neighbourhood boundary and shortest wrapping distance", () => {
  const reach = 10;
  const capital = ship("capital", "capital");
  const boundary = policy.localRadius * 2 + reach + capital.radius;
  capital.x = boundary;
  expect(worldLocalCap({}, policy, stage, reach, point, false, [capital])).toBe(8);
  capital.x++;
  expect(worldLocalCap({}, policy, stage, reach, point, false, [capital])).toBe(6);
  const centre = { x: GALAXY_SIDE / 2 - 10, y: 0 };
  capital.x = -GALAXY_SIDE / 2 + 10;
  expect(
    worldLocalCap({ worldSide: GALAXY_SIDE }, policy, stage, reach, centre, false, [capital]),
  ).toBe(8);
  expect(worldLocalCap({}, policy, stage, reach, centre, false, [capital])).toBe(6);
});

it("does not grant a frigate an allowance or use destroyed and salvaged capitals", () => {
  const frigateDefinition = enemyDefinition(6, "frigate", "frigate");
  const frigate = {
    ...ship("frigate"),
    enemy: createEnemy(
      frigateDefinition,
      { archetype: "frigate", id: "frigate", packId: null, phase: 0 },
      point,
    ),
  };
  const capital = ship("capital", "capital");
  capital.enemy!.salvaged = true;
  expect(worldLocalCap({}, policy, stage, 10, point, false, [frigate, capital])).toBe(6);
  capital.enemy!.salvaged = false;
  capital.hp = 0;
  expect(worldLocalCap({}, policy, stage, 10, point, false, [capital])).toBe(6);
});
