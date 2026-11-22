import { enemyActorLoadout } from "../data/enemyActorDefinition.ts";
import { enemyAssetKey } from "../data/enemyIdentity.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { partsReach, toScreen, worldParts } from "../model/convex.ts";
import { enemyPhysicalBody } from "../model/enemyBody.ts";
import { type PhantomSong, phantomSongSpeed } from "../model/phantomAllies.ts";
import type { FlightState, SpaceObject, Vec } from "../model/types.ts";
import { playDepth } from "./asteroidArt.ts";
import type { PhantomAllyArt } from "./phantomAllyArt.ts";
import type { ObjectsContext } from "./sceneObjects.ts";

type SongContext = Pick<ObjectsContext, "add" | "project" | "reducedMotion">;
type SongGraphics = ReturnType<SongContext["add"]["graphics"]>;
interface SongLayers {
  readonly field: SongGraphics;
  readonly rings: SongGraphics[];
}
const layers = new WeakMap<SongContext, SongLayers>();
const circles = Array.from({ length: 49 }, (_, index) => {
  const angle = (index * Math.PI) / 24;
  return toScreen({ x: Math.cos(angle), y: Math.sin(angle) });
});
const directions = Array.from({ length: 16 }, (_, index) => {
  const angle = (index * Math.PI) / 8;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});
const reaches = new Map<string, number>();

function drawnReach(actor: SpaceObject): number {
  const enemy = actor.enemy!;
  const position = ROUTE_POSITION[6];
  const weapons = enemyActorLoadout(enemy.archetype, position, enemy.id);
  const key = JSON.stringify([
    enemyAssetKey(enemy),
    [...(weapons?.values() ?? [])],
    enemy.hardpoints.map(({ hp, id }) => [id, hp > 0]),
  ]);
  let reach = reaches.get(key);
  if (reach !== undefined) {
    return reach || actor.radius;
  }
  reach = 0;
  for (const facing of directions) {
    for (const aim of enemy.hardpoints.length ? directions : [facing]) {
      const outline = enemyPhysicalBody(position, {
        ...enemy,
        aim,
        facing,
        hardpoints: enemy.hardpoints.map((part) => ({ ...part, aim })),
      });
      if (outline) {
        reach = Math.max(reach, partsReach(worldParts(outline)));
      }
    }
  }
  reaches.set(key, reach);
  return reach || actor.radius;
}

function circle(ink: SongGraphics, point: Vec, radius: number, fill: boolean): void {
  ink.beginPath();
  for (const [index, vertex] of circles.entries()) {
    const x = point.x + vertex.x * radius;
    const y = point.y + vertex.y * radius;
    if (index === 0) {
      ink.moveTo(x, y);
    } else {
      ink.lineTo(x, y);
    }
  }
  ink.closePath();
  if (fill) {
    ink.fillPath();
  } else {
    ink.strokePath();
  }
}

export function clearPhantomSong(scene: SongContext): void {
  const sprites = layers.get(scene);
  sprites?.field.clear();
  sprites?.rings.forEach((ring) => ring.clear());
}

export function drawPhantomSong(
  scene: SongContext,
  song: NonNullable<PhantomAllyArt["song"]>,
  flight: FlightState,
  active: PhantomSong,
): void {
  let sprites = layers.get(scene);
  if (!sprites) {
    // Above the field ink and backdrop, below the jets and play objects.
    sprites = { field: scene.add.graphics().setDepth(0.5), rings: [] };
    layers.set(scene, sprites);
  }
  const { field, rings } = sprites;
  const center = scene.project(active.center);
  const reach = active.radius;
  field.fillStyle(song.colour, song.fieldAlpha);
  circle(field, center, reach, true);
  field.lineStyle(song.rim.width, song.colour, song.rim.alpha);
  circle(field, center, reach, false);
  if (!scene.reducedMotion) {
    for (let index = 0; index < song.ripples.count; index++) {
      const phase = ((flight.time * 1000) / song.ripples.periodMs + index / song.ripples.count) % 1;
      field.lineStyle(song.ripples.width, song.colour, song.ripples.alpha * (1 - phase));
      circle(field, center, reach * phase, false);
    }
  }
  let index = 0;
  for (const object of flight.objects) {
    if (
      object.kind !== "enemy" ||
      !object.enemy ||
      object.enemy.disabled ||
      phantomSongSpeed(active, object) === 1
    ) {
      continue;
    }
    const point = scene.project(object);
    const ring = (rings[index] ??= scene.add.graphics());
    index++;
    ring
      .setDepth(playDepth(point.y) - 3e-6)
      .lineStyle(song.droneRing.width, song.colour, song.droneRing.alpha);
    circle(ring, point, drawnReach(object) + song.droneRing.margin, false);
  }
}
