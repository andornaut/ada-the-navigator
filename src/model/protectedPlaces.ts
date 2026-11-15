import { ECONOMY } from "../data/economy.ts";
import type { GameContent } from "../data/types.ts";
import type { SpaceObject } from "./types.ts";

/** Enemy actors never provide a friendly protected-place radius. */
export function protectedRadius(content: GameContent, object: SpaceObject): number | null {
  return object.kind === "destination"
    ? content.tuning.safeRadius
    : object.kind === "station"
      ? ECONOMY.station.safeRadius
      : null;
}
