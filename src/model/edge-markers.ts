import { deliveryDestination } from "../data/destinations.ts";
import { EDGE_MARKERS, type EdgeMarkerKind, ENEMY_MARKER_KINDS } from "../data/edge-markers.ts";
import { SCREEN } from "../data/screen.ts";
import type { SectorId } from "../data/types.ts";
import type { SpaceObject, Vec } from "./types.ts";

// Edge markers (gameplay/rules.md "Space encounters and feedback"): an enemy, heavy or station
// gets a marker only once it has been in the game area and left it. The marker stays while the
// object is within EDGE_MARKERS.range of Ada; past it the object is forgotten until it is in the
// game area again. Destruction, unloading, a new flight or galaxy and a reload clear the state,
// which is never saved. A direction indicator on the same object draws instead.

export interface EdgeMarker {
  readonly id: string;
  readonly kind: EdgeMarkerKind;
  readonly x: number;
  readonly y: number;
}

/** An object's marker kind: enemies and heavies by archetype, stations and outposts as station. */
export function edgeMarkerKind(object: SpaceObject): EdgeMarkerKind | null {
  if (object.hp <= 0) {
    return null;
  }
  if (object.kind === "enemy") {
    return object.enemy ? ENEMY_MARKER_KINDS[object.enemy.archetype] : "enemy";
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
 * Where the ray from `from` toward `to` meets the game area's rect inset by `inset`
 * (edgeMarkerInset): the marker's centre. `from` is inside that rect.
 */
export function edgePoint(inset: number, from: Vec, to: Vec): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const room = (delta: number, start: number, size: number) =>
    delta > 0 ? (size - inset - start) / delta : delta < 0 ? (inset - start) / delta : Infinity;
  const scale = Math.min(room(dx, from.x, SCREEN.width), room(dy, from.y, SCREEN.height));
  return Number.isFinite(scale) ? { x: from.x + dx * scale, y: from.y + dy * scale } : from;
}

/** The flight the tracker follows: its identity, galaxy, player and objects. */
export interface EdgeMarkerFlight {
  readonly objects: readonly SpaceObject[];
  readonly player: Vec;
  readonly sector: SectorId;
}

/**
 * The seen state across frames. update takes the flight each frame, or null outside one, and
 * the ids a direction indicator marks; it returns the objects to mark this frame.
 */
export function createEdgeMarkerTracker(): {
  update(flight: EdgeMarkerFlight | null, indicated: ReadonlySet<string>): EdgeMarker[];
} {
  // Each tracked object: in the game area now, or seen and since left.
  const seen = new Map<string, "inside" | "left">();
  let following: EdgeMarkerFlight | null = null;
  let sector: SectorId | null = null;
  return {
    update(flight, indicated) {
      if (flight === null || flight !== following || flight.sector !== sector) {
        // A new flight, a galaxy change, or no flight at all: nothing is remembered.
        seen.clear();
        following = flight;
        sector = flight?.sector ?? null;
      }
      if (flight === null) {
        return [];
      }
      const markers: EdgeMarker[] = [];
      const present = new Set<string>();
      for (const object of flight.objects) {
        const kind = edgeMarkerKind(object);
        if (kind === null) {
          continue;
        }
        present.add(object.id);
        const away = Math.hypot(object.x - flight.player.x, object.y - flight.player.y);
        if (inGameArea(gameAreaPoint(flight.player, object))) {
          seen.set(object.id, "inside");
        } else if (seen.has(object.id)) {
          if (away > EDGE_MARKERS.range) {
            seen.delete(object.id);
          } else {
            seen.set(object.id, "left");
            if (!indicated.has(object.id)) {
              markers.push({ id: object.id, kind, x: object.x, y: object.y });
            }
          }
        }
      }
      // Destroyed and unloaded objects are no longer in the flight's objects.
      for (const id of seen.keys()) {
        if (!present.has(id)) {
          seen.delete(id);
        }
      }
      return markers;
    },
  };
}
