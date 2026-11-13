import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import type { SpaceObject } from "../model/types.ts";
import { playDepth } from "./asteroidArt.ts";
import { selectEnemyFrame } from "./enemyArt.ts";
import { drawOutpost, type ObjectsContext, placeStationFrame } from "./sceneObjects.ts";
import type { Asset } from "./sceneShared.ts";
import { objectSprite } from "./sceneSprites.ts";
import { readBlinkArt, type StationArt } from "./stationArt.ts";

interface AndromedaArt {
  readonly dented: Asset | undefined;
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
    scene.passes(
      objectSprite(scene, object.id, frame.id)
        .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setPosition(point.x, point.y)
        .setDepth(playDepth(point.y)),
    );
    return true;
  }
  const art = artFor(scene.shipAssets);
  if (object.id === ANDROMEDA_PLACES.beacon) {
    if (scene.model.state.progress[5].questComplete) {
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
