// The space backdrop: sky, far items, plates, stars and streaks.
// Functions over the scene's BackdropContext.
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/runtime/view/renderScale";
import { BlendModes, Geom, TintModes } from "phaser";

import {
  BACKDROP_DEPTH,
  type BackdropRock,
  backdropRock,
  backdropRockDepth,
  type BackdropRockRule,
  type BackdropRules,
  backdropTint,
  clusterReach,
  type GalaxyBackdrop,
  hexNumber,
  paintCluster,
  paintDisc,
  paintPlanet,
  paintSky,
  planetReach,
  SKY_AREA,
  streakEnds,
  viewDecorations,
  viewFar,
  viewPlanets,
  viewPlates,
  viewStars,
  viewStreaks,
} from "../art/index.ts";
import type { AsteroidArtCatalog } from "../data/asteroidCatalog.ts";
import { SCREEN } from "../data/screen.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { FlightState } from "../model/types.ts";
import { storyBackdropRect } from "../ui/layout/storyPage.ts";
import { canvasSize, sceneFit } from "./playCamera.ts";
import type { GameScene } from "./scene.ts";
import { bakeScale, bakeTexture, rockTexture } from "./sceneAssets.ts";

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
  | "rasters"
  | "reducedMotion"
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
export function drawBackdropLayer(
  scene: BackdropContext,
  galaxy: GalaxyNumber | null,
  fullBleed = false,
): void {
  const layer = galaxy === null ? undefined : scene.backdrops.get(galaxy);
  if (!layer) {
    scene.backdropImage?.setVisible(false);
    return;
  }
  const rect = fullBleed ? storyBackdropRect(canvasSize(sceneFit(scene)), layer) : null;
  scene.backdropImage ??= scene.add.image(0, 0, layer.asset).setDepth(BACKDROP_DEPTH.fixed);
  scene.backdropImage
    .setTexture(layer.asset)
    .setOrigin(0.5, 0.5)
    .setPosition(SCREEN.width / 2, SCREEN.height / 2)
    .setDisplaySize(rect?.width ?? layer.width, rect?.height ?? layer.height)
    .setVisible(true);
}

/**
 * The flight galaxy's backdrop layers under every play object (art/backdrop.md), or none: the
 * sky, the far items and planets, the plates, the stars and the dust streaks, for the camera at
 * Ada's world position. The fixed layers draw with drawBackdropLayer.
 */
export function drawBackdropLayers(
  scene: BackdropContext,
  flight: FlightState | null,
  presentationGalaxy: GalaxyNumber | null = null,
): void {
  const rules = scene.backdropRules;
  const galaxy = flight?.galaxy ?? presentationGalaxy;
  const backdrop = galaxy === null ? undefined : scene.galaxyBackdrops.get(galaxy);
  scene.skyImage?.setVisible(false);
  scene.plateInk?.multiply.clear();
  scene.plateInk?.screen.clear();
  scene.streakInk?.clear();
  for (const image of scene.starImages) {
    image.setVisible(false);
  }
  const used = new Set<string>();
  let plateTriangles = 0;
  if (galaxy !== null && rules && backdrop) {
    const camera = flight ? ([flight.player.x, flight.player.y] as const) : ([0, 0] as const);
    drawSky(scene, galaxy, backdrop, !flight && presentationGalaxy !== null);
    drawFarItems(scene, rules, galaxy, backdrop, camera, used);
    drawDecorations(scene, galaxy, backdrop, camera, used);
    plateTriangles = drawPlates(scene, rules, backdrop, camera);
    drawStars(scene, rules, backdrop, camera);
    drawStreaks(scene, rules, backdrop, camera);
  }
  scene.shell.setBackdropPlates(plateTriangles);
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
  fullBleed = false,
): void {
  const key = `backdrop-sky-${galaxy}`;
  bakeTexture(scene, key, () => paintSky(backdrop.sky, 1 / 4));
  scene.skyImage ??= scene.add
    .image(0, 0, key)
    .setDepth(BACKDROP_DEPTH.sky)
    .setOrigin(0, 0)
    .setVertexRoundMode("off");
  const rect = fullBleed ? storyBackdropRect(canvasSize(sceneFit(scene)), SKY_AREA) : SKY_AREA;
  scene.skyImage
    .setTexture(key)
    .setPosition(rect.x, rect.y)
    .setDisplaySize(rect.width, rect.height)
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
      .setRenderNodeRole("BatchHandler", "BatchHandlerQuadSingle")
      .setPosition(item.x, item.y)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(item.width, item.height)
      .setAngle(item.rotation);
  }
}

// A motif's triangles as vertex indices into its rings laid end to end, edge ring first: the
// rings filled even-odd, each hole ring cut from the edge.
const motifTriangles = new WeakMap<GalaxyBackdrop["plates"]["motif"], readonly number[]>();

function trianglesOf(motif: GalaxyBackdrop["plates"]["motif"]): readonly number[] {
  let triangles = motifTriangles.get(motif);
  if (!triangles) {
    const holes: number[] = [];
    let count = 0;
    for (const ring of motif.rings) {
      if (count > 0) {
        holes.push(count);
      }
      count += ring.length;
    }
    triangles = Geom.Polygon.Earcut(motif.rings.flat(2), holes);
    motifTriangles.set(motif, triangles);
  }
  return triangles;
}

/**
 * L1: the motif plates in view, darker steps multiplied by their grey, lighter ones screened,
 * each drawn as its motif's triangles so hole rings stay clear. Returns the triangles filled.
 */
export function drawPlates(
  scene: BackdropContext,
  rules: BackdropRules,
  backdrop: GalaxyBackdrop,
  camera: readonly [number, number],
): number {
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
  const triangles = trianglesOf(backdrop.plates.motif);
  let filled = 0;
  for (const plate of viewPlates(rules, backdrop, camera)) {
    const grey = plate.multiply === undefined ? 0 : Math.round(plate.multiply * 255);
    const ink =
      plate.multiply === undefined
        ? scene.plateInk.screen.fillStyle(hexNumber(plate.screen!), 1)
        : scene.plateInk.multiply.fillStyle((grey << 16) | (grey << 8) | grey, 1);
    const points = plate.rings.flat();
    for (let k = 0; k < triangles.length; k += 3) {
      const a = points[triangles[k]!]!;
      const b = points[triangles[k + 1]!]!;
      const c = points[triangles[k + 2]!]!;
      ink.fillTriangle(a[0], a[1], b[0], b[1], c[0], c[1]);
      filled++;
    }
  }
  return filled;
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

/** L4: the dust streaks, 1 px lines of one length at the galaxy's angle and alpha. */
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
  scene.streakInk.lineStyle(
    rules.streaks.width,
    hexNumber(backdrop.streaks.color),
    backdrop.streaks.alpha,
  );
  for (const streak of viewStreaks(rules, backdrop, camera)) {
    const [from, to] = streakEnds(streak);
    scene.streakInk.lineBetween(from[0], from[1], to[0], to[1]);
  }
}

/** A seeded backdrop rock with its drawn size, depth and the keys of its two sprites. */
interface RockCell {
  readonly depth: number;
  /** The background-filled silhouette under the rock. */
  readonly fill: string;
  readonly height: number;
  readonly key: string;
  readonly rock: BackdropRock;
  readonly width: number;
}

/** One rock depth's rocks in the cells around the camera's cell, rebuilt when that cell changes. */
interface RockWindow {
  readonly catalog: AsteroidArtCatalog;
  readonly cells: readonly RockCell[];
  readonly galaxy: GalaxyNumber;
  readonly gx: number;
  readonly gy: number;
  readonly rule: BackdropRockRule;
  readonly seed: number;
}

const rockWindows = new WeakMap<BackdropContext, Map<string, RockWindow>>();

/** The rock depths back to front: far rocks under the specks and rocks. */
const ROCK_DEPTHS = [
  { band: BACKDROP_DEPTH.farRocks, name: "far", rule: (rules: BackdropRules) => rules.farRocks },
  { band: BACKDROP_DEPTH.rocks, name: "near", rule: (rules: BackdropRules) => rules.rocks },
] as const;

function releaseSprite(scene: BackdropContext, key: string): void {
  const sprite = scene.backdropSprites.get(key);
  if (sprite) {
    sprite.destroy();
    scene.backdropSprites.delete(key);
  }
}

function releaseRock(scene: BackdropContext, cell: RockCell): void {
  releaseSprite(scene, cell.fill);
  releaseSprite(scene, cell.key);
}

/** The window of rock depth `name` for the camera's cell, its sprites released as cells leave. */
function rockWindow(
  scene: BackdropContext,
  catalog: AsteroidArtCatalog,
  flight: FlightState,
  depth: (typeof ROCK_DEPTHS)[number],
  rule: BackdropRockRule,
): RockWindow {
  const windows = rockWindows.get(scene) ?? new Map<string, RockWindow>();
  rockWindows.set(scene, windows);
  const { cell, parallax } = rule;
  const gx = Math.floor((flight.player.x * parallax) / cell);
  const gy = Math.floor((flight.player.y * parallax) / cell);
  const last = windows.get(depth.name);
  const same =
    last?.catalog === catalog &&
    last.rule === rule &&
    last.galaxy === flight.galaxy &&
    last.seed === flight.seed;
  if (same && last.gx === gx && last.gy === gy) {
    return last;
  }
  const span = Math.ceil((Math.max(SCREEN.width, SCREEN.height) * 1.5) / cell) + 1;
  const cells: RockCell[] = [];
  for (let x = gx - span; x <= gx + span; x++) {
    for (let y = gy - span; y <= gy + span; y++) {
      const rock = backdropRock(catalog, rule, flight.seed, x, y);
      if (rock) {
        const key = `${depth.name}:${x},${y}`;
        cells.push({
          depth: backdropRockDepth(depth.band, (rock.x + rock.y) / 2),
          fill: `${key}:fill`,
          height: rock.sprite.display.height * rock.scale,
          key,
          rock,
          width: rock.sprite.display.width * rock.scale,
        });
      }
    }
  }
  if (last) {
    // A cell keeps its rock while the seed and rule hold, so its sprites stay with it.
    const kept = new Set(same ? cells.map(({ key }) => key) : []);
    for (const old of last.cells) {
      if (!kept.has(old.key)) {
        releaseRock(scene, old);
      }
    }
  }
  const window = { catalog, cells, galaxy: flight.galaxy, gx, gy, rule, seed: flight.seed };
  windows.set(depth.name, window);
  return window;
}

/**
 * Backdrop rocks under every play object (art/backdrop.md, Rocks), both depths at their own
 * parallax and cell: greyscale sprites multiplied by the galaxy's backdropLit and moved toward
 * the field background to the depth's value while staying opaque. Each rock draws as a
 * background-filled silhouette and the tinted rock over it at alpha `value`, the pair adjacent
 * at one depth: equal depths keep their creation order, so pairs never interleave. Rocks of a
 * depth draw back to front by projected y. The cells are seeded only when the camera's cell
 * changes, so a frame moves the rocks in view and allocates nothing.
 */
export function drawBackdrop(
  scene: BackdropContext,
  flight: NonNullable<typeof scene.model.state.flight>,
): void {
  const catalog = scene.asteroidArt;
  const rules = scene.backdropRules;
  const backdrop = scene.galaxyBackdrops.get(flight.galaxy);
  if (!catalog || !rules || !backdrop) {
    return;
  }
  const tint = hexNumber(backdropTint(catalog, flight.galaxy).backdropLit);
  const background = hexNumber(backdrop.background);
  for (const depth of ROCK_DEPTHS) {
    const rule = depth.rule(rules);
    const window = rockWindow(scene, catalog, flight, depth, rule);
    // The layer origin as projectLayer takes it, applied inline so a frame allocates no points.
    const ox = flight.player.x * rule.parallax;
    const oy = flight.player.y * rule.parallax;
    for (const cell of window.cells) {
      const { height, rock, width } = cell;
      const x = rock.x - ox;
      const y = rock.y - oy;
      const sx = SCREEN.width / 2 + x - y;
      const sy = SCREEN.height / 2 + (x + y) / 2;
      if (
        !rockTexture(scene, rock.sprite.file) ||
        sx < -width ||
        sy < -height ||
        sx > SCREEN.width + width ||
        sy > SCREEN.height + height
      ) {
        releaseRock(scene, cell);
        continue;
      }
      let fill = scene.backdropSprites.get(cell.fill);
      let top = scene.backdropSprites.get(cell.key);
      if (!fill || !top) {
        releaseRock(scene, cell);
        const { file, pivot } = rock.sprite;
        fill = scene.add
          .image(0, 0, file)
          .setDepth(cell.depth)
          .setOrigin(pivot.x, pivot.y)
          .setDisplaySize(width, height)
          .setTint(background)
          .setTintMode(TintModes.FILL);
        top = scene.add
          .image(0, 0, file)
          .setDepth(cell.depth)
          .setOrigin(pivot.x, pivot.y)
          .setDisplaySize(width, height)
          .setTint(tint)
          .setAlpha(rule.value);
        scene.backdropSprites.set(cell.fill, fill);
        scene.backdropSprites.set(cell.key, top);
      }
      fill.setPosition(sx, sy).setVisible(true);
      top.setPosition(sx, sy).setVisible(true);
    }
  }
}
