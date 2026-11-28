import { expect, it } from "vitest";

import ring from "../../public/art/andromeda/enemies/hostileStationGarnet-hardpoints.json" with { type: "json" };
import garnetManifest from "../../public/art/andromeda/manifest.json" with { type: "json" };
import claimStation from "../../public/art/cartwheel/enemies/hostileStationClaim-hardpoints.json" with { type: "json" };
import claimManifest from "../../public/art/cartwheel/manifest.json" with { type: "json" };
import coralStation from "../../public/art/enemies/hostileStationCoral-hardpoints.json" with { type: "json" };
import coralManifest from "../../public/art/manifest.json" with { type: "json" };
import {
  composeEnemy,
  enemyArt,
  type EnemyFrame,
  enemyFrameSets,
  selectEnemyFrame,
} from "../art/index.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { ENEMY_DISPLAY_SCALE, MUZZLE_ART } from "../data/enemyMuzzles.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { HOSTILE_LOCAL_ALLOWANCE, SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { createEnemy, damageEnemy, stepEnemy } from "./ai/index.ts";
import { fromScreen, partsReach, worldParts } from "./convex.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { createFlight, spawnPlannedHostileStation } from "./flight/index.ts";
import {
  worldActivateFlightRegion,
  worldRecordObjectRemoval,
  worldSyncFlightRegion,
} from "./geography.ts";
import { hostileStationContext, type PlannedHostileStation } from "./hostileStations/placement.ts";
import { drawnIndex } from "./muzzles.ts";
import { worldRegionalEngagementAdmissions, worldSpawnerStage } from "./spawn/encounters/index.ts";
import type { FlightState } from "./types.ts";
import { flightWorldContext } from "./world/index.ts";

const plan: PlannedHostileStation = {
  defenders: [
    { id: "equipment:1", point: { x: 5650, y: 300 } },
    { id: "equipment:2", point: { x: 6350, y: 300 } },
  ],
  id: "equipment:0",
  point: { x: 6000, y: 0 },
};
function flight(galaxy: GalaxyNumber = 5, epoch = 71): FlightState {
  const result = createFlight(CONTENT, galaxy, 173, { known: [] }, undefined, epoch);
  result.objects = [];
  result.world = { notables: {}, version: 1 };
  result.player = { x: 6000, y: 1200 };
  return result;
}
function occupied(f: FlightState, count: number): void {
  for (let index = 0; index < count; index++) {
    const id = `occupied:${index}`;
    const point = { x: 7200 + index * 40, y: 0 };
    const definition = enemyActorDefinition(f.galaxy, "fighter", id);
    f.objects.push({
      ...point,
      enemy: createEnemy(definition, { archetype: "fighter", id, packId: null, phase: 0 }, point),
      hp: definition.hp,
      id,
      kind: "enemy",
      radius: CONTENT.tuning.flight.shipRadius,
    });
  }
}
function create(f: FlightState, subject = plan) {
  const result = spawnPlannedHostileStation(CONTENT, f, subject);
  expect(result.status).toBe("created");
  if (result.status !== "created") {
    throw Error("station fixture admission failed");
  }
  return result;
}

it("materializes one persistent body and only the explicit swarm plan, then repeats without side effects", () => {
  const f = flight();
  const result = create(f);
  expect([result.station.kind, result.station.enemy?.archetype, result.station.hp]).toEqual([
    "enemy",
    "hostileStation",
    175,
  ]);
  const outline = enemyPhysicalBody(ROUTE_POSITION[f.galaxy], result.station.enemy!)!;
  expect(result.station.radius).toBe(partsReach(worldParts(outline)));
  expect(result.station.radius).toBeGreaterThan(7 * CONTENT.tuning.flight.shipRadius);
  expect(result.station.enemy?.hardpoints).toHaveLength(6);
  expect(result.defenders.map(({ id }) => id)).toEqual(plan.defenders.map(({ id }) => id));
  expect(
    result.defenders.every(
      (actor) => actor.enemy?.archetype === "swarm" && actor.enemy.escortOf === null,
    ),
  ).toBe(true);
  expect(f.objects.every((actor) => actor.persistent && actor.routeId === undefined)).toBe(true);
  expect(
    f.objects.every((actor) => actor.enemy?.weaponLevel === 1 || actor.enemy?.weaponLevel === 2),
  ).toBe(true);
  expect(f.objects).toHaveLength(3);
  const before = structuredClone(f);
  expect(spawnPlannedHostileStation(CONTENT, f, plan).status).toBe("existing");
  expect(f).toEqual(before);
});

it("uses the same nonstacking station allowance for whole-plan spawn and sight engagement", () => {
  const f = flight();
  occupied(f, 4);
  const stage = worldSpawnerStage(flightWorldContext(f), SPAWNER_POLICIES[5], plan.point);
  expect(stage.localCap).toBe(5);
  create(f);
  expect(f.objects).toHaveLength(stage.localCap + HOSTILE_LOCAL_ALLOWANCE);
  const context = hostileStationContext(f);
  expect(context.hostileStationIds).toEqual(new Set([plan.id]));
  const eligible = new Set(f.objects.map(({ id }) => id));
  expect(
    worldRegionalEngagementAdmissions(context, SPAWNER_POLICIES[5], f.objects, eligible, plan.point)
      .size,
  ).toBe(7);
  expect(
    worldRegionalEngagementAdmissions(
      { ...context, hostileStationIds: new Set() },
      SPAWNER_POLICIES[5],
      f.objects,
      eligible,
      plan.point,
    ).size,
  ).toBe(5);
  const over = flight();
  occupied(over, 5);
  const before = structuredClone(over);
  expect(spawnPlannedHostileStation(CONTENT, over, plan).status).toBe("rejected");
  expect(over).toEqual(before);
});

it("rejects whole footprints at friendly protection, outer hulls and overlapping members", () => {
  const friendly = flight();
  friendly.objects.push({
    hp: 1,
    id: "friendly",
    kind: "station",
    radius: ECONOMY.station.radius,
    x: plan.point.x + ECONOMY.station.exclusionRadius + 1,
    y: 0,
  });
  expect(hostileStationContext(friendly).hostileStationIds?.size).toBe(0);
  const before = structuredClone(friendly);
  expect(spawnPlannedHostileStation(CONTENT, friendly, plan).status).toBe("rejected");
  expect(friendly).toEqual(before);

  const blocked = flight();
  const definition = enemyActorDefinition(5, "hostileStation", plan.id);
  const state = createEnemy(
    definition,
    { archetype: "hostileStation", id: plan.id, packId: null, phase: 0 },
    plan.point,
  );
  const body = enemyPhysicalBody(ROUTE_POSITION[5], state)!;
  const edge = worldParts(body)
    .flat()
    .toSorted((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y))[0]!;
  expect(Math.hypot(edge.x, edge.y)).toBeGreaterThan(7 * CONTENT.tuning.flight.shipRadius);
  blocked.objects.push({
    hp: 10,
    id: "rock",
    kind: "rock",
    radius: 2,
    x: plan.point.x + edge.x,
    y: plan.point.y + edge.y,
  });
  const blockedBefore = structuredClone(blocked);
  expect(spawnPlannedHostileStation(CONTENT, blocked, plan).status).toBe("rejected");
  expect(blocked).toEqual(blockedBefore);
  // A defender at the station's centre overlaps it only where the drawn hull covers the centre.
  const covers = worldParts(body).some((part) => {
    const sides = part.map((a, index) => {
      const b = part[(index + 1) % part.length]!;
      return Math.sign((b.x - a.x) * -a.y - (b.y - a.y) * -a.x);
    });
    return sides.every((side) => side >= 0) || sides.every((side) => side <= 0);
  });
  const center = flight();
  expect(
    spawnPlannedHostileStation(CONTENT, center, {
      ...plan,
      defenders: [{ ...plan.defenders[0]!, point: plan.point }, plan.defenders[1]!],
    }).status,
  ).toBe(covers ? "rejected" : "created");
  const overlap = flight();
  const overlapBefore = structuredClone(overlap);
  expect(
    spawnPlannedHostileStation(CONTENT, overlap, {
      ...plan,
      defenders: [
        { ...plan.defenders[0]!, point: { x: plan.point.x + edge.x, y: plan.point.y + edge.y } },
        plan.defenders[1]!,
      ],
    }).status,
  ).toBe("rejected");
  expect(overlap).toEqual(overlapBefore);
});

it("pages damaged state once and retains casualties and removal without rewards", () => {
  const f = flight();
  const { defenders, station } = create(f);
  const definition = enemyActorDefinition(
    f.galaxy,
    "hostileStation",
    station.id,
    station.enemy!.weaponLevel,
  );
  const mount = station.enemy!.hardpoints.find(({ id }) => id === "weapon-0")!;
  const hp = station.hp;
  station.enemy = damageEnemy(definition, { amount: 7, hardpointId: mount.id }, station.enemy!);
  station.hp = station.enemy.hp;
  expect(station.hp).toBe(hp - 7);
  expect(station.enemy.hardpoints.find(({ id }) => id === mount.id)).toEqual(mount);
  const lost = defenders[0]!;
  lost.hp = 0;
  lost.enemy!.hp = 0;
  worldRecordObjectRemoval(flightWorldContext(f), CONTENT, lost, f);
  f.objects = f.objects.filter((object) => object.id !== lost.id);
  const saved = structuredClone(station);
  f.player = { x: 0, y: 0 };
  worldSyncFlightRegion(flightWorldContext(f), CONTENT, f);
  expect(f.world.notables[station.id]).toEqual(saved);
  expect(f.world.notables[lost.id]).toBeNull();
  expect(f.combat?.unloadedPackMembers).toBeUndefined();
  f.player = { x: plan.point.x, y: plan.point.y + 1200 };
  worldActivateFlightRegion(flightWorldContext(f), CONTENT, plan.point, f);
  const resumed = spawnPlannedHostileStation(CONTENT, f, plan);
  expect(resumed.status).toBe("existing");
  if (resumed.status !== "existing") {
    throw Error("retained station disappeared");
  }
  expect(resumed.station).toEqual(saved);
  expect(resumed.defenders.map(({ id }) => id)).toEqual([defenders[1]!.id]);
  expect(f.objects.filter(({ id }) => id === station.id)).toHaveLength(1);
  expect(resumed.station.enemy!.disabled).toBe(false);
  expect(resumed.station.hp).toBe(hp - 7);
  station.enemy = damageEnemy(definition, { amount: 999, hardpointId: null }, station.enemy!);
  station.hp = station.enemy.hp;
  expect(station.hp).toBe(0);
  worldRecordObjectRemoval(flightWorldContext(f), CONTENT, station, f);
  expect(spawnPlannedHostileStation(CONTENT, f, plan).status).toBe("removed");
  expect(f.objects.some(({ kind }) => kind === "pickup" || kind === "wreck")).toBe(false);
});

it("keeps wrapped placement physical and fresh encounter rolls separate from the unchanged world seed", () => {
  const wrapped = flight(6);
  wrapped.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
  const x = GALAXY_SIDE / 2 - 100;
  wrapped.player = { x, y: 1200 };
  const seam = {
    ...plan,
    defenders: [
      { id: plan.defenders[0]!.id, point: { x: x - 350, y: 300 } },
      { id: plan.defenders[1]!.id, point: { x: x + 350, y: 300 } },
    ],
    point: { x, y: 0 },
  };
  const atSeam = create(wrapped, seam);
  expect(atSeam.defenders[1]!.x).toBeLessThan(0);
  const a = flight(6, 71),
    b = flight(6, 72);
  create(a);
  create(b);
  expect(a.seed).toBe(b.seed);
  expect(a.objects.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
    b.objects.map(({ id, x, y }) => ({ id, x, y })),
  );
  // This fixed seed pair witnesses a new roll; fresh entries can also roll the same level.
  expect(a.objects.map((object) => object.enemy!.weaponLevel)).not.toEqual(
    b.objects.map((object) => object.enemy!.weaponLevel),
  );
});

it("rejects unsupported galaxies and invalid plans before mutation, and never reconstructs unresolved bodies", () => {
  for (const galaxy of [1, 3, 4] as const) {
    const f = flight(galaxy);
    const before = structuredClone(f);
    expect(spawnPlannedHostileStation(CONTENT, f, plan).status).toBe("rejected");
    expect(f).toEqual(before);
  }
  for (const invalid of [
    { ...plan, point: { x: Number.NaN, y: 0 } },
    { ...plan, defenders: [plan.defenders[0]!] },
    { ...plan, defenders: [plan.defenders[0]!, plan.defenders[0]!] },
  ]) {
    const f = flight();
    const before = structuredClone(f);
    expect(spawnPlannedHostileStation(CONTENT, f, invalid).status).toBe("rejected");
    expect(f).toEqual(before);
  }
  const unresolved = flight();
  unresolved.combat = {
    initialPackSizes: { [`hostile-station:${plan.id}`]: 1 },
    routeEncounters: [],
  };
  const before = structuredClone(unresolved);
  expect(spawnPlannedHostileStation(CONTENT, unresolved, plan).status).toBe("unresolved");
  expect(unresolved).toEqual(before);
});

it.each([
  [2, "hostileStation", 7, claimManifest, claimStation, "enemy-claim-"],
  [5, "hostileStationAndromeda", 6, garnetManifest, ring, "enemy-garnet-"],
  [6, "hostileStationPhantom", 8, coralManifest, coralStation, "enemy-"],
] as const)(
  "uses the selected galaxy %i family for every firing mount",
  (galaxy, key, count, manifest, sidecar, prefix) => {
    const definition = enemyActorDefinition(galaxy, "hostileStation", plan.id, 1);
    expect(definition.assetKey).toBe(key);
    const enemy = createEnemy(
      definition,
      { archetype: "hostileStation", id: plan.id, packId: null, phase: 0, weaponLevel: 1 },
      plan.point,
    );
    // Observe a complete longest interval so every phased mount can fire.
    const interval = Math.max(
      ...definition.hardpoints.flatMap((part) =>
        part.kind === "weapon" ? [part.fire.interval] : [],
      ),
    );
    const intent = stepEnemy(
      definition,
      {
        adaWidth: CONTENT.tuning.flight.shipRadius * 2,
        dt: interval,
        inPlayView: true,
        initialPackSizes: {},
        lead: 1,
        peers: [enemy],
        player: { x: plan.point.x + 300, y: plan.point.y },
        playerVelocity: { x: 0, y: 0 },
        routePosition: 1,
        targetable: true,
        visibility: "visible",
      },
      enemy,
    );
    const art = MUZZLE_ART[key]!;
    const assets = manifest.assets as readonly EnemyFrame[];
    const renderer = enemyArt(
      () => undefined,
      () => sidecar,
      new Set(["hostileStation"]),
      assets,
      enemyFrameSets(assets, prefix),
      prefix,
    ).get("hostileStation")!;
    const frame = selectEnemyFrame(renderer, enemy.facing);
    expect(frame.displayWidth).toBe(sidecar.frame * ENEMY_DISPLAY_SCALE);
    const sprites = composeEnemy(
      renderer,
      {
        aim: (id) => intent.state.hardpoints.find((part) => part.id === id)?.aim ?? enemy.facing,
        intact: () => true,
        position: ROUTE_POSITION[galaxy],
        weapon: (id) => {
          const part = definition.hardpoints.find((part) => part.id === id);
          return part?.kind === "weapon" ? part.fire.weapon : undefined;
        },
      },
      frame,
    );
    // A mount the hull hides at this heading draws no top and still fires.
    const firing = new Set(intent.fire.map(({ hardpointId }) => hardpointId));
    expect(firing.size).toBe(count);
    const placed = renderer.parts!.layout.headings[frame.directionIndex!]!.parts;
    expect(
      sprites.filter(({ layer }) => layer === "top").map(({ hardpoint }) => hardpoint),
    ).toEqual(expect.arrayContaining([...firing].filter((id) => !placed.get(id!)!.hidden)));
    expect(sprites.filter(({ layer }) => layer === "top")).toHaveLength(
      [...firing].filter((id) => !placed.get(id!)!.hidden).length,
    );
    const ringShots = intent.fire.filter((shot) => shot.weapon === "ringBurst");
    expect(ringShots).toHaveLength(8);
    for (const shot of ringShots) {
      const radius = CONTENT.tuning.flight.shipRadius * definition.sizeRatio;
      expect(shot.hardpointId).toBe("weapon-5");
      expect(shot.origin).toEqual({
        x: plan.point.x + shot.aim.x * radius,
        y: plan.point.y + shot.aim.y * radius,
      });
    }
    for (const shot of intent.fire.filter(({ weapon }) => weapon !== "ringBurst")) {
      const id = shot.hardpointId!;
      const mount = art.weaponTops.get(shot.weapon)!;
      const heading = drawnIndex(enemy.facing);
      const aim = drawnIndex(intent.state.hardpoints.find((part) => part.id === id)!.aim!);
      const pivot = art.pivots.get(id)![heading]!;
      const tips = art.tops.get(mount.top)![mount.aft ? (heading + 8) % 16 : aim]!;
      const tip = tips[shot.volley % tips.length]!;
      const offset = { x: pivot.x * ENEMY_DISPLAY_SCALE, y: pivot.y * ENEMY_DISPLAY_SCALE };
      // A hidden mount draws no top; its shots still leave from its pivot.
      const top = sprites.find((sprite) => sprite.layer === "top" && sprite.hardpoint === id);
      if (top) {
        expect(top.offset).toEqual(offset);
      } else {
        expect(placed.get(id)!.hidden).toBe(true);
      }
      const delta = fromScreen({
        x: offset.x + tip.x * ENEMY_DISPLAY_SCALE,
        y: offset.y + tip.y * ENEMY_DISPLAY_SCALE,
      });
      expect(shot.origin.x).toBeCloseTo(plan.point.x + delta.x, 9);
      expect(shot.origin.y).toBeCloseTo(plan.point.y + delta.y, 9);
    }
  },
);
