import type { Rect } from "@andornaut/game-kit/rect";

import { deliveryDestination } from "../data/destinations.ts";
import {
  BLOCKING_MARKER_KINDS,
  type EdgeMarkerKind,
  ENEMY_MARKER_KINDS,
} from "../data/edgeMarkers.ts";
import { SCREEN } from "../data/screen.ts";
import type { SpaceObject, Vec } from "./types.ts";

// Shared kind metadata, isometric projection and safe edge anchors. Knowledge and lifetime
// are owned by the unified target registry.

export interface EdgeMarker {
  /** A route guard retains the same full-strength bar after it is disabled. */
  readonly bar?: number;
  readonly id: string;
  readonly kind: EdgeMarkerKind;
  readonly x: number;
  readonly y: number;
}

/** The whole 720x360 game area, for a view with no safe insets (safeGameArea). */
export const GAME_AREA: Rect = { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 };

/**
 * An object's marker kind: enemies and heavies by archetype, a heavy still blocking its route as
 * guard, stations and outposts as station.
 */
export function edgeMarkerKind(object: SpaceObject): EdgeMarkerKind | null {
  if (object.hp <= 0) {
    return null;
  }
  if (object.kind === "enemy") {
    if (!object.enemy) {
      return "enemy";
    }
    const kind = ENEMY_MARKER_KINDS[object.enemy.archetype];
    const blocking = object.routeId !== undefined;
    return (blocking && BLOCKING_MARKER_KINDS[kind]) || kind;
  }
  if (
    object.kind === "station" ||
    (object.kind === "destination" && deliveryDestination(object.id))
  ) {
    return "station";
  }
  return null;
}

/** A world point in the game area, by the view's isometric projection around the player. */
export function gameAreaPoint(player: Vec, point: Vec): Vec {
  const x = point.x - player.x;
  const y = point.y - player.y;
  return { x: SCREEN.width / 2 + x - y, y: SCREEN.height / 2 + (x + y) / 2 };
}

/** Whether a game-area point is inside the 720x360 game area. */
export function inGameArea(point: Vec): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= SCREEN.width && point.y <= SCREEN.height;
}

/**
 * Where the ray from `from` toward `to` meets `area` (the safe game area, safeGameArea) inset by
 * `inset` (edgeMarkerInset): the marker's centre. `from` is inside that rect.
 */
export function edgePoint(area: Rect, inset: number, from: Vec, to: Vec): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const room = (delta: number, start: number, low: number, size: number) =>
    delta > 0
      ? (low + size - inset - start) / delta
      : delta < 0
        ? (low + inset - start) / delta
        : Infinity;
  const scale = Math.min(
    room(dx, from.x, area.x, area.width),
    room(dy, from.y, area.y, area.height),
  );
  return Number.isFinite(scale) ? { x: from.x + dx * scale, y: from.y + dy * scale } : from;
}
