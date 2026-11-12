import ore from "../../public/art/cartwheel/ore-nugget.json" with { type: "json" };
import cache from "../../public/art/discovery-cache.json" with { type: "json" };
import huntGlint from "../../public/art/hunt-glint.json" with { type: "json" };
import stardust from "../../public/art/stardust.json" with { type: "json" };
import type { Parts } from "./convex.ts";
import { carriesStardust } from "./drops.ts";
import type { SpaceObject } from "./types.ts";

// Pickups as drawn (art/weapons.md, the Aseprite sheets): each frame's `collision` parts are in
// frame px from the frame's top-left, at 1 display px per frame px, and each sprite centres on
// the pickup's projected point.

interface Sheet {
  frames: Record<string, { sourceSize: { w: number; h: number }; collision?: number[][][] }>;
}

/**
 * The union of a sheet's frames, in display px from the centre. The scene picks a frame from
 * its own clock, so contact takes every frame the pickup can show; `names` limits the frames.
 */
function sheetOutline(sheet: Sheet, names?: readonly string[]): Parts | undefined {
  const parts: Parts[number][] = [];
  for (const [name, frame] of Object.entries(sheet.frames)) {
    if (names && !names.some((wanted) => name.endsWith(wanted))) {
      continue;
    }
    if (!frame.collision?.length) {
      return undefined;
    }
    const { h, w } = frame.sourceSize;
    parts.push(
      ...frame.collision.map((part) => part.map(([x, y]) => ({ x: x! - w / 2, y: y! - h / 2 }))),
    );
  }
  return parts.length ? parts : undefined;
}

/** A Stardust gem: every frame of its glint loop. */
const STARDUST = sheetOutline(stardust as Sheet);
/** A discovery cache, lit: Ada comes within its approach range before she can reach it. */
const CACHE = sheetOutline(cache as Sheet, [" 1.aseprite", " 2.aseprite"]);
/** A hunt's lost item as its glint (art/jobs.md "Lost item glint"): every frame of its loop. */
export const HUNT_GLINT = sheetOutline(huntGlint as Sheet);
/** A cargo piece, Art's ore nugget. */
const ORE = sheetOutline(ore as Sheet);
const SQUARES = new Map<number, Parts>();

/**
 * A pickup's drawn outline in screen px from its position, or null to keep its circle: the
 * discovery cache, the Stardust gem, the ore nugget, or an upgrade pickup's screen-aligned square
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
    return STARDUST ?? null;
  }
  if (object.role === "cargo") {
    return ORE ?? null;
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
