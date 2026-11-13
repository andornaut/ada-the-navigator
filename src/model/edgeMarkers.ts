import type { Rect } from "@andornaut/game-kit/rect";

import { deliveryDestination } from "../data/destinations.ts";
import {
  BLOCKING_MARKER_KINDS,
  EDGE_MARKERS,
  type EdgeMarkerKind,
  ENEMY_MARKER_KINDS,
} from "../data/edgeMarkers.ts";
import { SCREEN } from "../data/screen.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { SpaceObject, Vec } from "./types.ts";
import { nearestImage } from "./worldGeometry.ts";

// Edge markers (gameplay/rules.md "Space encounters and feedback"): an enemy, heavy, guard or
// station gets a marker only once it has been in the game area and left it. The marker stays
// while the object is within EDGE_MARKERS.range of Ada; past it the object is forgotten until it
// is in the game area again. Destruction, unloading, a new flight or galaxy and a reload clear
// the state, which is never saved. A direction indicator on the same object draws instead. A
// summoned guard (flight.ts cueGuards) is marked while off screen whether or not it was seen.

export interface EdgeMarker {
  /**
   * The guard's bar alpha: 1 on a guard, fading to 0 over EDGE_MARKERS.swapMs on a heavy just
   * disabled from a guard; absent when no bar draws.
   */
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
    const blocking = object.routeId !== undefined && !object.enemy.disabled;
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

/** The flight the tracker follows: its identity, galaxy, player, objects and summoned guards. */
export interface EdgeMarkerFlight {
  readonly objects: readonly SpaceObject[];
  readonly player: Vec;
  readonly galaxy: GalaxyNumber;
  readonly summonedGuards?: readonly string[];
}

/**
 * The seen state across frames. update takes the flight each frame, or null outside one, the ids
 * a direction indicator marks and the time in ms; it returns the objects to mark this frame.
 */
export function createEdgeMarkerTracker(context?: {
  readonly worldSide?: () => number | undefined;
}): {
  update(
    flight: EdgeMarkerFlight | null,
    indicated: ReadonlySet<string>,
    now?: number,
  ): EdgeMarker[];
} {
  // Each tracked object: in the game area now, or seen and since left.
  const seen = new Map<string, "inside" | "left">();
  // Each object's kind last frame, and when each guard was disabled into a heavy, in ms.
  const kinds = new Map<string, EdgeMarkerKind>();
  const swapped = new Map<string, number>();
  let following: EdgeMarkerFlight | null = null;
  let galaxy: GalaxyNumber | null = null;
  return {
    update(flight, indicated, now = 0) {
      if (flight === null || flight !== following || flight.galaxy !== galaxy) {
        // A new flight, a galaxy change, or no flight at all: nothing is remembered.
        seen.clear();
        kinds.clear();
        swapped.clear();
        following = flight;
        galaxy = flight?.galaxy ?? null;
      }
      if (flight === null) {
        return [];
      }
      const markers: EdgeMarker[] = [];
      const worldSide = context?.worldSide?.();
      const image = (point: Vec) =>
        worldSide === undefined ? point : nearestImage(worldSide, flight.player, point).point;
      const present = new Set<string>();
      const summoned = new Set(flight.summonedGuards);
      /** The marker for `object`: a guard's bar, or the bar fading off a heavy just disabled. */
      const marker = (object: SpaceObject, kind: EdgeMarkerKind): EdgeMarker => {
        const since = swapped.get(object.id);
        const bar =
          kind === "guard"
            ? 1
            : since !== undefined && now - since < EDGE_MARKERS.swapMs
              ? 1 - (now - since) / EDGE_MARKERS.swapMs
              : 0;
        const { x, y } = image(object);
        return bar > 0 ? { bar, id: object.id, kind, x, y } : { id: object.id, kind, x, y };
      };
      for (const object of flight.objects) {
        const kind = edgeMarkerKind(object);
        if (kind === null) {
          continue;
        }
        present.add(object.id);
        if (kinds.get(object.id) === "guard" && kind !== "guard") {
          swapped.set(object.id, now);
        }
        kinds.set(object.id, kind);
        const point = image(object);
        const away = Math.hypot(point.x - flight.player.x, point.y - flight.player.y);
        if (inGameArea(gameAreaPoint(flight.player, point))) {
          seen.set(object.id, "inside");
        } else if (summoned.has(object.id)) {
          if (!indicated.has(object.id)) {
            markers.push(marker(object, kind));
          }
        } else if (seen.has(object.id)) {
          if (away > EDGE_MARKERS.range) {
            seen.delete(object.id);
          } else {
            seen.set(object.id, "left");
            if (!indicated.has(object.id)) {
              markers.push(marker(object, kind));
            }
          }
        }
      }
      // Destroyed and unloaded objects are no longer in the flight's objects.
      for (const map of [seen, kinds, swapped]) {
        for (const id of map.keys()) {
          if (!present.has(id)) {
            map.delete(id);
          }
        }
      }
      return markers;
    },
  };
}
