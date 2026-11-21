import { ECONOMY } from "../data/economy.ts";
import { settlementsNear } from "./andromedaPlaces.ts";
import type { Vec } from "./types.ts";

const SPACING = 2000;
const SPARE_OFFSET = 96;
const CELL = ECONOMY.station.cellSize;
const LINK_REACH = 2 * CELL;

export interface GuideBeaconSlot {
  readonly id: string;
  readonly index: number;
  readonly point: Vec;
  readonly tangent: Vec;
}

/** Each settlement links to its closest neighbouring settlement within two placement cells. */
export function guideBeaconSlots(centre: Vec, radius: number): GuideBeaconSlot[] {
  const sites = settlementsNear(ECONOMY, radius + 2 * LINK_REACH, centre);
  const links = new Set<string>();
  const slots: GuideBeaconSlot[] = [];
  const distance = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);
  for (const site of sites) {
    if (distance(centre, site) > radius + LINK_REACH) {
      continue;
    }
    let neighbour: (typeof sites)[number] | undefined;
    let closest = LINK_REACH;
    for (const candidate of sites) {
      if (candidate === site) {
        continue;
      }
      const gap = distance(site, candidate);
      if (gap < closest || (gap === closest && (!neighbour || candidate.id < neighbour.id))) {
        neighbour = candidate;
        closest = gap;
      }
    }
    if (!neighbour) {
      continue;
    }
    const [from, to] = site.id < neighbour.id ? [site, neighbour] : [neighbour, site];
    const id = `${from.id}/${to.id}`;
    if (links.has(id)) {
      continue;
    }
    links.add(id);
    const tangent = { x: (to.x - from.x) / closest, y: (to.y - from.y) / closest };
    for (let index = 0, along = SPACING; along < closest; index++, along += SPACING) {
      const point = { x: from.x + along * tangent.x, y: from.y + along * tangent.y };
      if (distance(centre, point) <= radius) {
        slots.push({ id: `${id}:${index}`, index, point, tangent });
      }
    }
  }
  return slots;
}

/** A stable local query cell covers its corners and the full projected view. */
export function guideBeaconCell(point: Vec): { key: string; slots: GuideBeaconSlot[] } {
  const x = Math.floor(point.x / SPACING);
  const y = Math.floor(point.y / SPACING);
  return {
    key: `${x},${y}`,
    slots: guideBeaconSlots({ x: (x + 0.5) * SPACING, y: (y + 0.5) * SPACING }, SPACING),
  };
}

export function guideBeaconCellKey(point: Vec): string {
  return `${Math.floor(point.x / SPACING)},${Math.floor(point.y / SPACING)}`;
}

export function nearestGuideBeacon(
  slots: readonly GuideBeaconSlot[],
  point: Vec,
): GuideBeaconSlot | undefined {
  const distance = (slot: GuideBeaconSlot) =>
    Math.hypot(slot.point.x - point.x, slot.point.y - point.y);
  return slots.reduce<GuideBeaconSlot | undefined>((best, slot) => {
    const gap = distance(slot);
    return !best || gap < distance(best) || (gap === distance(best) && slot.id < best.id)
      ? slot
      : best;
  }, undefined);
}

/** Recover the authored slot from its exact saved world coordinates. */
export function guideBeaconSlotAt(point: Vec): GuideBeaconSlot | undefined {
  return guideBeaconSlots(point, 0).find(
    (slot) => slot.point.x === point.x && slot.point.y === point.y,
  );
}

/** The chapter's launch-side reference selects a member of the supported settlement network. */
export function storyGuideBeaconSlot(chunkSize: number): GuideBeaconSlot {
  const reference = { x: 0, y: -2 * chunkSize };
  const slot = nearestGuideBeacon(guideBeaconSlots(reference, CELL), reference);
  if (!slot) {
    throw new Error("Andromeda has no guide beacon slot near the chapter start");
  }
  return slot;
}

/** The spare stands outside the line, on its left as read in stable settlement ID order. */
export function spareGuideBeacon(slot: GuideBeaconSlot): Vec {
  return {
    x: slot.point.x - SPARE_OFFSET * slot.tangent.y,
    y: slot.point.y + SPARE_OFFSET * slot.tangent.x,
  };
}
