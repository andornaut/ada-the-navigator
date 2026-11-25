import { describe, expect, it } from "vitest";

import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { cartwheelRequiredSites } from "./cartwheelRequiredSites.ts";
import { gameAreaPoint } from "./edgeMarkers.ts";
import { worldDelta, worldPoint } from "./worldContacts.ts";

const selected = ["miner", "visitors"] as const;
const hub = { x: 10000, y: 20000 };

describe("Cartwheel required buoy sites", () => {
  it("matches the existing authored buoy positions in the renderer's projected coordinate plane", () => {
    const center = gameAreaPoint(hub, hub);
    const sites = cartwheelRequiredSites({}, hub, selected);
    const expected = [
      // The buoys stand at fractions of the docked view, less the miner's 63 px frame.
      { id: "miner", x: -245.225, y: 0 },
      { id: "visitors", x: 274.075, y: -10.85 },
    ];
    for (const [index, site] of sites.entries()) {
      const point = gameAreaPoint(hub, site);
      expect(site.id).toBe(expected[index]!.id);
      expect(site.role).toBe(site.id);
      expect(point.x - center.x).toBeCloseTo(expected[index]!.x, 8);
      expect(point.y - center.y).toBeCloseTo(expected[index]!.y, 8);
    }
  });

  it("returns only the selected identities in caller order without creating actor or reveal fields", () => {
    expect(cartwheelRequiredSites({}, hub, [])).toEqual([]);
    const sites = cartwheelRequiredSites({}, hub, ["visitors", "miner"]);
    expect(sites.map(({ id }) => id)).toEqual(["visitors", "miner"]);
    expect(cartwheelRequiredSites({}, hub, ["miner"])).toEqual([sites[1]]);
    for (const site of sites) {
      expect(Object.keys(site).sort()).toEqual(["id", "role", "x", "y"]);
    }
  });

  it("is repeatable and leaves caller inputs and canonical offsets unchanged", () => {
    const context = Object.freeze({ worldSide: GALAXY_SIDE });
    const fixedHub = Object.freeze({ ...hub });
    const ids = Object.freeze([...selected]);
    const before = structuredClone({
      context,
      hub: fixedHub,
      ids,
      offsets: CARTWHEEL_STORY_SHIPS.destinations,
    });
    const first = cartwheelRequiredSites(context, fixedHub, ids);
    expect(cartwheelRequiredSites(context, fixedHub, ids)).toEqual(first);
    expect({ context, hub: fixedHub, ids, offsets: CARTWHEEL_STORY_SHIPS.destinations }).toEqual(
      before,
    );
    expect(first[0]).not.toBe(cartwheelRequiredSites(context, fixedHub, ids)[0]);
  });

  it("translates with the supplied hub independently of any player, seed, stage or population", () => {
    const shiftedHub = { x: hub.x + 5000, y: hub.y - 7000 };
    const first = cartwheelRequiredSites({}, hub, selected);
    const shifted = cartwheelRequiredSites({}, shiftedHub, selected);
    for (const [index, site] of shifted.entries()) {
      expect(site.x - first[index]!.x).toBeCloseTo(5000, 8);
      expect(site.y - first[index]!.y).toBeCloseTo(-7000, 8);
      expect(site.id).toBe(first[index]!.id);
      expect(site.role).toBe(first[index]!.role);
    }
  });

  it("canonicalizes an explicitly wrapped hub's sites across both world seams", () => {
    const context = { worldSide: GALAXY_SIDE };
    const edgeHub = { x: GALAXY_SIDE / 2 - 50, y: -GALAXY_SIDE / 2 + 50 };
    const sites = cartwheelRequiredSites(context, edgeHub, selected);
    expect(sites[1]!.x).toBeLessThan(0);
    expect(sites[1]!.y).toBeGreaterThan(0);
    for (const site of sites) {
      expect(site.x).toBeGreaterThanOrEqual(-GALAXY_SIDE / 2);
      expect(site.x).toBeLessThan(GALAXY_SIDE / 2);
      expect(site.y).toBeGreaterThanOrEqual(-GALAXY_SIDE / 2);
      expect(site.y).toBeLessThan(GALAXY_SIDE / 2);
      const relative = worldDelta(context, edgeHub, site);
      const offset = CARTWHEEL_STORY_SHIPS.destinations[site.id];
      expect(relative.x).toBeCloseTo(offset.x, 8);
      expect(relative.y).toBeCloseTo(offset.y, 8);
      const image = worldPoint(context, edgeHub, site);
      expect(image.x - edgeHub.x).toBeCloseTo(offset.x, 8);
      expect(image.y - edgeHub.y).toBeCloseTo(offset.y, 8);
    }
  });

  it("preserves the unwrapped chart when topology is absent rather than inferring it from coordinates", () => {
    const outside = { x: GALAXY_SIDE, y: GALAXY_SIDE };
    const [site] = cartwheelRequiredSites({}, outside, ["visitors"]);
    expect(site).toEqual({
      id: "visitors",
      role: "visitors",
      x: outside.x + CARTWHEEL_STORY_SHIPS.destinations.visitors.x,
      y: outside.y + CARTWHEEL_STORY_SHIPS.destinations.visitors.y,
    });
    expect(site!.x).toBeGreaterThan(GALAXY_SIDE / 2);
    expect(site!.y).toBeGreaterThan(GALAXY_SIDE / 2);
  });
});
