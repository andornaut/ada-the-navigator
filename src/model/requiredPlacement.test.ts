import { expect, it } from "vitest";

import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { CURRENTS } from "../data/galaxyFeatures.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { worldInCurrent } from "./currents.ts";
import { createUnpopulatedFlight, planRequiredWhirlpoolRoutes } from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { readRequiredRolePlan } from "./requiredRolePlans.ts";
import { flightWorldContext, worldDistance } from "./world/index.ts";

const ids = ["whale", "family", "holodisk"] as const;

it("keeps production Whirlpool reservations stable without publishing actors or moving saved sites", () => {
  const plan = () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    const flight = createUnpopulatedFlight(CONTENT, 3, 1, model.state.economy, 2);
    flight.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
    const progress = model.state.progress[3];
    const before = structuredClone(flight);
    planRequiredWhirlpoolRoutes(CONTENT, progress, flight, ids);
    const { requiredPlans, ...live } = flight;
    expect(live).toEqual(before);
    expect(progress.known).toEqual([]);
    const world = flightWorldContext(flight);
    const sites = ids.map((id) => {
      const reservation = readRequiredRolePlan(flight, id)!;
      const { x, y } = reservation.site;
      expect(progress.requiredSites?.[id]).toEqual({ x, y });
      expect(worldInCurrent(world, 3, CURRENTS.clearance, reservation.site)).toBe(false);
      expect(reservation.actors.find((actor) => actor.routeId === id)?.id).toBe(
        id === "holodisk" ? WHIRLPOOL_CAPITAL_BOSS.id : `route:${id}`,
      );
      return reservation.site;
    });
    for (const [index, site] of sites.entries()) {
      for (const other of sites.slice(index + 1)) {
        expect(worldDistance(world, site, other)).toBeGreaterThanOrEqual(
          CONTENT.tuning.storySpacing,
        );
      }
    }
    const beforeRetry = structuredClone(progress.requiredSites);
    planRequiredWhirlpoolRoutes(CONTENT, progress, flight, ids);
    expect(progress.requiredSites).toEqual(beforeRetry);
    expect(flight.requiredPlans).toBe(requiredPlans);
    return requiredPlans;
  };
  expect(plan()).toEqual(plan());
});
