// Drawing flight objects: rocks, stations, outposts, destinations, pickups and wrecks.
// Functions over the scene's ObjectsContext.
import { densityTexels } from "@andornaut/game-kit/view/renderScale";
import { Math as PhaserMath, type Scene, TintModes } from "phaser";

import { ASTEROID_ART, type AsteroidArt } from "../data/asteroidCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { destinationDrawn } from "../data/destinations.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { resourceArtId } from "../data/resourceRocks.ts";
import { SCREEN } from "../data/screen.ts";
import { rockFrame, scenerySilhouette } from "../model/asteroids.ts";
import { debrisPieceIndex } from "../model/debrisBody.ts";
import { carriesStardust } from "../model/drops.ts";
import { hubBay, hubWorn } from "../model/storyShips.ts";
import type { SpaceObject, Vec } from "../model/types.ts";
import {
  type AsteroidOutline,
  driftChips,
  footprintOutline,
  hexNumber,
  playDepth,
  rockArt,
} from "./asteroidArt.ts";
import { hubLayers } from "./cartwheelArt.ts";
import { debrisFrame, debrisMarks, debrisPiece } from "./debrisArt.ts";
import { reducedAt, shardPolygons, wreckFlashAt } from "./destructionArt.ts";
import { selectEnemyFrame } from "./enemyArt.ts";
import { keylineOffsets, LIGHT_FIELD } from "./lightField.ts";
import {
  boundsOnScreen,
  type OutpostPart,
  outpostParts,
  partsBounds,
  revealAlpha,
} from "./projectArt.ts";
import type { GameScene } from "./scene.ts";
import {
  familyArt,
  familyOf,
  filterTexture,
  loadEnemyParts,
  rockFrameTexture,
  whaleTexture,
} from "./sceneAssets.ts";
import { drawEffect, drawEnemy } from "./sceneEnemies.ts";
import { keylineEdges, keylineSilhouette, keylineSprite } from "./sceneHud.ts";
import { sceneryDetail } from "./scenery.ts";
import { type Asset } from "./sceneShared.ts";
import { objectSprite } from "./sceneSprites.ts";
import { shipDirection } from "./shipArt.ts";
import { spaceObjectColor } from "./spacePalette.ts";
import { BEACON_SUFFIX, FLASH_SUFFIX, hubBayKey, partKey } from "./spriteKeys.ts";
import { stardustDrawn, stardustFrame, stardustPhase, stardustShown } from "./stardustArt.ts";
import {
  type StationArt,
  stationFrame,
  stationFrameIndex,
  stationLoopFrame,
} from "./stationArt.ts";
import { litChevron, UPGRADE_CHEVRON } from "./upgradePickup.ts";
import { type EffectShape } from "./weaponEffects.ts";
import { familyMembers, type WhaleKind, whaleLoopFrame, whalePhase } from "./whaleArt.ts";
import {
  ammoPackFrame,
  beaconFrame,
  cacheApproached,
  cacheFrame,
  holodiskFrame,
  holodiskWaypoint,
  isDiscoveryCache,
  loopPhase,
} from "./worldArt.ts";

/** The scene state and methods this module's functions use. */
export type ObjectsContext = Scene &
  Pick<
    GameScene,
    | "add"
    | "asteroidArt"
    | "ammoPackArt"
    | "backdropRules"
    | "backdrops"
    | "banners"
    | "beaconArt"
    | "buoyArt"
    | "cache"
    | "cacheArt"
    | "calfHeading"
    | "calloutState"
    | "children"
    | "controls"
    | "coreAssetIds"
    | "craftArt"
    | "debrisArt"
    | "destruction"
    | "drawnTops"
    | "edgeMarkerInk"
    | "edgeMarkers"
    | "enemyArt"
    | "enemyJets"
    | "enemyPlaceholders"
    | "enemySprites"
    | "enemyWeaponsArt"
    | "familyArts"
    | "familyParts"
    | "familyShards"
    | "feedback"
    | "flightClock"
    | "flightLive"
    | "frameTops"
    | "galaxyBackdrops"
    | "galaxyLoads"
    | "galaxyManifestPaths"
    | "galaxyManifests"
    | "galaxyStations"
    | "hitFlashes"
    | "holodiskArt"
    | "hubArt"
    | "indicatorInk"
    | "ink"
    | "jobArt"
    | "keyed"
    | "keylines"
    | "light"
    | "litCaches"
    | "litFlight"
    | "load"
    | "loads"
    | "manifest"
    | "mineInk"
    | "model"
    | "outpostArt"
    | "overlay"
    | "paintAssets"
    | "paintLoads"
    | "palette"
    | "partAssets"
    | "partLoads"
    | "passes"
    | "pickupSeen"
    | "project"
    | "projectArt"
    | "quantum"
    | "rasters"
    | "reducedMotion"
    | "resourceFiles"
    | "resourceRocks"
    | "revealGroups"
    | "reveals"
    | "rockQueued"
    | "rockRequests"
    | "salvagedGroups"
    | "scale"
    | "shards"
    | "shell"
    | "shipAssets"
    | "silhouettes"
    | "spaceBackground"
    | "stardustArt"
    | "stationArt"
    | "storyNoses"
    | "strandedCraft"
    | "streakSpec"
    | "textures"
    | "time"
    | "towLine"
    | "upgradePickupArt"
    | "useCallout"
    | "whaleArt"
    | "whaleRequests"
    | "whirlpoolProjects"
  >;

const DEBRIS_STONES = ASTEROID_ART.asteroids.filter(({ size }) => size === "small");

/** Traveling debris uses its galaxy's authored pieces, or neutral stone in Sunflower. */
export function drawTravelingDebris(
  scene: ObjectsContext,
  object: SpaceObject,
  point: Vec,
): boolean {
  const flight = scene.model.state.flight!;
  const art = scene.debrisArt.get(flight.galaxy);
  if (!object.velocity || object.orbit) {
    return false;
  }
  if (!art) {
    if (flight.galaxy !== 1) {
      return false;
    }
    const stone = DEBRIS_STONES[debrisPieceIndex(DEBRIS_STONES.length, object.id)]!;
    // Match the existing collider's radius without changing the object's gameplay shape.
    drawAsteroidSprite(scene, object, point, stone, object.radius / stone.footprintRadius);
    return true;
  }
  const piece = debrisPiece(art, object.id);
  const frame = debrisFrame(art, piece, object.id, scene.reducedMotion, flight.time);
  const velocity = {
    x: object.velocity.x - object.velocity.y,
    y: (object.velocity.x + object.velocity.y) / 2,
  };
  const mark = hexNumber(art.marks.color);
  for (const dash of debrisMarks(art, piece, frame, velocity)) {
    scene.ink.lineStyle(art.marks.width, mark, dash.alpha);
    scene.ink.lineBetween(
      point.x + dash.from.x,
      point.y + dash.from.y,
      point.x + dash.to.x,
      point.y + dash.to.y,
    );
  }
  objectSprite(scene, object.id, `${piece.id}-${frame}`)
    .setDisplaySize(piece.display.width, piece.display.height)
    .setOrigin(piece.pivot.x, piece.pivot.y)
    .setPosition(point.x, point.y)
    .setDepth(playDepth(point.y));
  return true;
}

/**
 * The upgrade pickup's two chevrons in the square's amber (art/weapons.md "Pickups"): the
 * climb loops from the still frame when the pickup first draws, lighting each chevron white
 * for its step; reduced motion holds the still frame.
 */
export function drawUpgradeChevrons(
  scene: ObjectsContext,
  object: SpaceObject,
  point: Vec,
  color: number,
): void {
  const art = scene.upgradePickupArt;
  if (!art || !scene.textures.exists(UPGRADE_CHEVRON)) {
    return;
  }
  const since = scene.pickupSeen.get(object.id) ?? scene.time.now;
  scene.pickupSeen.set(object.id, since);
  const lit = litChevron(art, scene.reducedMotion, scene.time.now - since);
  for (const chevron of art.chevrons) {
    const key = partKey(object.id, `chevron:${chevron.name}`);
    const sprite = objectSprite(scene, key, UPGRADE_CHEVRON)
      .setOrigin(0.5)
      .setDisplaySize(art.size.width, art.size.height)
      .setPosition(point.x + chevron.offset.x, point.y + chevron.offset.y)
      .setDepth(playDepth(point.y))
      .setTint(chevron.name === lit ? 0xffffff : color)
      .setTintMode(TintModes.FILL);
    keylineSprite(scene, "upgradePickup", key, sprite);
  }
}

/**
 * A station in its galaxy's own art where it has some, its funded replacement swapped in (the
 * Loom hall), else the shared station's A/B blink; reduced motion holds frame 0. Stations draw
 * no name label.
 */
export function drawStation(
  scene: ObjectsContext,
  object: SpaceObject,
  point: Vec,
  radius: number,
): void {
  const galaxy = scene.model.state.flight?.galaxy;
  const ownArt = galaxy === undefined ? undefined : scene.galaxyStations.get(galaxy);
  if (ownArt && galaxy !== undefined) {
    const funded = new Set(scene.model.worldChanges(galaxy).map(({ project }) => project));
    const replaced = [...ownArt.projects].find(([project]) => funded.has(project))?.[1];
    const frame = stationLoopFrame(replaced ?? ownArt.base, scene.reducedMotion, scene.time.now);
    placeStationFrame(scene, frame, "station", object, point);
    return;
  }
  if (!scene.stationArt) {
    drawStationPlaceholder(scene, point, radius);
    return;
  }
  drawBlink(scene, scene.stationArt, "station", object, point);
}

/**
 * A fixed-facing station or outpost frame at its pivot, blinking A and B, sorted by its pivot;
 * `layer` orders a layered outpost's frames within that slot.
 */
export function drawBlink(
  scene: ObjectsContext,
  art: StationArt<Asset>,
  kind: "outpost" | "station",
  object: SpaceObject,
  point: Vec,
  key = object.id,
  layer = 0,
): void {
  placeStationFrame(
    scene,
    stationFrame(art, scene.reducedMotion, scene.time.now),
    kind,
    object,
    point,
    key,
    layer,
  );
}

/** One fixed-facing station or outpost frame at its pivot, sorted by its pivot. */
export function placeStationFrame(
  scene: ObjectsContext,
  frame: Asset,
  kind: "outpost" | "station",
  object: SpaceObject,
  point: Vec,
  key = object.id,
  layer = 0,
): void {
  const sprite = objectSprite(scene, key, frame.id)
    .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
    .setOrigin(frame.pivot.x, frame.pivot.y)
    .setPosition(point.x, point.y)
    .setDepth(playDepth(point.y) + layer * 1e-7);
  keylineSprite(scene, kind, key, sprite);
  scene.passes(sprite);
}

/**
 * An outpost with its galaxy's funded world changes. A change not yet revealed stays unseen until
 * the first frame the outpost is on screen in live flight, which records the reveal and fades
 * the after state in over the before state as one group (reduced motion cuts to it).
 */
export function drawOutpost(
  scene: ObjectsContext,
  art: StationArt<Asset>,
  object: SpaceObject,
  point: Vec,
): void {
  const index = stationFrameIndex(art, scene.reducedMotion, scene.time.now);
  const galaxy = scene.model.state.flight?.galaxy;
  const projects = scene.projectArt?.projects;
  const changes =
    galaxy && projects
      ? scene.model
          .worldChanges(galaxy)
          .filter(({ project, site }) => site === object.id && projects.has(project))
      : [];
  const changeArt = (ids: readonly string[]) => ids.map((id) => projects!.get(id)!);
  const all = changes.map(({ project }) => project);
  const now = scene.flightClock;
  let unseen = changes.filter(({ revealed }) => !revealed).map(({ project }) => project);
  if (
    unseen.length > 0 &&
    scene.flightLive &&
    boundsOnScreen(SCREEN, point, partsBounds(outpostParts(art, changeArt(all), index)))
  ) {
    for (const project of unseen) {
      scene.model.revealWorldChange(galaxy!, project);
      if (!scene.reducedMotion) {
        scene.reveals.set(project, now);
      }
    }
    unseen = [];
  }
  const revealMs = scene.projectArt?.revealMs ?? 0;
  const elapsed = all.flatMap((project) => {
    const start = scene.reveals.get(project);
    if (start !== undefined && now - start >= revealMs) {
      scene.reveals.delete(project);
    }
    return scene.reveals.has(project) ? [{ ms: now - start!, project }] : [];
  });
  const fading = new Set(elapsed.map(({ project }) => project));
  const after = all.filter((project) => !unseen.includes(project));
  const before = after.filter((project) => !fading.has(project));
  drawOutpostParts(scene, object.id, outpostParts(art, changeArt(before), index), point);
  if (elapsed.length === 0) {
    scene.revealGroups.get(object.id)?.destroy();
    scene.revealGroups.delete(object.id);
    return;
  }
  const alpha = revealAlpha(revealMs, Math.min(...elapsed.map(({ ms }) => ms)));
  drawRevealGroup(scene, object.id, outpostParts(art, changeArt(after), index), point, alpha);
}

/**
 * An outpost's sprites in its depth slot, behind parts first, keylined on a light field as one
 * silhouette beneath them all.
 */
export function drawOutpostParts(
  scene: ObjectsContext,
  id: string,
  parts: readonly OutpostPart<Asset>[],
  point: Vec,
): void {
  const depth = playDepth(point.y);
  const keylineDepth = depth + parts[0]!.order * 1e-7 - 2e-6;
  for (const part of parts) {
    // Under the outpost's id (spriteOwner), so each part lives as long as its outpost.
    const key = part.order === 0 ? id : `${id}#part${part.order}`;
    const sprite = objectSprite(scene, key, part.frame.id)
      .setDisplaySize(part.frame.displayWidth!, part.frame.displayHeight!)
      .setOrigin(part.frame.pivot.x, part.frame.pivot.y)
      .setPosition(point.x + part.offset.x, point.y + part.offset.y)
      .setDepth(depth + part.order * 1e-7);
    keylineSprite(scene, "outpost", key, sprite, keylineDepth);
    scene.passes(sprite);
  }
}

/**
 * The after state drawn into one texture at the raster scale, its keyline beneath its
 * sprites, then shown over the before state at the reveal's alpha, so the group fades as one.
 */
export function drawRevealGroup(
  scene: ObjectsContext,
  id: string,
  parts: readonly OutpostPart<Asset>[],
  point: Vec,
  alpha: number,
): void {
  const grow = scene.light && LIGHT_FIELD.keylined.includes("outpost") ? LIGHT_FIELD.keyline : 0;
  const bounds = partsBounds(parts);
  const left = Math.floor(point.x + bounds.left - grow - 1);
  const top = Math.floor(point.y + bounds.top - grow - 1);
  const width = Math.ceil(point.x + bounds.right + grow + 1) - left;
  const height = Math.ceil(point.y + bounds.bottom + grow + 1) - top;
  const r = scene.rasters.scale;
  const texels = { height: densityTexels(r, height), width: densityTexels(r, width) };
  let group = scene.revealGroups.get(id);
  if (!group || group.width !== texels.width || group.height !== texels.height) {
    group?.destroy();
    group = scene.add.renderTexture(0, 0, texels.width, texels.height).setOrigin(0, 0);
    filterTexture(scene, group.texture.key, "linear");
    scene.revealGroups.set(id, group);
  }
  group.clear();
  const stamps = parts.map((part) => {
    const frame = scene.textures.getFrame(part.frame.id);
    return {
      config: {
        originX: part.frame.pivot.x,
        originY: part.frame.pivot.y,
        scaleX: (r * part.frame.displayWidth!) / frame.width,
        scaleY: (r * part.frame.displayHeight!) / frame.height,
      },
      frame,
      x: point.x + part.offset.x - left,
      y: point.y + part.offset.y - top,
    };
  });
  if (grow > 0) {
    for (const { config, frame, x, y } of stamps) {
      const silhouette = keylineSilhouette(scene, { frame });
      for (const offset of silhouette ? keylineOffsets(grow) : []) {
        group.stamp(silhouette!, undefined, r * (x + offset.x), r * (y + offset.y), config);
      }
    }
  }
  for (const { config, frame, x, y } of stamps) {
    group.stamp(frame.texture.key, undefined, r * x, r * y, config);
  }
  group.render();
  group
    .setDisplaySize(width, height)
    .setPosition(left, top)
    .setDepth(playDepth(point.y) + parts[parts.length - 1]!.order * 1e-7 + 1e-7)
    .setAlpha(alpha)
    .setVisible(true);
  scene.passes(group);
}

/**
 * A destination: its outpost or holodisk art, else the placeholder rings; nothing for one its
 * data marks undrawn (data/destinations.ts), which its buoy and craft stand for.
 */
export function drawDestination(
  scene: ObjectsContext,
  object: SpaceObject,
  point: Vec,
  radius: number,
): void {
  if (!destinationDrawn(object.id)) {
    return;
  }
  if (object.id === "hub" && scene.hubArt) {
    const progress = scene.model.state.progress[scene.model.state.flight!.galaxy];
    hubLayers(scene.hubArt, hubWorn(progress), hubBay(progress)).forEach((layer, index) => {
      drawBlink(
        scene,
        layer,
        "outpost",
        object,
        point,
        index ? hubBayKey(object.id) : object.id,
        index,
      );
    });
    return;
  }
  const outpost = scene.outpostArt.get(object.id);
  if (outpost) {
    drawOutpost(scene, outpost, object, point);
    return;
  }
  if (object.id === "holodisk" && scene.holodiskArt) {
    drawHolodisk(scene, object, point);
    return;
  }
  if (object.id === "whale" && drawWhale(scene, "whale", object.id, object)) {
    return;
  }
  // The family: the smaller adult at the destination with its calves at their offsets.
  if (
    object.id === "family" &&
    scene.whaleArt &&
    familyMembers(scene.model.calfAway, scene.whaleArt.family).every(({ kind, offset }) =>
      drawWhale(scene, kind, `${object.id}:${kind}`, {
        x: object.x + offset.x,
        y: object.y + offset.y,
      }),
    )
  ) {
    return;
  }
  scene.ink.fillEllipse(point.x, point.y, radius * 2, radius);
  scene.ink.strokeEllipse(point.x, point.y, radius * 2, radius);
  scene.ink.strokeEllipse(point.x, point.y - 7, radius, radius * 0.6);
}

/**
 * Guide a calf's calf, owned by the family destination: Art's `calf` frames in the heading of
 * its travel, swimming while it moves and idling while it waits (art/whales.md "Placement").
 */
export function drawGuidedCalf(scene: ObjectsContext): void {
  const calf = scene.model.guidedCalf;
  if (!calf) {
    return;
  }
  const speed = Math.hypot(calf.velocity.x, calf.velocity.y);
  const kind = scene.whaleArt?.kinds.get("calf");
  // A resting calf keeps the heading it last swam in.
  if (speed > 1) {
    scene.calfHeading = shipDirection(kind?.frames.length ?? 16, calf.velocity);
  }
  drawWhale(scene, "calf", partKey("family", "guidedCalf"), calf, {
    heading: scene.calfHeading,
    moving: speed > 1,
  });
}

/**
 * A whale at its world position, pivot on the world plane: stationary in its fixed heading and
 * idle loop from its own phase, or in `motion`'s heading with the swim loop while it moves. Its
 * loop's frames load on first draw; false until frame 0 has.
 */
export function drawWhale(
  scene: ObjectsContext,
  kind: WhaleKind,
  id: string,
  at: Vec,
  motion?: { readonly heading: number; readonly moving: boolean },
): boolean {
  const art = scene.whaleArt?.kinds.get(kind);
  if (!art || !scene.whaleArt) {
    return false;
  }
  const frames = art.frames[motion?.heading ?? art.stationaryHeading]!;
  const wanted =
    frames[
      whaleLoopFrame(
        scene.whaleArt,
        art,
        motion?.moving ?? false,
        scene.reducedMotion,
        whalePhase(id, art.idleMs * frames.length),
        scene.time.now,
      )
    ]!;
  const ready = frames.map((frame) => whaleTexture(scene, frame));
  const frame = ready[frames.indexOf(wanted)] ? wanted : ready[0] ? frames[0]! : undefined;
  if (!frame) {
    return false;
  }
  const point = scene.project(at);
  const key = id.includes("#") || !id.includes(":") ? id : `${id.split(":")[0]}#${kind}`;
  scene.passes(
    objectSprite(scene, key, frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y)),
  );
  return true;
}

/**
 * The holodisk turns from its own phase over the beacon, which pulses on its waypoint while
 * the holodisk's location is known and it is not yet recovered.
 */
export function drawHolodisk(scene: ObjectsContext, object: SpaceObject, point: Vec): void {
  const flight = scene.model.state.flight;
  const art = scene.holodiskArt!;
  const beacon = scene.beaconArt;
  if (
    beacon &&
    flight &&
    holodiskWaypoint(scene.model.state.progress[flight.galaxy].holodisk, [object])
  ) {
    // A light field holds the beacon on its base frame, with no pulse.
    const held = scene.light ? beacon.frames[LIGHT_FIELD.holodiskBeacon] : undefined;
    objectSprite(
      scene,
      `${object.id}${BEACON_SUFFIX}`,
      beacon.asset.id,
      held ?? beaconFrame(beacon, scene.reducedMotion, scene.time.now),
    )
      .setDisplaySize(beacon.asset.displayWidth!, beacon.asset.displayHeight!)
      .setOrigin(beacon.asset.pivot.x, beacon.asset.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(1.5);
  }
  const frame = holodiskFrame(
    art,
    scene.reducedMotion,
    loopPhase(object.id, art.loopMs),
    scene.time.now,
  );
  const sprite = objectSprite(scene, object.id, art.asset.id, frame)
    .setDisplaySize(art.asset.displayWidth!, art.asset.displayHeight!)
    .setOrigin(art.asset.pivot.x, art.asset.pivot.y)
    .setPosition(point.x, point.y)
    .setDepth(playDepth(point.y));
  keylineSprite(scene, "holodisk", object.id, sprite);
  scene.passes(sprite);
}

/**
 * The ammo pack's cartridge clip, its glint looping from rest from when the pack first draws;
 * reduced motion holds rest. On a light field it draws over its ink keyline.
 */
export function drawAmmoPack(scene: ObjectsContext, object: SpaceObject, point: Vec): void {
  const art = scene.ammoPackArt!;
  const since = scene.pickupSeen.get(object.id) ?? scene.time.now;
  scene.pickupSeen.set(object.id, since);
  const frame = ammoPackFrame(art, scene.reducedMotion, scene.time.now - since);
  const sprite = objectSprite(scene, object.id, art.asset.id, frame)
    .setDisplaySize(art.asset.displayWidth!, art.asset.displayHeight!)
    .setOrigin(art.asset.pivot.x, art.asset.pivot.y)
    .setPosition(point.x, point.y)
    .setDepth(playDepth(point.y));
  keylineSprite(scene, "ammoPickup", object.id, sprite);
}

/** A discovery cache stays hidden until Ada first approaches it, then loops its lights. */
export function drawCache(scene: ObjectsContext, object: SpaceObject, point: Vec): void {
  const flight = scene.model.state.flight!;
  const art = scene.cacheArt!;
  if (scene.litFlight !== flight.seed) {
    scene.litFlight = flight.seed;
    scene.litCaches.clear();
  }
  if (cacheApproached(CONTENT.tuning.safeRadius, flight.player, object)) {
    scene.litCaches.add(object.id);
  }
  const frame = cacheFrame(
    art,
    scene.litCaches.has(object.id),
    scene.reducedMotion,
    scene.time.now,
  );
  const sprite = objectSprite(scene, object.id, art.asset.id, frame)
    .setDisplaySize(art.asset.displayWidth!, art.asset.displayHeight!)
    .setOrigin(art.asset.pivot.x, art.asset.pivot.y)
    .setPosition(point.x, point.y);
  keylineSprite(scene, "discoveryCache", object.id, sprite);
}

/** Fallback without the station art: a ring hull and its safe-area outline. */
export function drawStationPlaceholder(scene: ObjectsContext, point: Vec, radius: number): void {
  const safe = ECONOMY.station.safeRadius;
  scene.ink.lineStyle(1, scene.palette.pointOfInterest, 0.35);
  scene.ink.strokeEllipse(point.x, point.y, safe * 2, safe);
  scene.ink.fillStyle(scene.palette.environment);
  scene.ink.lineStyle(2, scene.palette.pointOfInterest);
  scene.ink.fillEllipse(point.x, point.y, radius * 2.4, radius * 1.2);
  scene.ink.strokeEllipse(point.x, point.y, radius * 2.4, radius * 1.2);
}

/**
 * Art's Stardust gem with its glint loop from a per-pickup phase. A released pickup draws from
 * its release time and settles out from its wreck; a rock's appears in place; reduced motion
 * shows the rest frame where it lands.
 */
export function drawStardust(
  scene: ObjectsContext,
  object: SpaceObject,
  point: Vec,
  radius: number,
): void {
  const art = scene.stardustArt;
  const flight = scene.model.state.flight;
  if (flight && !stardustShown(object.release, flight.time)) {
    return;
  }
  if (!art || !flight) {
    scene.ink.fillStyle(scene.palette.active);
    scene.ink.fillCircle(point.x, point.y, radius / 2);
    return;
  }
  const at = stardustDrawn(
    scene.destruction?.pickups.settleMs ?? 110,
    scene.reducedMotion,
    object.release?.from && scene.project(object.release.from),
    object.release ? (flight.time - object.release.at) * 1000 : 0,
    point,
  );
  const frame = stardustFrame(
    art,
    scene.reducedMotion,
    stardustPhase(object.id, art.loopMs),
    scene.time.now,
  );
  const sprite = objectSprite(scene, object.id, art.asset.id, frame)
    .setDisplaySize(art.asset.displayWidth!, art.asset.displayHeight!)
    .setOrigin(art.asset.pivot.x, art.asset.pivot.y)
    .setPosition(at.x, at.y);
  keylineSprite(scene, "stardust", object.id, sprite);
}

/**
 * Art's destruction: shards and a flash, or under reduced motion the idle frame tinting,
 * shrinking and fading. Frigates and capitals, without shard art, keep the placeholder.
 */
export function drawWreck(scene: ObjectsContext, object: SpaceObject, point: Vec): void {
  const wreck = object.wreck;
  if (!wreck) {
    return;
  }
  const data = scene.destruction;
  const family = familyOf(scene, wreck.archetype);
  const shards = (family ? scene.familyShards.get(family.family) : scene.shards)?.get(
    wreck.archetype,
  );
  const timing = data?.archetypes[wreck.archetype];
  const art = familyArt(scene, wreck.archetype);
  if (!data || !shards || !timing || !art) {
    drawWreckPlaceholder(scene, wreck, point);
    return;
  }
  const time = wreck.age * 1000;
  const frame = selectEnemyFrame(art, wreck.facing);
  const width = frame.width ?? 96;
  const height = frame.height ?? 96;
  const scale = (frame.displayWidth ?? 42) / width;
  if (scene.reducedMotion) {
    const state = reducedAt(data, timing, time);
    if (state) {
      const sprite = objectSprite(scene, object.id, frame.id)
        .setDisplaySize(
          (frame.displayWidth ?? 42) * state.scale,
          (frame.displayHeight ?? 42) * state.scale,
        )
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setPosition(point.x, point.y)
        .setDepth(playDepth(point.y))
        .setAlpha(state.alpha)
        .setTint(state.tint);
      keylineSprite(scene, wreck.archetype, object.id, sprite);
      scene.passes(sprite);
    }
    return;
  }
  const pivot = { x: frame.pivot.x * width, y: frame.pivot.y * height };
  const pieces: EffectShape[] = [];
  for (const polygon of shardPolygons(
    data,
    shards,
    timing.durationMs,
    frame.directionIndex ?? 0,
    time,
  )) {
    if (polygon.alpha <= 0) {
      continue;
    }
    const points: Vec[] = [];
    for (let index = 0; index + 1 < polygon.points.length; index += 2) {
      points.push({
        x: point.x + (polygon.points[index]! - pivot.x) * scale,
        y: point.y + (polygon.points[index + 1]! - pivot.y) * scale,
      });
    }
    pieces.push({ alpha: polygon.alpha, colour: polygon.color, kind: "polygon", points });
  }
  drawEffect(scene, pieces, keylineEdges(scene, ["destructionShards"], pieces));
  const flash = wreckFlashAt(data, timing, wreck);
  if (flash && scene.textures.exists("destruction-flash")) {
    const flashWidth = flash.width * scale;
    objectSprite(scene, `${object.id}${FLASH_SUFFIX}`, "destruction-flash")
      .setDisplaySize(flashWidth, (flashWidth * data.flash.height) / data.flash.width)
      .setOrigin(0.5, 0.5)
      .setPosition(point.x, point.y)
      .setAlpha(flash.alpha)
      .setDepth(4);
  }
}

/** Fallback without shard art: hull fragments flying outward. */
export function drawWreckPlaceholder(
  scene: ObjectsContext,
  wreck: NonNullable<SpaceObject["wreck"]>,
  point: Vec,
): void {
  const timing = ECONOMY.destruction[wreck.archetype];
  const progress = Math.min(1, wreck.age / timing.durationSeconds);
  const size = Math.max(6, enemyCatalog[wreck.archetype].sizeRatio * 10);
  scene.ink.lineStyle(1.5, scene.palette.obstacle, 1 - progress);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 + Math.atan2(wreck.facing.y, wreck.facing.x);
    const reach = size * (0.3 + progress * 1.4);
    const x = point.x + Math.cos(angle) * reach;
    const y = point.y + Math.sin(angle) * reach * 0.5;
    scene.ink.lineBetween(
      x - Math.cos(angle + 1) * size * 0.3,
      y - Math.sin(angle + 1) * size * 0.15,
      x + Math.cos(angle + 1) * size * 0.3,
      y + Math.sin(angle + 1) * size * 0.15,
    );
  }
}

export function drawObject(scene: ObjectsContext, object: SpaceObject): void {
  // A heavy anywhere in the loaded region starts loading its parts before it comes into view.
  const family = (object.enemy && familyOf(scene, object.enemy.archetype)?.family) ?? "coral";
  if (object.enemy && !scene.partLoads.has(`${family}:${object.enemy.archetype}`)) {
    loadEnemyParts(scene, object.enemy.archetype);
  }
  const point = scene.project(object);
  const definition = object.enemy ? enemyCatalog[object.enemy.archetype] : undefined;
  const radius = definition
    ? Math.max(object.radius, definition.sizeRatio * CONTENT.tuning.flight.shipRadius * 2)
    : object.radius;
  const rock = object.asteroid ? rockArt(object.asteroid) : undefined;
  // Art's rocks reach past their footprint; cull by the drawn silhouette's reach.
  const reach = Math.max(radius, scenerySilhouette(object)?.reach ?? 0);
  if (
    point.x < -reach - 60 ||
    point.y < -reach - 60 ||
    point.x > SCREEN.width + reach + 60 ||
    point.y > SCREEN.height + reach + 60
  ) {
    return;
  }
  const color = spaceObjectColor(scene.palette, object);
  scene.ink.lineStyle(1.5, color);
  scene.ink.fillStyle(scene.palette.environment);
  switch (object.kind) {
    case "destination":
      drawDestination(scene, object, point, radius);
      break;
    case "station":
      drawStation(scene, object, point, radius);
      break;
    case "wreck":
      drawWreck(scene, object, point);
      break;
    case "hazard":
      scene.ink.strokeCircle(point.x, point.y, radius);
      scene.ink.lineBetween(
        point.x - radius / 2,
        point.y - radius / 2,
        point.x + radius / 2,
        point.y + radius / 2,
      );
      scene.ink.lineBetween(
        point.x + radius / 2,
        point.y - radius / 2,
        point.x - radius / 2,
        point.y + radius / 2,
      );
      break;
    case "enemy":
      drawEnemy(scene, point, object);
      break;
    case "pickup":
      if (scene.cacheArt && isDiscoveryCache(object)) {
        drawCache(scene, object, point);
        break;
      }
      if (carriesStardust(object)) {
        drawStardust(scene, object, point, radius);
        break;
      }
      if (scene.ammoPackArt && object.ammoPack) {
        drawAmmoPack(scene, object, point);
        break;
      }
      if (scene.light && object.upgrade && LIGHT_FIELD.keylined.includes("upgradePickup")) {
        // The square's ink keyline: a stroke 2 keyline wider on the same path.
        scene.ink.lineStyle(1.5 + 2 * LIGHT_FIELD.keyline, LIGHT_FIELD.ink);
        scene.ink.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
        scene.ink.lineStyle(1.5, color);
      }
      if (object.role === "cargo" && scene.textures.exists("ore-nugget")) {
        // Art's 11 px ore nugget, nearest-neighbour filtered.
        objectSprite(scene, object.id, "ore-nugget", 0)
          .setDisplaySize(11, 11)
          .setOrigin(0.5)
          .setPosition(point.x, point.y)
          .setDepth(playDepth(point.y));
        break;
      }
      scene.ink.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
      if (object.role === "cargo") {
        scene.ink.fillStyle(color);
        scene.ink.fillCircle(point.x, point.y, radius / 3);
      } else if (object.upgrade) {
        drawUpgradeChevrons(scene, object, point, color);
      }
      break;
    case "resource": {
      const art = object.asteroid && scene.resourceRocks.get(resourceArtId(object.asteroid));
      if (art) {
        drawAsteroidSprite(scene, object, point, art);
        break;
      }
      scene.ink.fillStyle(color);
      scene.ink.fillCircle(point.x, point.y, radius);
      break;
    }
    case "rock":
    case "debris": {
      if (object.kind === "debris" && drawTravelingDebris(scene, object, point)) {
        break;
      }
      if (rock) {
        drawAsteroidSprite(scene, object, point, rock);
        break;
      }
      scene.ink.fillEllipse(point.x, point.y, radius * 2, radius * 1.4);
      scene.ink.strokeEllipse(point.x, point.y, radius * 2, radius * 1.4);
      if (object.kind === "rock") {
        const detail = sceneryDetail(object.id);
        scene.ink.lineStyle(1, scene.palette.environmentDetail);
        scene.ink.strokePoints(
          detail.outline.map(
            (at) => new PhaserMath.Vector2(point.x + at.x * radius, point.y + at.y * radius),
          ),
          true,
        );
        for (const [start, end] of detail.seams) {
          scene.ink.lineBetween(
            point.x + start.x * radius,
            point.y + start.y * radius,
            point.x + end.x * radius,
            point.y + end.y * radius,
          );
        }
      }
      break;
    }
  }
}

/**
 * Art's rock at its pivot, in the spin frame for flight time, sorted by pivot screen y; a
 * drifting rock trails its stone chips (art/asteroids.md "Drift cue").
 */
export function drawAsteroidSprite(
  scene: ObjectsContext,
  object: SpaceObject,
  point: Vec,
  art: AsteroidArt,
  scale = 1,
): void {
  const flight = scene.model.state.flight!;
  const frame = rockFrame(
    art,
    flight.seed,
    scene.reducedMotion,
    object.id,
    flight.time,
    object.spinStart,
  );
  const texture = rockFrameTexture(scene, art, frame);
  if (!texture) {
    drawAsteroid(scene, point, footprintOutline(art, frame), scale);
    return;
  }
  const sprite = objectSprite(scene, object.id, texture)
    .setOrigin(art.pivot.x, art.pivot.y)
    .setDisplaySize(art.display.width * scale, art.display.height * scale)
    .setPosition(point.x, point.y)
    .setDepth(playDepth(point.y));
  keylineSprite(scene, "asteroid", object.id, sprite);
  const velocity = object.orbit ? object.velocity : undefined;
  if (!velocity) {
    return;
  }
  // The reverse drift, projected to screen.
  const behind = { x: velocity.y - velocity.x, y: -(velocity.x + velocity.y) / 2 };
  for (const chip of driftChips(art, flight.seed, frame, object.id, behind)) {
    scene.ink.fillStyle(hexNumber(scene.asteroidArt!.stone[1]!), chip.alpha);
    scene.ink.fillRect(
      point.x + chip.x - chip.size / 2,
      point.y + chip.y - chip.size / 2,
      chip.size,
      chip.size,
    );
  }
}

/** A rock whose frame has not loaded: its footprint in shadow stone, outlined on the union. */
export function drawAsteroid(
  scene: ObjectsContext,
  point: Vec,
  outline: AsteroidOutline,
  scale = 1,
): void {
  const stone = scene.asteroidArt.stone;
  scene.ink.fillStyle(hexNumber(stone.at(-1)!));
  for (const part of outline.parts) {
    scene.ink.fillPoints(
      part.map((at) => new PhaserMath.Vector2(point.x + at.x * scale, point.y + at.y * scale)),
      true,
    );
  }
  scene.ink.lineStyle(1.5, hexNumber(stone[1]!));
  for (const [start, end] of outline.edges) {
    scene.ink.lineBetween(
      point.x + start.x * scale,
      point.y + start.y * scale,
      point.x + end.x * scale,
      point.y + end.y * scale,
    );
  }
}
