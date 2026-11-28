import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  guideBeaconSlotAt,
  guideBeaconSlots,
  spareGuideBeacon,
  storyGuideBeaconSlot,
} from "./andromeda/guideBeacons.ts";
import { settlementById } from "./andromeda/places.ts";
import { ensureAndromedaWorld } from "./andromeda/runtime.ts";
import { createUnpopulatedFlight } from "./flight/index.ts";
import { newProgress } from "./progress.ts";

describe("Andromeda guide route", () => {
  it("places distinct alternating slots on real neighbouring outpost links, 2000 units apart", () => {
    const slots = guideBeaconSlots({ x: 0, y: 0 }, ECONOMY.station.cellSize);
    expect(slots.length).toBeGreaterThan(2);
    expect(new Set(slots.map(({ id }) => id)).size).toBe(slots.length);
    for (const slot of slots) {
      const [a, b] = slot.id.split("/");
      const from = settlementById(ECONOMY, a!)!;
      const to = settlementById(ECONOMY, b!.split(":").slice(0, 2).join(":"))!;
      const dx = slot.point.x - from.x;
      const dy = slot.point.y - from.y;
      expect(Math.hypot(dx, dy)).toBeCloseTo(2000 * (slot.index + 1), 7);
      expect(dx * (to.y - from.y) - dy * (to.x - from.x)).toBeCloseTo(0, 5);
      const spare = spareGuideBeacon(slot);
      expect(Math.hypot(spare.x - slot.point.x, spare.y - slot.point.y)).toBeCloseTo(96, 7);
      expect(
        (spare.x - slot.point.x) * slot.tangent.x + (spare.y - slot.point.y) * slot.tangent.y,
      ).toBeCloseTo(0, 7);
    }
  });

  it("uses an actual link slot for the story beacon and preserves the site's coordinates on re-entry", () => {
    const progress = newProgress();
    const start = (seed: number) => {
      const flight = createUnpopulatedFlight(CONTENT, 5, seed);
      ensureAndromedaWorld({ content: CONTENT, flight, progress });
      return flight.objects.find(({ id }) => id === "darkBeacon")!;
    };
    const beacon = start(210);
    const point = { x: beacon.x, y: beacon.y };
    expect(guideBeaconSlots(point, 1).map((slot) => slot.point)).toContainEqual(point);
    expect(start(901)).toMatchObject(point);
    expect(progress.requiredSites?.darkBeacon).toEqual(point);
  });

  it("resolves stale site coordinates to the reviewed slot without changing the quest", () => {
    const point = storyGuideBeaconSlot(CONTENT.tuning.chunkSize).point;
    const stale = { x: 71, y: 88 };
    expect(guideBeaconSlotAt(stale)).toBeUndefined();
    expect(guideBeaconSlotAt(point)?.point).toEqual(point);
    const progress = newProgress();
    progress.known.push("darkBeacon");
    progress.stage = 5;
    progress.questItem = "beaconParts";
    progress.requiredSites = { darkBeacon: stale };
    const flight = createUnpopulatedFlight(CONTENT, 5, 210);
    flight.objects.push({ ...stale, hp: 1, id: "darkBeacon", kind: "destination", radius: 30 });
    ensureAndromedaWorld({ content: CONTENT, flight, progress });
    expect(flight.objects.filter(({ id }) => id === "darkBeacon")).toEqual([
      expect.objectContaining(point),
    ]);
    expect(progress).toMatchObject({
      known: ["darkBeacon"],
      questItem: "beaconParts",
      requiredSites: { darkBeacon: point },
      stage: 5,
    });
  });
});
