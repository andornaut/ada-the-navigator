import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "../model/flightTopology.ts";
import { GameModel } from "../model/game.ts";
import { landmarkSites } from "../model/landmarks.ts";
import { playOpening } from "../testing/launch.ts";
import {
  fitRegion,
  innerRegion,
  MAP_SCREEN,
  type MapView,
  openingView,
  panView,
  recentreView,
  scaleLimits,
  toScreen,
  zoomView,
} from "./layout/mapScreen.ts";
import { NO_INSETS } from "./layout/playView.ts";

const GALAXIES: readonly GalaxyNumber[] = [1, 2, 3, 4, 5, 6];
const VIEW = { height: 360, width: 720 };
const FIELD = { ...VIEW, x: 0, y: 0 };
const FIT = fitRegion(NO_INSETS, VIEW);
const INNER = innerRegion(FIT);
const TOLERANCE = 1e-3;

/** Galaxy `galaxy`'s Map with Ada beside the square's corner and every landmark charted. */
function cornerMap(galaxy: GalaxyNumber) {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [...GALAXIES];
  model.startGalaxy(galaxy);
  playOpening(model);
  const flight = model.state.flight!;
  const side = CURRENT_FLIGHT_TOPOLOGY.side;
  flight.player = { x: side / 2 - 300, y: side / 2 - 300 };
  model.state.progress[galaxy].charted = landmarkSites(galaxy).map(({ id }) => id);
  return model.map!;
}

function expectInSquare(view: MapView) {
  const side = view.worldSide;
  const middle = { x: INNER.x + INNER.width / 2, y: INNER.y + INNER.height / 2 };
  expect(view.centre.x + (FIELD.x - middle.x) / view.scale).toBeGreaterThanOrEqual(
    -side - TOLERANCE,
  );
  expect(view.centre.x + (FIELD.x + FIELD.width - middle.x) / view.scale).toBeLessThanOrEqual(
    side + TOLERANCE,
  );
  expect(view.centre.y + (FIELD.y - middle.y) / view.scale).toBeGreaterThanOrEqual(
    -side / 2 - TOLERANCE,
  );
  expect(view.centre.y + (FIELD.y + FIELD.height - middle.y) / view.scale).toBeLessThanOrEqual(
    side / 2 + TOLERANCE,
  );
  expect(Math.abs(view.centre.x) / 2 + Math.abs(view.centre.y)).toBeLessThanOrEqual(
    side / 2 + TOLERANCE,
  );
}

describe.each(GALAXIES)("galaxy %i's local map", (galaxy) => {
  const map = cornerMap(galaxy);
  const side = map.worldSide!;

  it("is bounded by the square its flight wraps into", () => {
    expect(side).toBe(CURRENT_FLIGHT_TOPOLOGY.side);
    expect(map.places.length).toBeGreaterThan(0);
  });

  it("opens, pans hard to each edge and zooms out inside the square", () => {
    const opened = openingView(INNER, FIELD, side, map.places, map.player);
    expectInSquare(opened);
    for (const direction of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 2, y: 1 },
      { x: -2, y: 1 },
      { x: 2, y: -1 },
      { x: -2, y: -1 },
    ]) {
      let view = panView(INNER, FIELD, { x: -direction.x * 1e7, y: -direction.y * 1e7 }, opened);
      expectInSquare(view);
      for (let step = 0; step < 12; step++) {
        view = zoomView(INNER, FIELD, 1 / MAP_SCREEN.zoomStep, { x: 40, y: 300 }, view).view;
        expectInSquare(view);
      }
      expect(view.scale).toBeCloseTo(scaleLimits(INNER, FIELD, side).min, 9);
    }
  });

  it("keeps Ada and every discovered place reachable by panning at each zoom limit", () => {
    const { max, min } = scaleLimits(INNER, FIELD, side);
    for (const scale of [min, max]) {
      for (const point of [map.player, ...map.places]) {
        const start = { centre: { x: 0, y: 0 }, scale, worldSide: side };
        const view = recentreView(INNER, FIELD, point, start);
        expectInSquare(view);
        const at = toScreen(INNER, view, point);
        expect(at.x).toBeGreaterThanOrEqual(-TOLERANCE);
        expect(at.x).toBeLessThanOrEqual(FIELD.width + TOLERANCE);
        expect(at.y).toBeGreaterThanOrEqual(-TOLERANCE);
        expect(at.y).toBeLessThanOrEqual(FIELD.height + TOLERANCE);
      }
    }
  });
});
