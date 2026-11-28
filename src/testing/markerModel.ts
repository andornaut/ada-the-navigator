import { CONTENT } from "../data/content.ts";
import { type EdgeMarker, GAME_AREA, gameAreaPoint, inGameArea } from "../model/edgeMarkers.ts";
import { GameModel } from "../model/game.ts";
import type { FlightState } from "../model/types.ts";
import { flightWorldContext, worldPoint } from "../model/world/index.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "./launchSeeds.ts";

export function markerModel(flight: FlightState): GameModel {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, {
    dialogue: null,
    flight,
    mode: "space",
    prologueSeen: true,
    selectedGalaxy: flight.galaxy,
    started: true,
  });
  return model;
}

/** Synthetic visible fixtures explicitly acknowledge their draw; production uses actual render nodes. */
export function displayMarkerFixtures(model: GameModel): void {
  const flight = model.state.flight!;
  for (const object of flight.objects) {
    if (
      inGameArea(
        gameAreaPoint(flight.player, worldPoint(flightWorldContext(flight), flight.player, object)),
      )
    ) {
      model.markerTargetDisplayed(object.id);
    }
  }
}

/** Keep the geometry oracles expressed in their existing glyph and world-coordinate schema. */
export function markerEdges(model: GameModel): EdgeMarker[] {
  return model.targetMarkers(GAME_AREA).flatMap((marker): EdgeMarker[] => {
    const kind = marker.symbol;
    if (kind !== "enemy" && kind !== "guard" && kind !== "heavy" && kind !== "station") {
      return [];
    }
    return [
      { ...(kind === "guard" ? { bar: 1 } : {}), id: marker.id, kind, x: marker.x, y: marker.y },
    ];
  });
}
