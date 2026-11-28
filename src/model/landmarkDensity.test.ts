import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import { STATION_NAME_WORDS } from "../data/stationCopy.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { restoreSave, SAVE_RESTORE, SAVE_VERSION } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { ACHIEVEMENT_TOTALS } from "./achievements.ts";
import { createFlight } from "./flight/index.ts";
import { galaxyRoute, GameModel, newGameState } from "./game.ts";
import { acceptJob, type BoardContext, stationBoard } from "./jobs.ts";
import {
  chartLandmarks,
  flightLandmarkSites,
  isLandmark,
  landmarkLabel,
  landmarkSites,
} from "./landmarks.ts";
import { worldOreFieldsNear } from "./oreFields.ts";
import { retainedLandmarkSites } from "./retainedLandmarks.ts";
import { settlementsNear, stationById, stationsNear } from "./stations/index.ts";
import type { SpaceObject } from "./types.ts";

const label = (key: string) => CONTENT.labels[key] ?? "";

describe("expanded landmark placement", () => {
  it.each([1, 2, 3, 4, 5, 6] as const)("accepts the target safely in galaxy %i", (galaxy) => {
    const sites = landmarkSites(galaxy);
    expect(LANDMARK_TUNING.count).toBe(200);
    expect(LANDMARK_TUNING.radius).toBe(80000);
    expect(sites).toHaveLength(200);
    expect(sites.slice(0, 12)).toEqual(retainedLandmarkSites(galaxy));
    expect(new Set(sites.map(({ id }) => id)).size).toBe(200);
    expect(new Set(sites.map((site) => landmarkLabel(label, site))).size).toBe(200);
    for (const [index, site] of sites.entries()) {
      expect(site.id).toBe(`landmark:${galaxy}:${index}`);
      expect(Math.hypot(site.x, site.y)).toBeLessThanOrEqual(80000);
      expect(stationsNear(ECONOMY, galaxy, 1500, site)).toEqual([]);
      for (const other of sites.slice(index + 1)) {
        expect(Math.hypot(site.x - other.x, site.y - other.y)).toBeGreaterThanOrEqual(3000);
      }
      if (index < 12) {
        continue;
      }
      expect(site.nameWords).toBeDefined();
      const digits = site
        .nameWords!.split(" ")
        .map((word) => STATION_NAME_WORDS.findIndex((entry) => entry === word).toString(16))
        .join("");
      expect(Number.parseInt(digits, 16)).toBe(6 * index + galaxy - 1);
      expect(site.nameWords!.split(" ").length).toBeLessThanOrEqual(3);
      if (galaxy === 5) {
        expect(settlementsNear(ECONOMY, 1500, site)).toEqual([]);
      }
      expect(worldOreFieldsNear({}, galaxy, ORE_FIELDS.diameter / 2 + 1500, site)).toEqual([]);
    }
    const longest = [...sites].sort(
      (a, b) => landmarkLabel(label, b).length - landmarkLabel(label, a).length,
    )[0]!;
    console.info(
      "LANDMARK_COUNT",
      JSON.stringify({
        accepted: sites.length,
        galaxy,
        longest: { id: longest.id, text: landmarkLabel(label, longest) },
        retained: 12,
      }),
    );
  });

  it("keeps full display identities distinct across all six galaxies", () => {
    const names = GALAXY_NUMBERS.flatMap((galaxy) =>
      landmarkSites(galaxy).map((site) => landmarkLabel(label, site)),
    );
    expect(new Set(names).size).toBe(1200);
  });

  it.each([false, true])(
    "retains old sites while filtering only new destination conflicts (resident=%s)",
    (resident) => {
      const flight = createFlight(CONTENT, 1, 173, { known: [] });
      const sites = landmarkSites(1);
      const target = sites[12]!;
      const destinations: SpaceObject[] = [...retainedLandmarkSites(1), target].map(
        (site, index) => ({
          hp: 1,
          id: `fixture:${index}`,
          kind: "destination",
          radius: 30,
          x: site.x,
          y: site.y,
        }),
      );
      if (resident) {
        for (const object of destinations) {
          flight.world.notables[object.id] = object;
        }
      } else {
        flight.objects.push(...destinations);
      }
      const eligible = flightLandmarkSites(flight);
      expect(eligible).toHaveLength(199);
      expect(eligible.map(({ id }) => id)).not.toContain(target.id);
      expect(eligible).toContainEqual(sites[0]);
      expect(isLandmark(1, target.id)).toBe(true);
      expect(ACHIEVEMENT_TOTALS.landmarks[1]).toBe(200);
      flight.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
      for (const object of destinations) {
        object.x += GALAXY_SIDE;
      }
      expect(flightLandmarkSites(flight).map(({ id }) => id)).not.toContain(target.id);
    },
  );

  it.each([1, 2, 3, 4, 5, 6] as const)(
    "keeps every canonical goal site reachable in a fresh galaxy %i flight",
    (galaxy) => {
      const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
      // Prior-route unlock and opening acknowledgement fixture, with no target discoveries or rewards.
      model.state.unlocked = [...GALAXY_NUMBERS];
      model.state.prologueSeen = true;
      model.state.progress[galaxy].opened = true;
      model.startGalaxy(galaxy);
      model.step(1 / 60, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
      const flight = model.state.flight!;
      expect(flight.galaxy).toBe(galaxy);
      const canonical = landmarkSites(galaxy);
      const eligible = flightLandmarkSites(flight);
      console.info(
        "FRESH_LANDMARK_REACH",
        JSON.stringify({
          canonical: canonical.length,
          destinations: flight.objects
            .filter(({ kind }) => kind === "destination")
            .map(({ id, x, y }) => ({ id, x, y })),
          eligible: eligible.length,
          galaxy,
        }),
      );
      expect(eligible).toEqual(canonical);
      expect(ACHIEVEMENT_TOTALS.landmarks[galaxy]).toBe(canonical.length);
    },
  );

  it.each([1, 2, 3] as const)("keeps generated known story places clear in galaxy %i", (galaxy) => {
    const known = [...galaxyRoute(galaxy)];
    const flight = createFlight(CONTENT, galaxy, 173, { known });
    const destinations = flight.objects.filter(({ kind }) => kind === "destination");
    expect(destinations.length).toBe(known.length);
    expect(destinations.length).toBeGreaterThan(0);
    const canonical = landmarkSites(galaxy);
    expect(flightLandmarkSites(flight)).toEqual(canonical);
    console.info(
      "GENERATED_STORY_REACH",
      JSON.stringify({
        accepted: canonical.length,
        destinations: destinations.map(({ id, x, y }) => ({ id, x, y })),
        galaxy,
      }),
    );
  });

  it("offers only eligible surveys and preserves already-held tasks", () => {
    const site = landmarkSites(1)[12]!;
    const station = stationById(ECONOMY, 1, "station:0,0")!;
    const context: BoardContext = {
      galaxy: 1,
      hostiles: [],
      landmarks: [site],
      outposts: [],
      progress: { charted: [], stations: [] },
    };
    const book = newGameState();
    const board = stationBoard(context, book, station);
    const survey = board.find(({ type }) => type === "survey")!;
    expect(survey.target.id).toBe(site.id);
    expect(acceptJob(1, station.id, survey.id, book)).toBe("accepted");
    const held = structuredClone(book.tasks[1]);
    const money = book.economy.stardust;
    stationBoard({ ...context, landmarks: [] }, book, station);
    expect(book.tasks[1]).toEqual(held);
    expect(book.economy.stardust).toBe(money);
    const fresh = newGameState();
    expect(
      stationBoard({ ...context, landmarks: [] }, fresh, station).every(
        ({ type }) => type !== "survey",
      ),
    ).toBe(true);
  });

  it("round-trips canonical new chart IDs without adding reward or save fields", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.startGalaxy(1);
    const sites = landmarkSites(1);
    const money = model.state.economy.stardust;
    for (const site of sites) {
      expect(chartLandmarks(1, model.state.progress[1], site)).toEqual([site.id]);
    }
    const save = model.save();
    expect(JSON.parse(save).version).toBe(SAVE_VERSION);
    const restored = restoreSave(save)!;
    expect(restored.progress[1].charted).toEqual(sites.map(({ id }) => id));
    expect(restored.economy.stardust).toBe(money);
    expect(isLandmark(1, "landmark:1:0200")).toBe(false);
    expect(isLandmark(1, "landmark:1:200")).toBe(false);
  });
});
