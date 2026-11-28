import { CARTWHEEL_STORY_SHIPS } from "../../../data/storyShips.ts";
import type { Vec } from "../../types.ts";
import { type WorldContext, wrapPoint } from "../../world/index.ts";

export type CartwheelRequiredSiteId = keyof typeof CARTWHEEL_STORY_SHIPS.destinations;

export interface CartwheelRequiredSite extends Readonly<Vec> {
  readonly id: CartwheelRequiredSiteId;
  readonly role: CartwheelRequiredSiteId;
}

/** Selected buoy destinations retain their authored offsets from the caller's canonical hub. */
export function cartwheelRequiredSites(
  context: WorldContext,
  hub: Readonly<Vec>,
  ids: readonly CartwheelRequiredSiteId[],
): readonly CartwheelRequiredSite[] {
  return ids.map((id) => {
    const offset = CARTWHEEL_STORY_SHIPS.destinations[id];
    const raw = { x: hub.x + offset.x, y: hub.y + offset.y };
    const point = context.worldSide === undefined ? raw : wrapPoint(context.worldSide, raw);
    return { ...point, id, role: id };
  });
}
