import {
  boundsOnScreen,
  frameBounds,
  partKey,
  playDepth,
  readBlinkArt,
  type StationArt,
  stationFrame,
} from "../art/index.ts";
import { ANDROMEDA_LANE_COURIER, ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { ANDROMEDA_REDACT } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { SCREEN } from "../data/screen.ts";
import { andromedaLaneCourier } from "../model/andromedaLane.ts";
import type { FlightState, SpaceObject } from "../model/types.ts";
import { selectEnemyFrame } from "./enemyArt.ts";
import { keylineSprite } from "./sceneHud.ts";
import { drawOutpost, type ObjectsContext, placeStationFrame } from "./sceneObjects.ts";
import type { Asset } from "./sceneShared.ts";
import { objectSprite } from "./sceneSprites.ts";
import type { WorldContext } from "./sceneWorld.ts";

/** A passing courier is scenery and acknowledges sight only from a visible, textured frame. */
export function drawAndromedaLaneCourier(scene: WorldContext, flight: FlightState): void {
  const craft = scene.craftArt.get("pip");
  const { model } = scene;
  if (!craft) {
    return;
  }
  const courier = andromedaLaneCourier(
    { baseSpeed: CONTENT.tuning.physics.maxSpeed, progress: model.state.progress[5] },
    flight,
  );
  if (!courier) {
    return;
  }
  const point = scene.project(courier);
  const frame = selectEnemyFrame(craft, courier.heading);
  if (!scene.textures.exists(frame.id) || !boundsOnScreen(SCREEN, point, frameBounds(frame))) {
    return;
  }
  const id = partKey(ANDROMEDA_PLACES.beacon, ANDROMEDA_LANE_COURIER.id);
  const sprite = objectSprite(scene, id, frame.id)
    .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
    .setOrigin(frame.pivot.x, frame.pivot.y)
    .setPosition(point.x, point.y)
    .setDepth(playDepth(point.y));
  keylineSprite(scene, "storyCraft", id, sprite);
  scene.passes(sprite);
  if (scene.flightLive && !scene.warpCover) {
    model.andromedaCourierDisplayed(flight);
  }
}

interface AndromedaArt {
  readonly dented: Asset | undefined;
  readonly relay: StationArt<Asset> | undefined;
  readonly relit: StationArt<Asset> | undefined;
  readonly settlements: ReadonlyMap<string, StationArt<Asset>>;
}
const artCache = new WeakMap<readonly Asset[], AndromedaArt>();
function artFor(assets: readonly Asset[]): AndromedaArt {
  let art = artCache.get(assets);
  if (!art) {
    const settlements = new Map<string, StationArt<Asset>>();
    for (const variant of ["hamlet", "lamphouse"]) {
      const frames = readBlinkArt(assets, `outpost-${variant}-a`, `outpost-${variant}-b`);
      if (frames) {
        settlements.set(variant, frames);
      }
    }
    art = {
      dented: assets.find(({ id }) => id === "beacon-guide-dented"),
      relay: readBlinkArt(assets, "beacon-guide-lit-a", "beacon-guide-lit-b"),
      relit: readBlinkArt(assets, "beacon-guide-relit-a", "beacon-guide-relit-b"),
      settlements,
    };
    artCache.set(assets, art);
  }
  return art;
}

/** Seeded cell parity assigns an authored settlement design without changing its saved site. */
export function andromedaSettlementVariant(id: string): string | undefined {
  const match = /^settlement:(-?\d+),(-?\d+)$/u.exec(id);
  return match
    ? ["hamlet", "lamphouse"][Math.abs(Number(match[1]) + Number(match[2])) % 2]
    : undefined;
}

/** Story craft and places retain their canonical identities and reuse the published artwork. */
export function drawAndromeda(scene: ObjectsContext, object: SpaceObject): boolean {
  const flight = scene.model.state.flight;
  if (flight?.galaxy !== 5 || object.kind !== "destination") {
    return false;
  }
  const point = scene.project(object);
  if (object.id === ANDROMEDA_PLACES.pip) {
    const craft = scene.craftArt.get("pip");
    if (!craft) {
      return false;
    }
    const frame = selectEnemyFrame(craft, {
      x: flight.player.x - object.x,
      y: flight.player.y - object.y,
    });
    if (!scene.textures.exists(frame.id)) {
      return false;
    }
    const sprite = objectSprite(scene, object.id, frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y));
    keylineSprite(scene, "storyCraft", object.id, sprite);
    scene.passes(sprite);
    return true;
  }
  const relay = object.id === ANDROMEDA_REDACT.relayId;
  const progress = scene.model.state.progress[5];
  if (relay && progress.redact?.phase !== "resolved") {
    return true;
  }
  const assets = scene.galaxyManifests.get(5)?.assets;
  if (!assets) {
    return false;
  }
  const art = artFor(assets);
  if (relay) {
    const frame = art.relay && stationFrame(art.relay, scene.reducedMotion, scene.time.now);
    if (!frame || !scene.textures.exists(frame.id)) {
      return false;
    }
    placeStationFrame(scene, frame, "guideBeacon", object, point);
    return true;
  }
  if (object.id === ANDROMEDA_PLACES.beacon) {
    if (progress.questComplete) {
      if (!art.relit || !art.relit.frames.every((frame) => scene.textures.exists(frame.id))) {
        return false;
      }
      drawOutpost(scene, art.relit, object, point);
    } else {
      if (!art.dented || !scene.textures.exists(art.dented.id)) {
        return false;
      }
      placeStationFrame(scene, art.dented, "outpost", object, point);
    }
    return true;
  }
  const variant = andromedaSettlementVariant(object.id);
  const settlement = variant && art.settlements.get(variant);
  if (!settlement || !settlement.frames.every((frame) => scene.textures.exists(frame.id))) {
    return false;
  }
  drawOutpost(scene, settlement, object, point);
  return true;
}
