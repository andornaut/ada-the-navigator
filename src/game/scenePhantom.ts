import jumpData from "../../public/art/quantum-jump.json" with { type: "json" };
import {
  enemyJetTriangles,
  finaleAllyCraft,
  jumpStepAt,
  PHANTOM_ALLIES_ART,
  type PhantomAllyArt,
  playDepth,
  readPhantomAllyArt,
  readQuantumJump,
  selectEnemyFrame,
  shipDirection,
} from "../art/index.ts";
import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import {
  activePhantomSong,
  type PhantomAlly,
  type PhantomAllySpec,
  phantomSongSpeed,
  phantomWhaleKind,
} from "../model/phantom/allies/index.ts";
import type { PhantomDeparture, PhantomFlight } from "../model/phantom/index.ts";
import type { FlightState, SpaceObject, Vec } from "../model/types.ts";
import { familyArt, loadEnemyParts } from "./sceneAssets.ts";
import { drawEnemySprite } from "./sceneEnemies.ts";
import { drawCraftJets, keylineSprite } from "./sceneHud.ts";
import { drawOutpost, drawWhale, type ObjectsContext } from "./sceneObjects.ts";
import { drawPhantomBlockades } from "./scenePhantomBlockade.ts";
import {
  allyJumpDuration,
  type AllyPresentation,
  allyPresentation,
  drawStretchedAlly,
  paintAllyJump,
} from "./scenePhantomJump.ts";
import { drawPhantomSong } from "./scenePhantomSong.ts";
import type { Asset } from "./sceneShared.ts";
import { objectSprite } from "./sceneSprites.ts";
const jump = readQuantumJump(jumpData)!;
const stateOf = (flight: FlightState) =>
  (
    flight as FlightState & {
      phantom?: PhantomFlight;
    }
  ).phantom;
const allyArt = new WeakMap<object, PhantomAllyArt | undefined>();
function readAllyArt(scene: ObjectsContext): PhantomAllyArt | undefined {
  const value: unknown = scene.cache.json.get(PHANTOM_ALLIES_ART);
  if (!value || typeof value !== "object") {
    return undefined;
  }
  if (!allyArt.has(value)) {
    allyArt.set(value, readPhantomAllyArt(value));
  }
  return allyArt.get(value);
}

/** Friendly frames remain in their authored species and retain their published craft ids. */
export function phantomAllyCraft(ally: Pick<PhantomAllySpec, "galaxy" | "id">): string | undefined {
  if (ally.id === "reed" || ally.id === "project:4:channelLights") {
    return "glider";
  }
  if (ally.id === "pip" || ally.id === "project:5:courierSchool") {
    return "pip";
  }
  if (ally.id === "mica" || ally.id === "project:2:dockingBay") {
    return "miner";
  }
  return undefined;
}
/** Both dock states use the same authored frame geometry and pivot. */
export function phantomSettlementVariant(id: string): string | undefined {
  const index = PHANTOM_DESTINATIONS.findIndex((known) => known === id);
  return ["homes", "harbour", "signal"][index];
}
export function drawPhantomSettlement(scene: ObjectsContext, object: SpaceObject): boolean {
  const variant = phantomSettlementVariant(object.id);
  if (!variant || scene.model.state.flight?.galaxy !== 6) {
    return false;
  }
  const state = scene.model.state.progress[6].questComplete ? "mended" : "cracked";
  const frames = (scene.galaxyManifests.get(6)?.assets ?? [])
    .filter(
      (asset) =>
        asset.outpost === "settlement" &&
        asset.variant === variant &&
        asset.state === state &&
        scene.textures.exists(asset.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  if (frames.length !== 2 || !frames[0]?.frameMs) {
    return false;
  }
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
  if (object.id !== PHANTOM_FLAGSHIP || !object.enemy) {
    return false;
  }
  loadEnemyParts(scene, "archie");
  const art = familyArt(scene, "archie");
  if (!art?.parts) {
    return false;
  }
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
  for (let index = 1; index < points.length; index++) {
    scene.ink.lineBetween(
      points[index - 1]!.x,
      points[index - 1]!.y,
      points[index]!.x,
      points[index]!.y,
    );
  }
}
/** Local arrivals reuse the published jump timeline's glow and star sheets. */
function drawAllyJump(scene: ObjectsContext, id: string, age: number, point: Vec): void {
  const phase = jumpStepAt(jump, age * 1000);
  if (!phase) {
    return;
  }
  const glow = scene.reducedMotion ? "low" : phase.step.glow;
  for (const [texture, name] of [
    ["quantum-jump-glow", glow],
    ["quantum-jump-star", !scene.reducedMotion && phase.step.star ? "jump" : undefined],
  ] as const) {
    if (!name || !scene.textures.exists(texture)) {
      continue;
    }
    const asset = scene.manifest.assets.find((asset) => asset.id === texture);
    const frame = asset?.frames?.[name];
    if (frame === undefined) {
      continue;
    }
    scene.passes(
      objectSprite(scene, `${id}#jump:${texture}`, texture, frame)
        .setPosition(point.x, point.y)
        .setDisplaySize(asset!.displayWidth!, asset!.displayHeight!)
        .setDepth(playDepth(point.y) + 0.00001),
    );
  }
}
const questAllies = { clover: 1, marlo: 3, mica: 2, pip: 5, reed: 4 } as const;
function departureGalaxy(id: string): PhantomAllySpec["galaxy"] | undefined {
  if (id.startsWith("project:")) {
    const number = Number(id.split(":")[1]);
    return GALAXY_NUMBERS.find((galaxy) => galaxy === number);
  }
  return Object.hasOwn(questAllies, id) ? questAllies[id as keyof typeof questAllies] : undefined;
}

function drawAuthoredDeparture(
  scene: ObjectsContext,
  art: PhantomAllyArt & { jump: NonNullable<PhantomAllyArt["jump"]> },
  ally: PhantomDeparture,
  depthLimit: number,
): void {
  const id = `phantomAlly:${ally.id}#departure`;
  const at = scene.project(ally);
  const facing = ally.facing;
  if (!facing) {
    // Older snapshots retain the existing local cue without guessing an absent body heading.
    if (!scene.reducedMotion) {
      drawAllyJump(scene, id, ally.age, at);
    }
    return;
  }
  const view = allyPresentation(art.jump, "out", ally.age * 1000, scene.reducedMotion);
  if (!view) {
    return;
  }
  const depth = Math.min(playDepth(at.y), depthLimit);
  const present = (frame: Asset): boolean => {
    paintAllyJump(scene, art.jump, view, at, id, frame, depth);
    if (view.step?.stretch) {
      drawStretchedAlly(scene, view, { at, depth, facing, id }, frame);
    } else {
      objectSprite(scene, id, frame.id)
        .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setPosition(at.x, at.y)
        .setDepth(depth)
        .setAlpha(view.opacity);
    }
    return true;
  };
  if (ally.id === "marlo") {
    drawWhale(scene, "whale", id, ally, {
      heading: shipDirection(16, facing),
      moving: false,
      present,
    });
    return;
  }
  const galaxy = departureGalaxy(ally.id);
  const craft = galaxy === undefined ? undefined : finaleAllyCraft(art, { galaxy, id: ally.id });
  const frames = craft ? scene.craftArt.get(craft) : undefined;
  if (frames) {
    present(selectEnemyFrame(frames, facing));
  }
}

function drawAllyBody(
  scene: ObjectsContext,
  ally: PhantomAlly,
  authored: PhantomAllyArt | undefined,
  visual: AllyPresentation,
  depthLimit: number,
): void {
  const id = `phantomAlly:${ally.id}`;
  const point = scene.project(ally);
  const speed = Math.hypot(ally.velocity.x, ally.velocity.y);
  const depth = Math.min(playDepth(point.y), depthLimit);
  const spriteFor = (key: string, frame: Asset): void => {
    const sprite = objectSprite(scene, key, frame.id)
      .setDisplaySize(frame.displayWidth! * visual.zoom, frame.displayHeight! * visual.zoom)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(depth)
      .setAlpha(visual.opacity);
    keylineSprite(
      scene,
      ally.behavior === "whale" ? "whale" : "storyCraft",
      key,
      sprite,
      depth - 2e-6,
    );
    scene.passes(sprite);
    if (authored?.jump) {
      paintAllyJump(scene, authored.jump, visual, point, key, frame, depth);
    }
  };
  if (ally.behavior === "whale") {
    const key = `${id}#whale`;
    drawWhale(scene, phantomWhaleKind(ally), key, ally, {
      heading: shipDirection(16, ally.facing),
      moving: speed > 1,
      present: (frame) => {
        spriteFor(key, frame);
        return true;
      },
    });
  } else {
    const craft = finaleAllyCraft(authored, ally) ?? phantomAllyCraft(ally);
    const art = craft ? scene.craftArt.get(craft) : undefined;
    if (art) {
      const frame = selectEnemyFrame(art, ally.facing);
      spriteFor(id, frame);
      drawCraftJets(
        scene,
        "storyCraft",
        id,
        point,
        depth,
        enemyJetTriangles(art, frame, Math.min(1, speed / CONTENT.tuning.physics.maxSpeed)),
      );
    }
  }
  if (!authored?.jump) {
    drawAllyJump(scene, id, ally.jumpAge, point);
  }
}

/** Drawn friendlies do not enter the collision, damage, indicator or enemy targeting lists. */
export function drawPhantomAllies(scene: ObjectsContext): void {
  const flight = scene.model.state.flight;
  if (!flight || flight.galaxy !== 6) {
    return;
  }
  const state = stateOf(flight);
  if (!state) {
    return;
  }
  if (state.blockadePhases) {
    drawPhantomBlockades(scene, {
      content: CONTENT,
      flight,
      progress: scene.model.state.progress[6],
    });
  }
  const authored = readAllyArt(scene);
  const depthLimit = playDepth(scene.project(flight.player).y) - 0.00001;
  const jump = authored?.jump;
  for (const ally of state.departures ?? []) {
    if (jump && authored) {
      drawAuthoredDeparture(scene, { ...authored, jump }, ally, depthLimit);
    } else {
      drawAllyJump(scene, `phantomAlly:${ally.id}#departure`, ally.age, scene.project(ally));
    }
  }
  const delay =
    jump && state.allyTurn > 0 && state.departures?.length
      ? allyJumpDuration(jump, scene.reducedMotion)
      : 0;
  const song = activePhantomSong(state.allies);
  for (const ally of state.allies) {
    const visual = jump
      ? allyPresentation(jump, "in", ally.jumpAge * 1000 - delay, scene.reducedMotion)
      : { opacity: 1, zoom: 1 };
    if (visual) {
      drawAllyBody(scene, ally, authored, visual, depthLimit);
    }
    if (song?.center === ally) {
      if (authored?.song) {
        drawPhantomSong(scene, authored.song, flight, song);
      } else {
        rim(scene, song.center, song.radius);
      }
    }
  }
  for (const object of flight.objects) {
    if (
      !authored?.song &&
      object.kind === "enemy" &&
      object.enemy &&
      !object.enemy.disabled &&
      phantomSongSpeed(song, object) < 1
    ) {
      rim(scene, object, object.radius + 4);
    }
  }
}
