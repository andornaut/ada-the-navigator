// The space backdrop: sky, far items, plates, stars and streaks.
// Functions over the scene's BackdropContext.
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/view/renderScale";
import { BlendModes, Math as PhaserMath } from "phaser";

import { SCREEN } from "../data/screen.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { FlightState } from "../model/types.ts";
import { BACKDROP_FIELD, backdropRock, backdropTint, hexNumber } from "./asteroidArt.ts";
import {
  type BackdropRules,
  clusterReach,
  type GalaxyBackdrop,
  paintCluster,
  paintDisc,
  paintPlanet,
  paintSky,
  planetReach,
  SKY_AREA,
  streakPieces,
  viewFar,
  viewPlanets,
  viewPlates,
  viewStars,
  viewStreaks,
} from "./backdropLayers.ts";
import { BACKDROP_DEPTH } from "./drawOrder.ts";
import { viewDecorations } from "./rareDecorations.ts";
import type { GameScene } from "./scene.ts";
import { bakeScale, bakeTexture, rockTexture } from "./sceneAssets.ts";
import { STREAK_PIECES } from "./sceneShared.ts";

/** The scene state and methods this module's functions use. */
export type BackdropContext = Pick<
  GameScene,
  | "add"
  | "asteroidArt"
  | "backdropImage"
  | "backdropItems"
  | "backdropRules"
  | "backdropSprites"
  | "backdrops"
  | "buoyArt"
  | "cache"
  | "children"
  | "coreAssetIds"
  | "craftArt"
  | "debrisArt"
  | "destruction"
  | "enemyArt"
  | "familyArts"
  | "familyParts"
  | "familyShards"
  | "galaxyBackdrops"
  | "galaxyLoads"
  | "galaxyManifestPaths"
  | "galaxyManifests"
  | "galaxyStations"
  | "hubArt"
  | "jobArt"
  | "load"
  | "loads"
  | "manifest"
  | "model"
  | "paintAssets"
  | "paintLoads"
  | "partAssets"
  | "partLoads"
  | "plateInk"
  | "projectLayer"
  | "rasters"
  | "reducedMotion"
  | "resourceFiles"
  | "resourceRocks"
  | "rockQueued"
  | "rockRequests"
  | "scale"
  | "shell"
  | "shipAssets"
  | "skyImage"
  | "starImages"
  | "storyNoses"
  | "strandedCraft"
  | "streakInk"
  | "streakSpec"
  | "textures"
  | "time"
  | "towLine"
  | "whaleArt"
  | "whaleRequests"
  | "whirlpoolProjects"
>;

/** The flight's galaxy's fixed backdrop layer, on the play view's centre, or none. */
export function drawBackdropLayer(scene: BackdropContext, galaxy: GalaxyNumber | null): void {
  const layer = galaxy === null ? undefined : scene.backdrops.get(galaxy);
  if (!layer) {
    scene.backdropImage?.setVisible(false);
    return;
  }
  scene.backdropImage ??= scene.add.image(0, 0, layer.asset).setDepth(BACKDROP_DEPTH.fixed);
  scene.backdropImage
    .setTexture(layer.asset)
    .setOrigin(0.5, 0.5)
    .setPosition(SCREEN.width / 2, SCREEN.height / 2)
    .setDisplaySize(layer.width, layer.height)
    .setVisible(true);
}

/**
 * The flight galaxy's backdrop layers under every play object (art/backdrop.md), or none: the
 * sky, the far items and planets, the plates, the stars and the dust streaks, for the camera at
 * Ada's world position. The fixed layers draw with drawBackdropLayer.
 */
export function drawBackdropLayers(scene: BackdropContext, flight: FlightState | null): void {
  const rules = scene.backdropRules;
  const backdrop = flight ? scene.galaxyBackdrops.get(flight.galaxy) : undefined;
  scene.skyImage?.setVisible(false);
  scene.plateInk?.multiply.clear();
  scene.plateInk?.screen.clear();
  scene.streakInk?.clear();
  for (const image of scene.starImages) {
    image.setVisible(false);
  }
  const used = new Set<string>();
  if (flight && rules && backdrop) {
    const camera = [flight.player.x, flight.player.y] as const;
    drawSky(scene, flight.galaxy, backdrop);
    drawFarItems(scene, rules, flight.galaxy, backdrop, camera, used);
    drawDecorations(scene, flight.galaxy, backdrop, camera, used);
    drawPlates(scene, rules, backdrop, camera);
    drawStars(scene, rules, backdrop, camera);
    drawStreaks(scene, rules, backdrop, camera);
  }
  for (const [key, image] of scene.backdropItems) {
    if (!used.has(key)) {
      image.destroy();
      scene.backdropItems.delete(key);
      // Baked planets and clusters are released with their image; nebulae keep their texture.
      if (scene.textures.exists(key)) {
        scene.textures.remove(key);
      }
    }
  }
}

/** L0: the galaxy's sky, one quad over the view, baked once at a quarter texel per px. */
export function drawSky(
  scene: BackdropContext,
  galaxy: GalaxyNumber,
  backdrop: GalaxyBackdrop,
): void {
  const key = `backdrop-sky-${galaxy}`;
  bakeTexture(scene, key, () => paintSky(backdrop.sky, 1 / 4));
  scene.skyImage ??= scene.add
    .image(0, 0, key)
    .setDepth(BACKDROP_DEPTH.sky)
    .setOrigin(0, 0)
    .setVertexRoundMode("off");
  scene.skyImage
    .setTexture(key)
    .setPosition(SKY_AREA.x, SKY_AREA.y)
    .setDisplaySize(SKY_AREA.width, SKY_AREA.height)
    .setVisible(true);
}

/** The image drawing backdrop item `key` this frame, made on first use. */
export function backdropItem(
  scene: BackdropContext,
  key: string,
  texture: string,
  depth: number,
  used: Set<string>,
) {
  used.add(key);
  let image = scene.backdropItems.get(key);
  if (!image) {
    image = scene.add.image(0, 0, texture).setDepth(depth).setVertexRoundMode("off");
    scene.backdropItems.set(key, image);
  }
  return image.setVisible(true);
}

/**
 * L2: the far items (nebula textures and baked star clusters) and the baked planets in view,
 * each released once it leaves.
 */
export function drawFarItems(
  scene: BackdropContext,
  rules: BackdropRules,
  galaxy: GalaxyNumber,
  backdrop: GalaxyBackdrop,
  camera: readonly [number, number],
  used: Set<string>,
): void {
  const scale = bakeScale(scene);
  for (const item of viewFar(rules, backdrop, camera)) {
    const { recipe } = item;
    if (recipe.look === "nebula") {
      const asset = recipe.assets[item.variant]!;
      if (scene.textures.exists(asset)) {
        backdropItem(scene, `backdrop-nebula-${galaxy}-${item.id}`, asset, BACKDROP_DEPTH.far, used)
          .setPosition(item.x, item.y)
          .setDisplaySize(rules.nebula.display[0], rules.nebula.display[1]);
      }
      continue;
    }
    const key = `backdrop-cluster-${galaxy}-${item.id}`;
    bakeTexture(scene, key, () => paintCluster(rules, backdrop.seed, item, recipe, scale));
    const [width, height] = clusterReach(rules);
    backdropItem(scene, key, key, BACKDROP_DEPTH.far, used)
      .setPosition(item.x, item.y)
      .setDisplaySize(2 * width, 2 * height);
  }
  for (const planet of viewPlanets(rules, backdrop, camera)) {
    const key = `backdrop-planet-${galaxy}-${planet.id}`;
    bakeTexture(scene, key, () => paintPlanet(rules, planet, scale));
    const size = 2 * planetReach(planet.r);
    backdropItem(scene, key, key, BACKDROP_DEPTH.planets, used)
      .setPosition(planet.x, planet.y)
      .setDisplaySize(size, size);
  }
}

/** Shared distant decorations have no model objects or per-instance baked textures. */
export function drawDecorations(
  scene: BackdropContext,
  galaxy: GalaxyNumber,
  backdrop: GalaxyBackdrop,
  camera: readonly [number, number],
  used: Set<string>,
): void {
  if (scene.model.galaxyMapShownInFlight) {
    return;
  }
  for (const item of viewDecorations(backdrop, camera)) {
    if (!scene.textures.exists(item.asset)) {
      continue;
    }
    backdropItem(
      scene,
      `backdrop-decoration-${galaxy}-${item.id}`,
      item.asset,
      BACKDROP_DEPTH.decorations,
      used,
    )
      .setPosition(item.x, item.y)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(item.width, item.height)
      .setAngle(item.rotation);
  }
}

/** L1: the plates in view, darker steps multiplied by their grey, lighter ones screened. */
export function drawPlates(
  scene: BackdropContext,
  rules: BackdropRules,
  backdrop: GalaxyBackdrop,
  camera: readonly [number, number],
): void {
  scene.plateInk ??= {
    multiply: scene.add
      .graphics()
      .setDepth(BACKDROP_DEPTH.multiply)
      .setBlendMode(BlendModes.MULTIPLY)
      .setVertexRoundMode("off"),
    screen: scene.add
      .graphics()
      .setDepth(BACKDROP_DEPTH.screen)
      .setBlendMode(BlendModes.SCREEN)
      .setVertexRoundMode("off"),
  };
  for (const plate of viewPlates(rules, backdrop, camera)) {
    const points = plate.points.map(([x, y]) => new PhaserMath.Vector2(x, y));
    if (plate.multiply !== undefined) {
      const grey = Math.round(plate.multiply * 255);
      scene.plateInk.multiply.fillStyle((grey << 16) | (grey << 8) | grey, 1);
      scene.plateInk.multiply.fillPoints(points, true);
    } else if (plate.screen) {
      scene.plateInk.screen.fillStyle(hexNumber(plate.screen), 1);
      scene.plateInk.screen.fillPoints(points, true);
    }
  }
}

/** L3: both star depths as tinted antialiased discs, unsnapped, with their twinkle. */
export function drawStars(
  scene: BackdropContext,
  rules: BackdropRules,
  backdrop: GalaxyBackdrop,
  camera: readonly [number, number],
): void {
  const tint = hexNumber(backdrop.stars.color);
  const stars = viewStars(rules, backdrop, camera, scene.time.now / 1000, scene.reducedMotion);
  for (const [index, star] of stars.entries()) {
    const key = `backdrop-star-${star.r}`;
    bakeTexture(scene, key, () => paintDisc(star.r, MAX_RENDER_SCALE));
    let image = scene.starImages[index];
    if (!image) {
      image = scene.add.image(0, 0, key).setDepth(BACKDROP_DEPTH.stars).setVertexRoundMode("off");
      scene.starImages.push(image);
    }
    const size = scene.textures.get(key).source[0]!.width / MAX_RENDER_SCALE;
    image
      .setTexture(key)
      .setPosition(star.x, star.y)
      .setDisplaySize(size, size)
      .setTint(tint)
      .setAlpha(star.alpha)
      .setVisible(true);
  }
}

/** L4: the dust streaks, 1 px lines fading to clear at both ends along a half sine. */
export function drawStreaks(
  scene: BackdropContext,
  rules: BackdropRules,
  backdrop: GalaxyBackdrop,
  camera: readonly [number, number],
): void {
  scene.streakInk ??= scene.add
    .graphics()
    .setDepth(BACKDROP_DEPTH.streaks)
    .setVertexRoundMode("off");
  const color = hexNumber(backdrop.streaks.color);
  for (const streak of viewStreaks(rules, backdrop, camera)) {
    for (const piece of streakPieces(streak, STREAK_PIECES)) {
      scene.streakInk.lineStyle(rules.streaks.width, color, backdrop.streaks.alpha * piece.fade);
      scene.streakInk.lineBetween(piece.from[0], piece.from[1], piece.to[0], piece.to[1]);
    }
  }
}

/**
 * Backdrop rocks under every play object, at the debris layer's rock parallax: one greyscale
 * sprite per filled field cell, multiplied by the galaxy's backdropLit, at 0.6 to 1 times its
 * display size.
 */
export function drawBackdrop(
  scene: BackdropContext,
  flight: NonNullable<typeof scene.model.state.flight>,
): void {
  const catalog = scene.asteroidArt;
  if (!catalog) {
    return;
  }
  const tint = hexNumber(backdropTint(catalog, flight.galaxy).backdropLit);
  const { cell } = BACKDROP_FIELD;
  const parallax = scene.backdropRules?.rocks.parallax ?? 1;
  const span = Math.ceil((Math.max(SCREEN.width, SCREEN.height) * 1.5) / cell) + 1;
  const gx = Math.floor((flight.player.x * parallax) / cell);
  const gy = Math.floor((flight.player.y * parallax) / cell);
  const used = new Set<string>();
  for (let x = gx - span; x <= gx + span; x++) {
    for (let y = gy - span; y <= gy + span; y++) {
      const rock = backdropRock(catalog, flight.seed, x, y);
      if (!rock || !rockTexture(scene, rock.sprite.file)) {
        continue;
      }
      const point = scene.projectLayer(rock, parallax);
      const width = rock.sprite.display.width * rock.scale;
      const height = rock.sprite.display.height * rock.scale;
      if (
        point.x < -width ||
        point.y < -height ||
        point.x > SCREEN.width + width ||
        point.y > SCREEN.height + height
      ) {
        continue;
      }
      const key = `${x},${y}`;
      used.add(key);
      let sprite = scene.backdropSprites.get(key);
      if (!sprite) {
        sprite = scene.add.image(0, 0, rock.sprite.file).setDepth(-1);
        scene.backdropSprites.set(key, sprite);
      }
      sprite
        .setTexture(rock.sprite.file)
        .setOrigin(rock.sprite.pivot.x, rock.sprite.pivot.y)
        .setDisplaySize(width, height)
        .setPosition(point.x, point.y)
        .setTint(tint)
        .setVisible(true);
    }
  }
  for (const [key, sprite] of scene.backdropSprites) {
    if (!used.has(key)) {
      sprite.destroy();
      scene.backdropSprites.delete(key);
    }
  }
}
