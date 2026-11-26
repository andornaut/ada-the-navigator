import { ECONOMY } from "../data/economy.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { cartwheelRequiredSites } from "./cartwheelRequiredSites.ts";
import { closestOnSegment } from "./convex.ts";
import { ORE_FIELD_CLEAR_RADIUS, type OreField, worldOreFieldsNear } from "./oreFields.ts";
import { type StationPlacementContext, worldStationsNear } from "./stations.ts";
import type { Vec } from "./types.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";

// Search one ore-grid cell beyond the ordinary cue range when the nearby fields cannot fit.
export const CARTWHEEL_CLAIM_SEARCH_RADIUS = TARGET_MARKER_RANGE + ORE_FIELDS.cellSize;

export interface CartwheelClaimFieldContext extends StationPlacementContext {
  readonly arrivals: readonly Vec[];
  /** Maximum reach from the field centre of the proposed encounter, including pursuit. */
  readonly combatClearance: number;
  readonly flightStart: Vec;
  readonly hub: Vec;
  /** The flight owner checks actual formation fit against retained and pending occupants. */
  readonly canPlace: (field: OreField) => boolean;
}

/** Select an existing unguarded field off the required approach, without reserving or spawning it. */
export function selectCartwheelClaimField(context: CartwheelClaimFieldContext): OreField | null {
  const { arrivals, canPlace, combatClearance, flightStart, hub } = context;
  const galaxy = CARTWHEEL_STORY_SHIPS.galaxy;
  const buoys = cartwheelRequiredSites(context, hub, ["miner", "visitors"]);
  const legs = [[flightStart, hub] as const, ...buoys.map((buoy) => [hub, buoy] as const)];
  const routeClearance = Math.max(combatClearance, ORE_FIELD_CLEAR_RADIUS);
  // Match the ore-field generator's clearance from the hub, stations and arrivals.
  const fieldClearance = ORE_FIELDS.clearance + ORE_FIELDS.diameter / 2;
  const candidates = worldOreFieldsNear(context, galaxy, CARTWHEEL_CLAIM_SEARCH_RADIUS, hub)
    .filter(({ guard }) => guard === null)
    .map((field) => ({ distance: worldDistance(context, hub, field), field }))
    .sort((a, b) => a.distance - b.distance || a.field.id.localeCompare(b.field.id, "en"));

  for (const { distance, field } of candidates) {
    if (
      distance < fieldClearance ||
      arrivals.some((point) => worldDistance(context, point, field) < fieldClearance) ||
      legs.some(([from, to]) => {
        const local = worldPoint(context, from, field);
        const nearest = closestOnSegment(local, from, worldPoint(context, from, to));
        return Math.hypot(local.x - nearest.x, local.y - nearest.y) < routeClearance;
      }) ||
      worldStationsNear(context, ECONOMY, galaxy, fieldClearance, field).length > 0 ||
      !canPlace(field)
    ) {
      continue;
    }
    return field;
  }
  return null;
}
