import { expect, it } from "vitest";

import { CONTENT } from "../../data/content.ts";
import { TARGET_MARKER_RANGE } from "../../data/targetMarkers.ts";
import { GALAXY_SIDE } from "../../data/world.ts";
import { SAVE_RESTORE } from "../../saving/index.ts";
import { relaunch, supportEntropy } from "../../testing/launch.ts";
import { placeExplorationSite, recoverExplorationWreck, salvage, wreckId } from "../flight.ts";
import { GameModel } from "../game.ts";
import { proceduralPoisNear } from "../proceduralPois.ts";
import type { FlightEvent, SpaceObject } from "../types.ts";
import { hit } from "./hitResolution.ts";

function admittedWreck() {
  const seed = 31;
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 5];
  const progress = model.state.progress[5];
  progress.geography = { seed, sitePolicy: "seeded", version: 1 };
  model.startGalaxy(5);
  const flight = model.state.flight!;
  const beacon = progress.requiredSites!.darkBeacon!;
  const center = { x: beacon.x / 2, y: beacon.y / 2 };
  const opportunityEligibility = { jobTemplates: [] };
  const candidate = proceduralPoisNear(
    { opportunityEligibility, worldSide: GALAXY_SIDE },
    5,
    seed,
    TARGET_MARKER_RANGE,
    center,
  ).find((site) => site.opportunity.kind === "salvage")!;
  expect(candidate).toBeDefined();
  flight.player = { x: candidate.x - CONTENT.tuning.talkRange / 2, y: candidate.y };
  const site = placeExplorationSite(CONTENT, flight, {
    admitted: {},
    canPostLead: () => false,
    inRegion: (point) => Math.hypot(point.x - candidate.x, point.y - candidate.y) < 1,
    opportunityEligibility,
    protectedSites: [],
  });
  expect(site?.id).toBe(candidate.id);
  progress.explorationSites = { [candidate.id]: { kind: "salvage", scanned: false } };
  const wreck = flight.objects.find(({ id }) => id === `${candidate.id}:salvage`)!;
  expect(wreck.enemy).toMatchObject({ archetype: "frigate", disabled: true, salvaged: false });
  return { candidate, flight, model, wreck };
}

it("keeps a real admitted wreck inert and protected on the first step after Continue", () => {
  const { candidate, model, wreck } = admittedWreck();
  const resumed = relaunch(CONTENT, model.save());
  const flight = resumed.state.flight!;
  const saved = flight.objects.find(({ id }) => id === wreck.id)!;
  expect(saved).toEqual(wreck);
  const before = structuredClone(saved);
  resumed.step(0.05, { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false });
  const events: FlightEvent[] = [];
  hit(CONTENT, 999, null, saved, flight, events);
  expect(saved).toEqual(before);
  expect(flight.objects).toContain(saved);
  expect(flight.objects.some(({ id }) => id === wreckId(saved.id))).toBe(false);
  expect(events).toEqual([]);
  expect(recoverExplorationWreck(CONTENT, flight, candidate.id)).toBe(true);
  expect(saved.enemy?.salvaged).toBe(true);
  const retained = relaunch(CONTENT, resumed.save()).state.flight!;
  expect(retained.objects.find(({ id }) => id === saved.id)).toEqual(saved);
  expect(recoverExplorationWreck(CONTENT, retained, candidate.id)).toBe(false);
});

it("rejects wrong identities and preserves the exact legacy payout for the requested wreck", () => {
  const { candidate, flight, wreck } = admittedWreck();
  const legacy = structuredClone(flight);
  expect(salvage(CONTENT, legacy)).toBe(true);
  const nearer: SpaceObject = structuredClone(wreck);
  nearer.id = nearer.enemy!.id = "poi:5:999999,999999:0:salvage";
  nearer.x = flight.player.x;
  nearer.y = flight.player.y;
  flight.objects.unshift(nearer);
  const before = structuredClone(flight);
  expect(recoverExplorationWreck(CONTENT, flight, "poi:5:999999,999999:0")).toBe(false);
  expect(recoverExplorationWreck(CONTENT, flight, wreck.id)).toBe(false);
  expect(flight).toEqual(before);
  expect(recoverExplorationWreck(CONTENT, flight, candidate.id)).toBe(true);
  expect(nearer.enemy?.salvaged).toBe(false);
  flight.objects.shift();
  expect(flight).toEqual(legacy);
  expect(recoverExplorationWreck(CONTENT, flight, candidate.id)).toBe(false);
  expect(flight).toEqual(legacy);
});
