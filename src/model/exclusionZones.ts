import { ECONOMY } from "../data/economy.ts";
import type { GameContent } from "../data/types.ts";
import type { SpaceObject } from "./types.ts";

/** A friendly destination's or station's exclusion zone; enemy actors have none. */
export function exclusionZoneRadius(content: GameContent, object: SpaceObject): number | null {
  return object.kind === "destination"
    ? content.tuning.exclusionRadius
    : object.kind === "station"
      ? ECONOMY.station.exclusionRadius
      : null;
}
