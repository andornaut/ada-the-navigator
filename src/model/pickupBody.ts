import ore from "../../public/art/ore-nugget.json" with { type: "json" };
import pickups from "../../public/art/pickups/pickups.json" with { type: "json" };
import stardust from "../../public/art/stardust.json" with { type: "json" };
import { type Parts, partsReach, worldParts } from "./convex.ts";
import { carriesStardust } from "./drops.ts";
import type { SpaceObject } from "./types.ts";

// Pickups as drawn. Stardust and ore (art/stardust.md) are 9 px pixel sheets whose Aseprite
// frames carry `collision` parts in frame px from the frame's top-left; one frame px is one
// display px, and five units draw the same frame at 18 px. The other pickups are `pickups.json`
// rows (art/friendly-redesign.md) whose frames draw at frame px times `displayScale`, centred on
// their pivot. Both take the rest frame's parts, so the body holds still through its loop.

interface SheetFrame {
  readonly collision?: readonly (readonly (readonly number[])[])[];
  readonly sourceSize: { readonly h: number; readonly w: number };
}

type SheetId = "ore-nugget" | "stardust";

const SHEETS: Readonly<Record<SheetId, SheetFrame>> = {
  "ore-nugget": Object.values(ore.frames)[0]!,
  stardust: Object.values(stardust.frames)[0]!,
};

/** A sheet's rest-frame parts, in display px from the frame's centre. */
function sheetOutline(id: SheetId): Parts | undefined {
  const { collision, sourceSize } = SHEETS[id];
  if (!collision?.length) {
    return undefined;
  }
  const { h, w } = sourceSize;
  return collision.map((part) => part.map(([x, y]) => ({ x: x! - w / 2, y: y! - h / 2 })));
}

interface VectorFrame {
  readonly collision: readonly (readonly (readonly number[])[])[];
  readonly frame: readonly number[];
  readonly pivot: readonly number[];
}

const VECTOR_FRAMES = pickups.frames as Readonly<Record<string, VectorFrame>>;

/** The union of `pickups.json` rows' parts, in display px from each frame's pivot. */
function vectorOutline(ids: readonly string[]): Parts | undefined {
  const scale = pickups.displayScale;
  const parts: Parts[number][] = [];
  for (const id of ids) {
    const frame = VECTOR_FRAMES[id];
    if (!frame?.collision.length) {
      return undefined;
    }
    const [px, py] = frame.pivot;
    parts.push(
      ...frame.collision.map((part) =>
        part.map(([x, y]) => ({ x: (x! - px!) * scale, y: (y! - py!) * scale })),
      ),
    );
  }
  return parts.length ? parts : undefined;
}

/** A sheet pickup's drawn extent in display px: its frame for one, 18 for exactly five. */
function pickupSize(id: SheetId, amount?: number): number {
  return amount === 5 ? 18 : SHEETS[id].sourceSize.w;
}

/** A sheet pickup frame's display size: its frame px, scaled for exactly five. */
function pickupFrameSize(id: SheetId, amount?: number): { height: number; width: number } {
  const { h, w } = SHEETS[id].sourceSize;
  const scale = pickupSize(id, amount) / w;
  return { height: h * scale, width: w * scale };
}

function scaleOutline(outline: Parts | undefined, scale: number): Parts | undefined {
  return outline?.map((part) => part.map(({ x, y }) => ({ x: x * scale, y: y * scale })));
}

/** A Stardust gem. */
const STARDUST = sheetOutline("stardust");
const LARGE_STARDUST = scaleOutline(STARDUST, stardustPickupSize(5) / stardustPickupSize());
const LARGE_STARDUST_REACH = LARGE_STARDUST && partsReach(worldParts(LARGE_STARDUST));
/** A discovery cache, lit: Ada comes within its approach range before she can reach it. */
const CACHE = vectorOutline(["discovery-cache-lit-a", "discovery-cache-lit-b"]);
/** A hunt's lost item as its glint (art/jobs.md "Lost item glint"). */
export const HUNT_GLINT = vectorOutline(["hunt-glint"]);
/** A cargo piece, Art's ore nugget. */
const ORE = sheetOutline("ore-nugget");
const LARGE_ORE = scaleOutline(ORE, orePickupSize(5) / orePickupSize());

/** Ore's drawn extent in display px: the frame as drawn for one, 18 for a five-unit chunk. */
export function orePickupSize(amount?: number): number {
  return pickupSize("ore-nugget", amount);
}

/** The ore frame's display size, scaled for a five-unit chunk. */
export function orePickupFrameSize(amount?: number): { height: number; width: number } {
  return pickupFrameSize("ore-nugget", amount);
}

/** The Stardust gem's drawn extent in display px, for one or exactly five units. */
export function stardustPickupSize(amount?: number): number {
  return pickupSize("stardust", amount);
}

/** The Stardust frame's display size, scaled for exactly five units. */
export function stardustPickupFrameSize(amount?: number): { height: number; width: number } {
  return pickupFrameSize("stardust", amount);
}

/** World-plane footprint for a five-unit discovery or drop. */
export function stardustPickupReach(singleReach: number, amount?: number): number {
  return amount === 5 ? Math.max(singleReach, LARGE_STARDUST_REACH ?? singleReach) : singleReach;
}
/** An ammo pack's crate. */
export const AMMO_PACK = vectorOutline(["ammo-pack"]);
const SQUARES = new Map<number, Parts>();

/**
 * A pickup's drawn outline in screen px from its position, or null to keep its circle: the
 * discovery cache, the Stardust gem, the ore nugget, the ammo pack, or an upgrade pickup's screen-aligned square
 * reaching half its 1.5 px outline past its radius.
 */
export function pickupOutline(object: SpaceObject): Parts | null {
  if (object.kind !== "pickup") {
    return null;
  }
  if (object.role === "discovery" && carriesStardust(object)) {
    return CACHE ?? null;
  }
  if (carriesStardust(object)) {
    return (object.amount === 5 ? LARGE_STARDUST : STARDUST) ?? null;
  }
  if (object.role === "cargo") {
    return (object.amount === 5 ? LARGE_ORE : ORE) ?? null;
  }
  if (object.ammoPack) {
    return AMMO_PACK ?? null;
  }
  if (object.upgrade) {
    const half = object.radius + 0.75;
    let square = SQUARES.get(half);
    if (!square) {
      square = [
        [
          { x: -half, y: -half },
          { x: half, y: -half },
          { x: half, y: half },
          { x: -half, y: half },
        ],
      ];
      SQUARES.set(half, square);
    }
    return square;
  }
  return null;
}
