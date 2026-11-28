import { expect, it } from "vitest";

import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { ensureAndromedaWorld } from "./andromeda.ts";
import {
  ANDROMEDA_REDACT,
  type AndromedaRedactPlacementPort,
  andromedaRelayWaypoint,
  reserveAndromedaRedact,
  resolveAndromedaRedact,
} from "./andromedaRedact.ts";
import type { ChapterContext } from "./chapterProtocol.ts";
import { createUnpopulatedFlight, ensureDestinationAt } from "./flight.ts";
import { localMap, NO_LANDMARKS } from "./map.ts";
import { newProgress } from "./progress.ts";
import { requiredWorldOccupantsPlacementClear } from "./requiredWorldReservations.ts";
import { flightStationContext } from "./stations.ts";
import { flightWorldContext } from "./world/index.ts";

function repaired(): ChapterContext {
  const content = CONTENT;
  const flight = createUnpopulatedFlight(content, 5, 1234);
  const progress = { ...newProgress(), questComplete: true, stage: 6 };
  const context = { content, flight, progress };
  ensureAndromedaWorld(context);
  return context;
}

it("requests both stable IDs through the live clearance context and leaves a refusal uncommitted", () => {
  const context = repaired();
  const { flight, progress } = context;
  const beacon = flight.objects.find(({ id }) => id === ANDROMEDA_PLACES.beacon)!;
  const before = structuredClone(context);
  const refuse: AndromedaRedactPlacementPort = (placement, encounter) => {
    expect(placement.flight).toBe(flight);
    expect(placement.content).toBe(CONTENT);
    expect(encounter).toMatchObject({
      id: "boss:andromeda:broad-wing",
      relayId: "boss:andromeda:relay",
    });
    expect(
      requiredWorldOccupantsPlacementClear(
        { ...flightWorldContext(flight), content: CONTENT, galaxy: 5 },
        { actors: [], sites: [beacon] },
        { center: beacon, radius: CONTENT.tuning.exclusionRadius },
      ),
    ).toBe(false);
    return null;
  };
  expect(reserveAndromedaRedact(context, refuse, undefined)).toBeUndefined();
  expect(flight).toEqual(before.flight);
  expect(progress).toEqual(before.progress);

  const unexpected = () => {
    throw new Error("Placement was called outside eligible G5");
  };
  progress.questComplete = false;
  expect(reserveAndromedaRedact(context, unexpected, undefined)).toBeUndefined();
  progress.questComplete = true;
  expect(
    reserveAndromedaRedact(
      { ...context, flight: createUnpopulatedFlight(CONTENT, 4, 1234) },
      unexpected,
      undefined,
    ),
  ).toBeUndefined();
});

it.each(["defeated", "salvaged"] as const)(
  "projects one durable relay and one resolution cue when Redact is %s",
  (outcome) => {
    const context = repaired();
    const { content, flight, progress } = context;
    const { id, relayId } = ANDROMEDA_REDACT;
    // The shared owner supplies the admitted coordinates. These fixtures exercise its output port.
    const relay = { x: 8000, y: -8000 };
    const site = { x: 8000, y: -7200 };
    const active = reserveAndromedaRedact(context, () => ({ relay, site }), undefined)!;
    const relayPlaces = () =>
      localMap({
        ...flightStationContext(flight),
        catalog: ECONOMY,
        chunkSize: content.tuning.chunkSize,
        destinations: [ANDROMEDA_PLACES.beacon, ANDROMEDA_PLACES.pip],
        explored: progress.explored,
        flight,
        holodisk: null,
        job: null,
        label: (place) => place,
        landmarks: NO_LANDMARKS,
        objective: ANDROMEDA_PLACES.pip,
        progress,
        quests: { job: null, story: "", storyComplete: false },
      }).places.filter((place) => place.id === relayId);
    expect(andromedaRelayWaypoint(active)).toBeUndefined();
    expect(relayPlaces()).toEqual([]);
    expect(
      resolveAndromedaRedact(context, active, { id: "other-capital", outcome }),
    ).toBeUndefined();
    expect(
      reserveAndromedaRedact(
        context,
        () => {
          throw new Error("Already reserved");
        },
        active,
      ),
    ).toBeUndefined();

    const event = { id, outcome };
    const resolution = resolveAndromedaRedact(context, active, event)!;
    expect(resolution).toEqual({
      cue: {
        id: `${id}:resolved`,
        line: {
          speaker: "astra",
          text: "Their flight log points to a hidden relay. I've added it to the map.",
        },
      },
      discovery: { id: relayId, type: "discovered" },
      progress: { outcome, phase: "resolved", relay, site },
      relay: { ...relay, id: relayId },
    });
    const retained = JSON.parse(JSON.stringify(resolution.progress)) as typeof resolution.progress;
    expect(resolveAndromedaRedact(context, retained, event)).toBeUndefined();
    expect(andromedaRelayWaypoint(retained)).toEqual(resolution.relay);

    const waypoint = resolution.relay;
    ensureDestinationAt(content, waypoint.id, relay, flight);
    progress.known.push(resolution.discovery.id);
    expect(relayPlaces()).toEqual([
      expect.objectContaining({ ...waypoint, kind: "destination", objective: false }),
    ]);
  },
);
