// Stardust zips and rock breaks.
// Functions over the scene's EffectsContext.
import type { Scene } from "phaser";

import { CONTENT } from "../data/content.ts";
import { resourceArtId } from "../data/resourceRocks.ts";
import { rockFrame } from "../model/asteroids.ts";
import { playDepth, rockArt } from "./asteroidArt.ts";
import { reducedAt } from "./destructionArt.ts";
import { zipAt } from "./pickupZip.ts";
import type { GameScene } from "./scene.ts";
import { rockFrameTexture } from "./sceneAssets.ts";
import { keylineSprite } from "./sceneHud.ts";

/** The scene state and methods this module's functions use. */
export type EffectsContext = Scene &
  Pick<
    GameScene,
    | "add"
    | "asteroidArt"
    | "backdropRules"
    | "backdrops"
    | "buoyArt"
    | "cache"
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
    | "enemySprites"
    | "familyArts"
    | "familyParts"
    | "familyShards"
    | "feedback"
    | "frameTops"
    | "galaxyBackdrops"
    | "galaxyLoads"
    | "galaxyManifestPaths"
    | "galaxyManifests"
    | "galaxyStations"
    | "glintSprite"
    | "hubArt"
    | "indicatorInk"
    | "jobArt"
    | "keyed"
    | "keylines"
    | "light"
    | "load"
    | "loads"
    | "manifest"
    | "model"
    | "overlay"
    | "paintAssets"
    | "paintLoads"
    | "palette"
    | "partAssets"
    | "partLoads"
    | "project"
    | "quantum"
    | "rasters"
    | "reducedMotion"
    | "resourceFiles"
    | "resourceRocks"
    | "rockBreaks"
    | "rockQueued"
    | "rockRequests"
    | "scale"
    | "shell"
    | "shipAssets"
    | "silhouettes"
    | "storyNoses"
    | "strandedCraft"
    | "streakSpec"
    | "textures"
    | "time"
    | "towLine"
    | "useCallout"
    | "whaleArt"
    | "whaleRequests"
    | "whirlpoolProjects"
    | "zips"
  >;

/**
 * Each pickup collected this step zips into the ship as it last showed (its sprite copied);
 * reduced motion, or a pickup drawn without a sprite, shows none.
 */
export function startZips(scene: EffectsContext, nowMs: number): void {
  if (scene.reducedMotion) {
    return;
  }
  for (const event of scene.model.flightEvents) {
    if (event.type !== "collected") {
      continue;
    }
    const source = event.lostItem ? scene.glintSprite : scene.enemySprites.get(event.id);
    if (!source?.visible) {
      continue;
    }
    const sprite = scene.add
      .image(source.x, source.y, source.texture.key, source.frame.name)
      .setOrigin(source.originX, source.originY)
      .setDisplaySize(source.displayWidth, source.displayHeight)
      .setDepth(source.depth);
    if (source.isTinted) {
      sprite.setTint(source.tintTopLeft).setTintMode(source.tintMode);
    }
    scene.zips.push({
      from: { x: event.x, y: event.y },
      height: source.displayHeight,
      sprite,
      startedMs: nowMs,
      width: source.displayWidth,
    });
  }
}

/** Moves each zipping pickup toward Ada for CONTENT's pickupZip, then removes it. */
export function drawZips(scene: EffectsContext): void {
  const flight = scene.model.state.flight;
  scene.zips = scene.zips.filter((zip) => {
    const state =
      flight &&
      zipAt(
        CONTENT.tuning.flight.pickupZip,
        (scene.time.now - zip.startedMs) / 1000,
        zip.from,
        flight.player,
      );
    if (!state) {
      zip.sprite.destroy();
      return false;
    }
    const point = scene.project(state.at);
    zip.sprite
      .setPosition(point.x, point.y)
      .setDisplaySize(zip.width * state.scale, zip.height * state.scale)
      .setVisible(true);
    return true;
  });
}

/** Each rock destroyed this step breaks where it stood, in the frame it last showed. */
export function startRockBreaks(scene: EffectsContext, nowMs: number): void {
  const flight = scene.model.state.flight;
  const catalog = scene.asteroidArt;
  if (!flight || !catalog) {
    return;
  }
  for (const event of scene.model.flightEvents) {
    const art =
      event.type === "asteroidDestroyed" &&
      (event.resource
        ? scene.resourceRocks.get(resourceArtId(event.asteroid))
        : rockArt(event.asteroid));
    if (art && event.type === "asteroidDestroyed") {
      scene.rockBreaks.push({
        art,
        at: { x: event.x, y: event.y },
        frame: rockFrame(art, flight.seed, scene.reducedMotion, event.id, flight.time),
        id: event.id,
        startedMs: nowMs,
      });
    }
  }
}

/**
 * Destroyed rocks take the archetype-independent destruction (art/asteroids.md
 * "Destruction"): shrink about the pivot, multiply darken and fade linearly, at every motion
 * setting. Asteroid timings are not authored; the fighter's reduced timing stands in.
 */
export function drawRockBreaks(scene: EffectsContext): void {
  const data = scene.destruction;
  const timing = data?.archetypes.fighter;
  scene.rockBreaks = scene.rockBreaks.filter((rock) => {
    const state = data && timing ? reducedAt(data, timing, scene.time.now - rock.startedMs) : null;
    const texture = rockFrameTexture(scene, rock.art, rock.frame);
    if (!state || !texture) {
      rock.sprite?.destroy();
      return false;
    }
    const point = scene.project(rock.at);
    rock.sprite ??= scene.add.image(0, 0, texture);
    rock.sprite
      .setOrigin(rock.art.pivot.x, rock.art.pivot.y)
      .setDisplaySize(rock.art.display.width * state.scale, rock.art.display.height * state.scale)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y))
      .setAlpha(state.alpha)
      .setTint(state.tint)
      .setVisible(true);
    keylineSprite(scene, "asteroid", `break:${rock.id}`, rock.sprite);
    return true;
  });
}
