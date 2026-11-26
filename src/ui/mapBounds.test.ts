import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "../model/flightTopology.ts";
import { GameModel } from "../model/game.ts";
import { landmarkSites } from "../model/landmarks.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import {
  fitRegion,
  innerRegion,
  MAP_SCREEN,
  mapImage,
  mapProjection,
  mapSurveyEllipse,
  type MapView,
  openingView,
  panView,
  type Point,
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
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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

function expectInField(view: MapView, point: Point) {
  const at = toScreen(INNER, view, point);
  expect(at.x).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(at.x).toBeLessThanOrEqual(FIELD.width + TOLERANCE);
  expect(at.y).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(at.y).toBeLessThanOrEqual(FIELD.height + TOLERANCE);
}

function surveyDistances(view: MapView) {
  const { rx, ry, x, y } = mapSurveyEllipse(INNER, view);
  return {
    farthest: Math.hypot(Math.max(x, FIELD.width - x) / rx, Math.max(y, FIELD.height - y) / ry),
    nearest: Math.hypot(
      Math.max(0, -x, x - FIELD.width) / rx,
      Math.max(0, -y, y - FIELD.height) / ry,
    ),
  };
}

function expectSurveyArc(view: MapView) {
  // Distances in ellipse space must straddle the outline. Bounding-box overlap is insufficient.
  const { farthest, nearest } = surveyDistances(view);
  expect(nearest).toBeLessThan(1);
  expect(farthest).toBeGreaterThan(1);
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
      expectSurveyArc(view);
    }
  });

  it("keeps all targets reachable at closer zooms and keeps the survey oval at minimum zoom", () => {
    const { max, min } = scaleLimits(INNER, FIELD, side);
    const firstCloser = min * MAP_SCREEN.zoomStep;
    expect(firstCloser).toBeGreaterThan(min);
    expect(firstCloser).toBeLessThan(max);
    const points = [map.player, ...map.places];
    for (const scale of [firstCloser, max]) {
      for (const point of points) {
        const start = { centre: { x: 0, y: 0 }, scale, worldSide: side };
        const view = recentreView(INNER, FIELD, point, start);
        expectInSquare(view);
        expectInField(view, point);
      }
    }

    const start = { centre: { x: 0, y: 0 }, scale: min, worldSide: side };
    const centredOn = (point: Point): MapView => ({
      ...start,
      centre: mapProjection(mapImage(start, point)),
    });
    expect(surveyDistances(centredOn(map.player)).nearest).toBeGreaterThan(1);
    let compatible = 0;
    for (const point of points) {
      const view = recentreView(INNER, FIELD, point, start);
      expectInSquare(view);
      expectSurveyArc(view);
      // A centred target and an intersecting oval provide a straightforward reach witness.
      const { farthest, nearest } = surveyDistances(centredOn(point));
      if (nearest < 1 && farthest > 1) {
        expectInField(view, point);
        compatible++;
      }
    }
    expect(compatible).toBeGreaterThan(0);
  });
});
