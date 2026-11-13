import jumpData from "../../public/art/quantum-jump.json";
import { CONTENT } from "../data/content.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING as T } from "../data/phantom.ts";
import type { PhantomFlight } from "../model/phantom.ts";
import { type PhantomAllySpec,phantomSongSpeed } from "../model/phantomAllies.ts";
import type { FlightState, SpaceObject, Vec } from "../model/types.ts";
import { playDepth } from "./asteroidArt.ts";
import { enemyJetTriangles, selectEnemyFrame } from "./enemyArt.ts";
import { jumpStepAt, readQuantumJump } from "./quantumJump.ts";
import { familyArt, loadEnemyParts } from "./sceneAssets.ts";
import { drawEnemySprite } from "./sceneEnemies.ts";
import { drawOutpost, drawWhale, type ObjectsContext } from "./sceneObjects.ts";
import { objectSprite } from "./sceneSprites.ts";
import { shipDirection } from "./shipArt.ts";
const jump = readQuantumJump(jumpData)!;
const stateOf = (flight: FlightState) =>
  (
    flight as FlightState & {
      phantom?: PhantomFlight;
    }
  ).phantom;
/** Friendly frames remain in their authored species and retain their published craft ids. */
export function phantomAllyCraft(ally: Pick<PhantomAllySpec, "galaxy" | "id">): string {
  if (ally.id === "clover" || ally.galaxy === 1) {return "stranded-scrap-barge";}
  if (ally.id === "reed" || ally.galaxy === 4) {return "glider";}
  if (ally.id === "pip" || ally.galaxy === 5) {return "pip";}
  return "miner";
}
/** Both dock states use the same authored frame geometry and pivot. */
export function phantomSettlementVariant(id: string): string | undefined {
  const index = PHANTOM_DESTINATIONS.findIndex((known) => known === id);
  return ["homes", "harbour", "signal"][index];
}
export function drawPhantomSettlement(scene: ObjectsContext, object: SpaceObject): boolean {
  const variant = phantomSettlementVariant(object.id);
  if (!variant || scene.model.state.flight?.galaxy !== 6) {return false;}
  const state = scene.model.state.progress[6].questComplete ? "mended" : "cracked";
  const frames = scene.shipAssets
    .filter(
      (asset) =>
        asset.outpost === "settlement" &&
        asset.variant === variant &&
        asset.state === state &&
        scene.textures.exists(asset.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  if (frames.length !== 2 || !frames[0]?.frameMs) {return false;}
  drawOutpost(
    scene,
    { frameMs: frames[0].frameMs, frames: [frames[0], frames[1]!] },
    object,
    scene.project(object),
  );
  return true;
}
/** The flagship keeps its own hull and hardpoint artwork, including the lit post-story hulk. */
export function drawPhantomFlagship(scene: ObjectsContext, object: SpaceObject): boolean {
  if (object.id !== PHANTOM_FLAGSHIP || !object.enemy) {return false;}
  loadEnemyParts(scene, "gadget");
  const art = familyArt(scene, "gadget");
  if (!art?.parts) {return false;}
  const view = object.enemy.salvaged
    ? { ...object.enemy, disabled: false, salvaged: false }
    : object.enemy;
  drawEnemySprite(scene, art, scene.project(object), object.id, view);
  return true;
}
function rim(scene: ObjectsContext, center: Vec, radius: number): void {
  const points = Array.from({ length: 49 }, (_, index) =>
    scene.project({
      x: center.x + Math.cos((index * Math.PI) / 24) * radius,
      y: center.y + Math.sin((index * Math.PI) / 24) * radius,
    }),
  );
  scene.ink.lineStyle(1, scene.palette.environmentDetail, 0.25);
  for (let index = 1; index < points.length; index++)
    {scene.ink.lineBetween(
      points[index - 1]!.x,
      points[index - 1]!.y,
      points[index]!.x,
      points[index]!.y,
    );}
}
/** Local arrivals reuse the published jump timeline's glow and star sheets. */
function drawAllyJump(scene: ObjectsContext, id: string, age: number, point: Vec): void {
  const phase = jumpStepAt(jump, age * 1000);
  if (!phase) {return;}
  const glow = scene.reducedMotion ? "low" : phase.step.glow;
  for (const [texture, name] of [
    ["quantum-jump-glow", glow],
    ["quantum-jump-star", !scene.reducedMotion && phase.step.star ? "jump" : undefined],
  ] as const) {
    if (!name || !scene.textures.exists(texture)) {continue;}
    const asset = scene.manifest.assets.find((asset) => asset.id === texture);
    const frame = asset?.frames?.[name];
    if (frame === undefined) {continue;}
    scene.passes(
      objectSprite(scene, `${id}#jump:${texture}`, texture, frame)
        .setPosition(point.x, point.y)
        .setDisplaySize(asset!.displayWidth!, asset!.displayHeight!)
        .setDepth(playDepth(point.y) + 0.00001),
    );
  }
}
/** Drawn friendlies do not enter the collision, damage, indicator or enemy targeting lists. */
export function drawPhantomAllies(scene: ObjectsContext): void {
  const flight = scene.model.state.flight;
  if (!flight || flight.galaxy !== 6) {return;}
  const state = stateOf(flight);
  if (!state) {return;}
  const adaDepth = playDepth(scene.project(flight.player).y);
  for (const ally of state.allies) {
    const id = `phantomAlly:${ally.id}`;
    const point = scene.project(ally);
    const speed = Math.hypot(ally.velocity.x, ally.velocity.y);
    if (ally.behavior === "whale") {
      drawWhale(scene, "whale", `${id}#whale`, ally, {
        heading: shipDirection(16, ally.facing),
        moving: speed > 1,
      });
      for (const [key, sprite] of scene.enemySprites)
        {if (key.startsWith(id)) {sprite.setDepth(Math.min(playDepth(point.y), adaDepth - 0.00001));}}
    } else {
      const art = scene.craftArt.get(phantomAllyCraft(ally));
      if (art) {
        const frame = selectEnemyFrame(art, ally.facing);
        scene.passes(
          objectSprite(scene, id, frame.id)
            .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
            .setOrigin(frame.pivot.x, frame.pivot.y)
            .setPosition(point.x, point.y)
            .setDepth(Math.min(playDepth(point.y), adaDepth - 0.00001)),
        );
        for (const jet of enemyJetTriangles(
          art,
          frame,
          Math.min(1, speed / CONTENT.tuning.physics.maxSpeed),
        )) {
          scene.enemyJets.fillStyle(jet.color, jet.alpha);
          scene.enemyJets.fillTriangle(
            point.x + jet.points[0].x,
            point.y + jet.points[0].y,
            point.x + jet.points[1].x,
            point.y + jet.points[1].y,
            point.x + jet.points[2].x,
            point.y + jet.points[2].y,
          );
        }
      }
    }
    drawAllyJump(scene, id, ally.jumpAge, point);
    if (ally.song) {rim(scene, ally, T.songRadius);}
  }
  for (const object of flight.objects)
    {if (
      object.kind === "enemy" &&
      object.enemy &&
      !object.enemy.disabled &&
      phantomSongSpeed(state.allies, object) < 1
    )
      {rim(scene, object, object.radius + 4);}}
}
