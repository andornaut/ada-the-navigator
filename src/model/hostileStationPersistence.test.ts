import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { HOSTILE_STATION_POLICY, hostileStationReward } from "../data/hostileStationPolicy.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { createUnpopulatedFlight } from "./flight.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "./flightTopology.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { escortPackId, worldRecordObjectRemoval, worldSyncFlightRegion } from "./geography.ts";
import {
  acknowledgeHostileStationIdentification,
  awardHostileStationEncounterReward,
  claimHostileStationEncounterReward,
  hostileStationEncounterIds,
  identifiedHostileStationSites,
  registerHostileStationEncounter,
  rememberHostileStationSite,
  resolveHostileStationEncounter,
  validHostileStationSites,
} from "./hostileStationPersistence.ts";
import { hostileStationPack } from "./hostileStations.ts";
import { restoreSave } from "./save.ts";
import type { SpaceObject } from "./types.ts";
import { wrapPoint } from "./worldGeometry.ts";

function fixture(galaxy: GalaxyNumber = 2) {
  const model = new GameModel(CONTENT, supportEntropy);
  model.state.selectedGalaxy = galaxy;
  model.state.unlocked = [1, galaxy];
  model.state.started = true;
  model.state.mode = "space";
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  const progress = model.state.progress[galaxy];
  progress.geography = freshGalaxyGeography(173);
  const flight = createUnpopulatedFlight(CONTENT, galaxy, 173, model.state.economy, 197);
  flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  model.state.flight = flight;
  const site = { id: `hostile-station:${galaxy}:173:0,0:0`, point: { x: 20000, y: 0 } };
  rememberHostileStationSite(progress, galaxy, site);
  const ids = hostileStationEncounterIds(site.id);
  const bodyPack = hostileStationPack(ids.bodyId),
    defenderPack = escortPackId(bodyPack);
  const actors = [ids.bodyId, ...ids.defenderIds].map((id, index): SpaceObject => {
    const archetype = index === 0 ? "hostileStation" : "swarm";
    const point = { x: site.point.x + index * 100, y: site.point.y };
    const definition = enemyActorDefinition(galaxy, archetype, id, 2);
    const enemy = createEnemy(
      definition,
      { archetype, id, packId: index ? defenderPack : bodyPack, phase: index, weaponLevel: 2 },
      point,
    );
    enemy.age = 3.5;
    enemy.primaryCooldown = 0.75;
    if (index === 0) {
      enemy.hardpoints[0]!.cooldown = 0.75;
    }
    return {
      ...point,
      enemy,
      hp: definition.hp,
      id,
      kind: "enemy",
      persistent: true,
      radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
    };
  });
  flight.objects.push(...actors);
  flight.combat = { initialPackSizes: { [bodyPack]: 1, [defenderPack]: 2 }, routeEncounters: [] };
  const body = actors[0]!;
  const encounter = registerHostileStationEncounter(progress, flight, site.id);
  return { actors, body, encounter, flight, model, progress, site };
}

describe("hostile station geography and encounter persistence", () => {
  it("keeps approved wrapped geography and first coordinates independent of site identification", () => {
    const { progress, site } = fixture();
    expect(hostileStationEncounterIds("hostile-station:2:173:0,0:0").bodyId).toBe(
      "hostile-station:2:173:0,0:0",
    );
    expect(HOSTILE_STATION_POLICY.defenders).toBe(2);
    expect(identifiedHostileStationSites(progress)).toEqual([]);
    expect(
      rememberHostileStationSite(progress, 2, { ...site, point: { x: 30000, y: 0 } }).point,
    ).toEqual(site.point);
    expect(validHostileStationSites(1, progress.hostileSites)).toBe(false);
    expect(
      validHostileStationSites(2, { [site.id]: { identified: false, point: { x: 9999, y: 0 } } }),
    ).toBe(false);
    expect(
      validHostileStationSites(2, { [site.id]: { identified: false, point: { x: 100001, y: 0 } } }),
    ).toBe(false);
    const wrapped = wrapPoint(GALAXY_SIDE, { x: GALAXY_SIDE + 20000, y: 0 });
    expect(validHostileStationSites(2, { [site.id]: { identified: false, point: wrapped } })).toBe(
      true,
    );
  });

  it("requires the loaded body's display acknowledgment and does not invent missing encounter status", () => {
    const { body, flight, progress, site } = fixture();
    const before = structuredClone(progress);
    expect(resolveHostileStationEncounter(flight, site.id)).toEqual({ body, state: "present" });
    expect(progress).toEqual(before);
    flight.objects = flight.objects.filter((actor) => actor !== body);
    flight.world.notables[body.id] = body;
    expect(acknowledgeHostileStationIdentification(progress, flight, body.id)).toBe(false);
    expect(resolveHostileStationEncounter(flight, site.id)).toEqual({ body, state: "present" });
    delete flight.world.notables[body.id];
    expect(resolveHostileStationEncounter(flight, site.id)).toEqual({ state: "unresolved" });
    flight.world.notables[body.id] = null;
    expect(resolveHostileStationEncounter(flight, site.id)).toEqual({ state: "removed" });
    delete flight.world.notables[body.id];
    flight.objects.push(body);
    expect(acknowledgeHostileStationIdentification(progress, flight, body.id)).toBe(true);
    expect(identifiedHostileStationSites(progress)).toEqual([site]);
    expect(progress.stations).toEqual([]);
    expect(progress.known).toEqual([]);
  });

  it.each([
    [5, 100],
    [2, 150],
    [6, 200],
  ] as const)(
    "pays galaxy %i first disable once for %i Stardust across save and later destruction",
    (galaxy, amount) => {
      const { body, encounter, flight, model } = fixture(galaxy);
      const wallet = model.state.economy.stardust;
      expect(hostileStationReward(galaxy)).toBe(amount);
      expect(awardHostileStationEncounterReward(model.state.economy, flight, body)).toBe(0);
      body.enemy!.disabled = true;
      expect(awardHostileStationEncounterReward(model.state.economy, flight, body)).toBe(amount);
      expect(encounter.rewarded).toBe(true);
      expect(model.state.economy.stardust).toBe(wallet + amount);
      expect(awardHostileStationEncounterReward(model.state.economy, flight, body)).toBe(0);
      const saved = restoreSave(model.save())!;
      expect(saved).toEqual(model.state);
      const restored = saved.flight!.objects.find((actor) => actor.id === body.id)!;
      restored.hp = restored.enemy!.hp = 0;
      expect(awardHostileStationEncounterReward(saved.economy, saved.flight!, restored)).toBe(0);
      expect(saved.economy.stardust).toBe(wallet + amount);
    },
  );

  it("claims the existing event amount once without also crediting the wallet", () => {
    const { body, encounter, flight, model } = fixture();
    body.enemy!.disabled = true;
    const wallet = model.state.economy.stardust;
    expect(claimHostileStationEncounterReward(flight, body)).toBe(150);
    expect(encounter.rewarded).toBe(true);
    expect(claimHostileStationEncounterReward(flight, body)).toBe(0);
    expect(awardHostileStationEncounterReward(model.state.economy, flight, body)).toBe(0);
    expect(model.state.economy.stardust).toBe(wallet);
  });

  it("pays destruction first without granting permanent knowledge or paying defenders", () => {
    const { actors, body, flight, model, progress } = fixture();
    actors[1]!.enemy!.disabled = true;
    expect(awardHostileStationEncounterReward(model.state.economy, flight, actors[1]!)).toBe(0);
    body.hp = body.enemy!.hp = 0;
    expect(awardHostileStationEncounterReward(model.state.economy, flight, body)).toBe(150);
    expect(awardHostileStationEncounterReward(model.state.economy, flight, body)).toBe(0);
    expect(identifiedHostileStationSites(progress)).toEqual([]);
  });

  it("continues full retained body and defender casualties once while fresh entry retains only geography", () => {
    const { actors, body, encounter, flight, model, progress, site } = fixture();
    acknowledgeHostileStationIdentification(progress, flight, body.id);
    body.enemy!.disabled = true;
    awardHostileStationEncounterReward(model.state.economy, flight, body);
    const casualty = actors[1]!;
    casualty.hp = casualty.enemy!.hp = 0;
    worldRecordObjectRemoval({}, CONTENT, casualty, flight);
    flight.objects = flight.objects.filter((actor) => actor !== casualty);
    worldSyncFlightRegion({}, CONTENT, flight);
    expect(flight.world.notables[casualty.id]).toBeNull();
    expect(flight.world.notables[body.id]).toEqual(body);
    const resumed = relaunch(CONTENT, model.save());
    expect(resumed.state).toEqual(model.state);
    const next = resumed.state.flight!;
    expect(registerHostileStationEncounter(resumed.state.progress[2], next, site.id)).toEqual(
      encounter,
    );
    expect(next.world.notables[casualty.id]).toBeNull();
    expect(next.world.notables[actors[2]!.id]).toEqual(actors[2]);
    expect(
      awardHostileStationEncounterReward(
        resumed.state.economy,
        next,
        next.world.notables[body.id]!,
      ),
    ).toBe(0);
    const fresh = createUnpopulatedFlight(CONTENT, 2, flight.seed, undefined, 198);
    expect(fresh.hostileStations).toBeUndefined();
    expect(resolveHostileStationEncounter(fresh, site.id)).toEqual({ state: "unresolved" });
    expect(identifiedHostileStationSites(progress)).toEqual([site]);
  });

  it("rejects malformed registered identities and preserves optional legacy absence without migration", () => {
    const { body, flight, model, progress, site } = fixture();
    const saved = model.saveDocument();
    const badReward = structuredClone(saved) as unknown as {
      flight: { hostileStations: Record<string, { rewarded: unknown }> };
    };
    badReward.flight.hostileStations[site.id]!.rewarded = "yes";
    expect(restoreSave(badReward)).toBeNull();
    const badId = structuredClone(saved);
    badId.flight!.hostileStations![site.id]!.bodyId = `${site.id}:other`;
    expect(restoreSave(badId)).toBeNull();
    const badRole = structuredClone(saved);
    badRole.flight!.objects.find((actor) => actor.id === body.id)!.routeId = "hub";
    expect(restoreSave(badRole)).toBeNull();
    const badPoint = structuredClone(saved);
    badPoint.progress[2].hostileSites![site.id]!.point.x = 0;
    expect(restoreSave(badPoint)).toBeNull();
    const home = structuredClone(saved);
    home.mode = "home";
    home.flight = null;
    expect(restoreSave(home)).toEqual(home);
    home.progress[2].geography!.seed = null;
    expect(restoreSave(home)).toBeNull();
    const absent = structuredClone(saved);
    delete absent.progress[2].hostileSites;
    delete absent.flight!.hostileStations;
    expect(restoreSave(absent)).not.toBeNull();
    expect(registerHostileStationEncounter(progress, flight, site.id)).toBe(
      flight.hostileStations![site.id],
    );
  });
});
