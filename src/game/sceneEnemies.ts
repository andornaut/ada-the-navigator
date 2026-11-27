// Drawing enemies, salvaged hulks and enemy weapons.
// Functions over the scene's EnemiesContext.
import { densityTexels } from "@andornaut/game-kit/runtime/view/renderScale";
import { Math as PhaserMath, type Scene, TintModes } from "phaser";

import {
  type EffectShape,
  type EnemyEffect,
  enemyInkEdges,
  enemyPhaser,
  type EnemyWeaponsView,
  lance,
  mine,
  mineSolid,
  playDepth,
  ringDart,
  ringEmission,
} from "../art/index.ts";
import { CONTENT } from "../data/content.ts";
import { enemyActorLoadout } from "../data/enemyActorDefinition.ts";
import { MINE_LAYER } from "../data/enemyCatalog.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { enemySpeedFraction } from "../model/enemyAi.ts";
import { enemyEquipmentDefinition } from "../model/enemyEquipment.ts";
import { activeEnemyBeams, activeRingEmissions, type EnemyBeam } from "../model/flight.ts";
import { hullOffset } from "../model/shipPhysics.ts";
import type { FlightState, SpaceObject, Vec } from "../model/types.ts";
import {
  bannerOffset,
  composeEnemy,
  type EnemyArt,
  enemyJetTriangles,
  type PartPose,
  type PartSprite,
  selectEnemyFrame,
} from "./enemyArt.ts";
import { SALVAGED, salvagedMatrix, showsBanner, spritesBounds } from "./heavyStates.ts";
import { keylineOffsets, LIGHT_FIELD } from "./lightField.ts";
import type { GameScene } from "./scene.ts";
import { familyArt, filterTexture } from "./sceneAssets.ts";
import { drawCraftJets, keylineSilhouette, keylineSprite } from "./sceneHud.ts";
import type { Asset } from "./sceneShared.ts";
import { drawTaper, objectSprite } from "./sceneSprites.ts";
import { acknowledgePrimitiveTarget } from "./sceneTargetMarkers.ts";

/** The scene state and methods this module's functions use. */
export type EnemiesContext = Partial<Pick<GameScene, "fieldLight">> &
  Scene &
  Pick<
    GameScene,
    | "add"
    | "asteroidArt"
    | "backdropRules"
    | "backdrops"
    | "banners"
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
    | "enemyArt"
    | "craftJets"
    | "craftJetsDrawn"
    | "enemyJets"
    | "enemyPlaceholders"
    | "enemySprites"
    | "enemyWeaponsArt"
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
    | "hitFlashes"
    | "hubArt"
    | "indicatorInk"
    | "ink"
    | "jobArt"
    | "keyed"
    | "keylines"
    | "light"
    | "load"
    | "loads"
    | "manifest"
    | "mineInk"
    | "litCaches"
    | "settingsOpen"
    | "warpCover"
    | "model"
    | "overlay"
    | "paintAssets"
    | "paintLoads"
    | "palette"
    | "partAssets"
    | "partLoads"
    | "passes"
    | "project"
    | "quantum"
    | "rasters"
    | "reducedMotion"
    | "rockQueued"
    | "rockRequests"
    | "salvagedGroups"
    | "scale"
    | "shell"
    | "shipAssets"
    | "silhouettes"
    | "spaceBackground"
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
  >;

export function drawEnemy(scene: EnemiesContext, point: Vec, object: SpaceObject): void {
  const enemy = object.enemy;
  if (!enemy) {
    scene.ink.strokeTriangle(
      point.x,
      point.y + object.radius,
      point.x - object.radius,
      point.y - object.radius,
      point.x + object.radius,
      point.y - object.radius,
    );
    acknowledgePrimitiveTarget(
      scene,
      scene.ink,
      {
        closed: true,
        filled: false,
        kind: "path",
        points: [
          { x: point.x, y: point.y + object.radius },
          { x: point.x - object.radius, y: point.y - object.radius },
          { x: point.x + object.radius, y: point.y - object.radius },
        ],
        strokeWidth: 1.5,
      },
      object.id,
    );
    return;
  }
  const definition = enemyEquipmentDefinition(scene.model.state.flight!.galaxy, enemy);
  const art = familyArt(scene, enemy.archetype, enemy.id);
  if (art) {
    drawEnemySprite(scene, art, point, object.id, enemy);
    return;
  }
  scene.enemyPlaceholders++;
  const width = definition.sizeRatio * CONTENT.tuning.flight.shipRadius * 2;
  // Hull and hardpoints share the hull's rotating local frame.
  const local = (x: number, y: number): Vec => {
    const offset = hullOffset(enemy.facing, { x: x * width, y: y * width });
    return scene.project({ x: object.x + offset.x, y: object.y + offset.y });
  };
  const large = enemy.archetype === "capital";
  const frigate = enemy.archetype === "frigate";
  const pack = enemy.packId !== null;
  const hull: [number, number][] = large
    ? [
        [-0.28, -0.5],
        [0.28, -0.5],
        [0.5, -0.25],
        [0.5, 0.4],
        [0.25, 0.5],
        [-0.25, 0.5],
        [-0.5, 0.4],
        [-0.5, -0.25],
      ]
    : frigate
      ? [
          [0, -0.6],
          [0.42, -0.25],
          [0.42, 0.4],
          [0, 0.55],
          [-0.42, 0.4],
          [-0.42, -0.25],
        ]
      : pack
        ? [
            [0, -0.6],
            [0.5, 0],
            [0.32, 0.4],
            [0, 0.2],
            [-0.32, 0.4],
            [-0.5, 0],
          ]
        : [
            [0, -0.6],
            [0.5, 0.45],
            [0, 0.2],
            [-0.5, 0.45],
          ];
  const polygon = hull.map(([x, y]) => {
    const point = local(x, y);
    return new PhaserMath.Vector2(point.x, point.y);
  });
  scene.ink.fillStyle(scene.palette.environment);
  scene.ink.fillPoints(polygon, true);
  scene.ink.lineStyle(1.5, scene.palette.obstacle);
  scene.ink.strokePoints(polygon, true);
  acknowledgePrimitiveTarget(
    scene,
    scene.ink,
    { closed: true, filled: true, kind: "path", points: polygon, strokeWidth: 1.5 },
    object.id,
  );
  if (large) {
    const a = local(-0.16, -0.5);
    const b = local(-0.16, 0.5);
    const c = local(0.16, -0.5);
    const d = local(0.16, 0.5);
    scene.ink.lineStyle(1, scene.palette.environmentDetail);
    scene.ink.lineBetween(a.x, a.y, b.x, b.y);
    scene.ink.lineBetween(c.x, c.y, d.x, d.y);
  }
  if (pack) {
    scene.ink.lineStyle(1, scene.palette.obstacle);
    scene.ink.strokeCircle(point.x, point.y, 3);
  }
  for (const part of definition.hardpoints) {
    const at = local(part.offset.x, part.offset.y);
    const hp = enemy.hardpoints.find((value) => value.id === part.id)?.hp ?? 0;
    const size = Math.max(7, Math.min(18, width * 0.065));
    const accent = part.kind === "weapon" ? scene.palette.weapon : scene.palette.shipHardpoint;
    scene.ink.fillStyle(hp > 0 ? scene.palette.environment : scene.spaceBackground);
    scene.ink.lineStyle(2, hp > 0 ? accent : scene.palette.environmentDetail);
    if (part.kind === "command") {
      scene.ink.fillTriangle(at.x, at.y - size, at.x - size, at.y + size, at.x + size, at.y + size);
      scene.ink.strokeTriangle(
        at.x,
        at.y - size,
        at.x - size,
        at.y + size,
        at.x + size,
        at.y + size,
      );
    } else if (part.kind === "engine") {
      scene.ink.fillRect(at.x - size, at.y - size * 0.6, size * 2, size * 1.2);
      scene.ink.strokeRect(at.x - size, at.y - size * 0.6, size * 2, size * 1.2);
      if (hp > 0) {
        scene.ink.lineBetween(at.x - size / 2, at.y + size, at.x - size / 2, at.y + size * 1.5);
        scene.ink.lineBetween(at.x + size / 2, at.y + size, at.x + size / 2, at.y + size * 1.5);
      }
    } else {
      scene.ink.fillCircle(at.x, at.y, size);
      scene.ink.strokeCircle(at.x, at.y, size);
      scene.ink.lineBetween(at.x, at.y, at.x, at.y - size * 1.5);
    }
    if (hp <= 0) {
      scene.ink.lineBetween(at.x - size, at.y - size, at.x + size, at.y + size);
      scene.ink.lineBetween(at.x + size, at.y - size, at.x - size, at.y + size);
    }
    scene.ink.lineStyle(3, scene.palette.environmentDetail);
    scene.ink.lineBetween(at.x - size, at.y + size + 5, at.x + size, at.y + size + 5);
    if (hp > 0) {
      scene.ink.lineStyle(3, accent);
      scene.ink.lineBetween(
        at.x - size,
        at.y + size + 5,
        at.x - size + size * 2 * Math.min(1, hp / part.hp),
        at.y + size + 5,
      );
    }
  }
}

/**
 * Authored frames already include perspective; jets are not clipped to the frame. A composed
 * craft draws its hull and hardpoint bases in the heading's layer order with intact turret
 * tops at their aim, a hit hardpoint flashing white, and jets only from intact engines. A
 * disabled heavy shows the Disabled banner above every layer; a salvaged one draws dimmed as
 * one group with no jets.
 */
export function drawEnemySprite(
  scene: EnemiesContext,
  art: EnemyArt<Asset>,
  point: Vec,
  id: string,
  enemy: NonNullable<SpaceObject["enemy"]>,
): void {
  const frame = selectEnemyFrame(art, enemy.facing);
  const state = (hardpoint: string) => enemy.hardpoints.find((part) => part.id === hardpoint);
  // A turret mount without hardpoint state, such as the retaliator's, aims with the hull
  // weapon and stands while the hull does. The galaxy's route position picks the mount tier.
  const galaxy = scene.model.state.flight?.galaxy;
  const position = galaxy === undefined ? 1 : ROUTE_POSITION[galaxy];
  // A heavy's loadout picks each mount's weapon, so its top (heavyLoadout).
  const loadout = enemyActorLoadout(enemy.archetype, position, enemy.id);
  const pose: PartPose = {
    aim: (hardpoint) => state(hardpoint)?.aim ?? enemy.aim ?? enemy.facing,
    intact: (hardpoint) => (state(hardpoint)?.hp ?? 1) > 0,
    position,
    weapon: (hardpoint) => loadout?.get(hardpoint),
  };
  const sprites = composeEnemy(art, pose, frame);
  if (enemy.salvaged) {
    drawSalvaged(scene, id, enemy.archetype, sprites, point);
    return;
  }
  const banner = showsBanner(enemy) ? bannerOffset(art, frame) : undefined;
  if (banner) {
    scene.banners.push({ at: { x: point.x + banner.x, y: point.y + banner.y }, id });
  }
  const depth = playDepth(point.y);
  sprites.forEach((part, index) => {
    const key = part.hardpoint === null ? id : `${id}#${part.layer}:${part.hardpoint}`;
    const sprite = objectSprite(scene, key, part.frame.id)
      .setDisplaySize(part.frame.displayWidth!, part.frame.displayHeight!)
      .setOrigin(part.frame.pivot.x, part.frame.pivot.y)
      .setPosition(point.x + part.offset.x, point.y + part.offset.y)
      // Parts keep the heading's layer order within the hull's screen depth.
      .setDepth(depth + index * 1e-7);
    // Every part's keyline shares one slot beneath the whole craft, so they join as one shape.
    keylineSprite(scene, enemy.archetype, key, sprite, depth - 2e-6);
    const hp = part.hardpoint === null ? undefined : state(part.hardpoint)?.hp;
    if (
      hp !== undefined &&
      scene.hitFlashes.observe(`${id}#${part.layer}:${part.hardpoint}`, hp, scene.time.now)
    ) {
      sprite.setTint(0xffffff).setTintMode(TintModes.FILL);
    }
  });
  const speed = enemySpeedFraction(
    enemyEquipmentDefinition(scene.model.state.flight!.galaxy, enemy),
    enemy,
  );
  // A light field swaps in Art's dark enemy jet layers.
  const jets =
    (scene.fieldLight ?? scene.light) && art.jets
      ? { ...art, jets: { ...art.jets, layers: LIGHT_FIELD.jets.enemy } }
      : art;
  drawCraftJets(
    scene,
    enemy.archetype,
    id,
    point,
    depth,
    enemyJetTriangles(jets, frame, speed, pose.intact),
  );
}

/**
 * A salvaged heavy (art/heavies.md "Salvaged dimming"): its composed frame, with its keyline on
 * a light field, drawn into one texture at the raster scale, mixed toward its grey and shown at
 * the group alpha, so overlapping layers never show through each other.
 */
export function drawSalvaged(
  scene: EnemiesContext,
  id: string,
  archetype: string,
  sprites: readonly PartSprite<Asset>[],
  point: Vec,
): void {
  const grow = scene.light && LIGHT_FIELD.keylined.includes(archetype) ? LIGHT_FIELD.keyline : 0;
  const bounds = spritesBounds(sprites);
  const left = Math.floor(point.x + bounds.left - grow - 1);
  const top = Math.floor(point.y + bounds.top - grow - 1);
  const width = Math.ceil(point.x + bounds.right + grow + 1) - left;
  const height = Math.ceil(point.y + bounds.bottom + grow + 1) - top;
  const r = scene.rasters.scale;
  const texels = { height: densityTexels(r, height), width: densityTexels(r, width) };
  let group = scene.salvagedGroups.get(id);
  if (!group || group.width !== texels.width || group.height !== texels.height) {
    group?.destroy();
    group = scene.add.renderTexture(0, 0, texels.width, texels.height).setOrigin(0, 0);
    filterTexture(scene, group.texture.key, "linear");
    group.enableFilters().filters?.internal.addColorMatrix().colorMatrix.set(salvagedMatrix());
    scene.salvagedGroups.set(id, group);
  }
  group.clear();
  const stamps = sprites.map((part) => {
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
    scene.rasters.mark(frame.texture.key);
    group.stamp(frame.texture.key, undefined, r * x, r * y, config);
  }
  group.render();
  group
    .setDisplaySize(width, height)
    .setPosition(left, top)
    .setDepth(playDepth(point.y))
    .setAlpha(SALVAGED.alpha)
    .setVisible(true);
  scene.passes(group);
}

/**
 * Fills and strokes Art's weapon effect shapes on the overlay, in order, over their ink
 * edges, if any.
 */
export function drawEffect(
  scene: EnemiesContext,
  shapes: readonly EffectShape[],
  edges: readonly EffectShape[] = [],
  graphics: Phaser.GameObjects.Graphics = scene.overlay,
): void {
  for (const shape of [...edges, ...shapes]) {
    switch (shape.kind) {
      case "polygon":
        graphics.fillStyle(shape.colour, shape.alpha);
        graphics.fillPoints(
          shape.points.map((point) => new PhaserMath.Vector2(point.x, point.y)),
          true,
        );
        break;
      case "disc":
        graphics.fillStyle(shape.colour, shape.alpha);
        graphics.fillCircle(shape.at.x, shape.at.y, shape.radius);
        break;
      case "ellipse":
        if (shape.stroke === undefined) {
          graphics.fillStyle(shape.colour, shape.alpha);
          graphics.fillEllipse(shape.at.x, shape.at.y, shape.halfWidth * 2, shape.halfHeight * 2);
        } else {
          graphics.lineStyle(shape.stroke, shape.colour, shape.alpha);
          graphics.strokeEllipse(shape.at.x, shape.at.y, shape.halfWidth * 2, shape.halfHeight * 2);
        }
        break;
      case "line":
        graphics.lineStyle(shape.width, shape.colour, shape.alpha);
        graphics.lineBetween(shape.from.x, shape.from.y, shape.to.x, shape.to.y);
        if (shape.round) {
          graphics.fillStyle(shape.colour, shape.alpha);
          graphics.fillCircle(shape.from.x, shape.from.y, shape.width / 2);
          graphics.fillCircle(shape.to.x, shape.to.y, shape.width / 2);
        }
        break;
      case "taper":
        drawTaper(scene, shape, graphics);
        break;
    }
  }
}

/** The model's enemy Phaser and enemy-only weapon state for this frame, in ms. */
export function enemyWeaponsView(flight: FlightState): EnemyWeaponsView {
  const tells = (kind: EnemyBeam["kind"]) =>
    activeEnemyBeams(flight)
      .filter((beam) => beam.kind === kind)
      .map((beam) => ({
        ageMs: beam.age * 1000,
        ...(beam.drawn ? { beam: beam.drawn } : {}),
        end: beam.end,
        ...(beam.impact ? { impact: beam.impact } : {}),
        muzzle: beam.muzzle,
        stopped: beam.stopped,
      }));
  return {
    lances: tells("lance"),
    mines: flight.mines.map((laid) => ({
      ageMs: Math.max(0, laid.age) * 1000,
      at: { x: laid.x, y: laid.y },
      ...(laid.end ? { end: { ageMs: laid.end.age * 1000, kind: laid.end.kind } } : {}),
      id: laid.id,
      lifeMs: MINE_LAYER.lifeSeconds * 1000,
    })),
    phasers: tells("phaser"),
    ringBolts: flight.shots
      .filter((shot) => shot.enemyWeapon === "ringBurst")
      .map((shot) => ({ at: { x: shot.x, y: shot.y }, velocity: shot.velocity })),
    rings: activeRingEmissions(flight).map((ring) => ({ ...ring, ageMs: ring.age * 1000 })),
  };
}

/**
 * Art's enemy-only weapon effects and the enemy Phaser in the effect layer, each over its ink
 * edges on a light field; each mine sorts with the play objects by its centre's screen y.
 */
export function drawEnemyWeapons(
  scene: EnemiesContext & Pick<GameScene, "mineSprites" | "weaponSolids">,
  view: EnemyWeaponsView,
): void {
  const art = scene.enemyWeaponsArt;
  const used = new Set<string>();
  if (art) {
    const light = scene.light;
    const motion = scene.reducedMotion;
    const draw = (effect: EnemyEffect, graphics?: Phaser.GameObjects.Graphics) =>
      drawEffect(
        scene,
        effect.shapes,
        light ? enemyInkEdges(art.colours.ink, art.lightField.edge, effect.edged) : [],
        graphics,
      );
    for (const ring of view.rings) {
      const origins = ring.origins.map((origin) => scene.project(origin));
      draw(
        ringEmission(art, scene.project(ring.at), ring.spawnRadius, origins, motion, ring.ageMs),
      );
    }
    for (const bolt of view.ringBolts) {
      draw(ringDart(art, scene.project(bolt.at), bolt.velocity));
    }
    const screen = (tell: EnemyWeaponsView["lances"][number]) => ({
      ...tell,
      ...(tell.beam
        ? { beam: { from: scene.project(tell.beam.from), to: scene.project(tell.beam.to) } }
        : {}),
      end: scene.project(tell.end),
      ...(tell.impact ? { impact: scene.project(tell.impact) } : {}),
      muzzle: scene.project(tell.muzzle),
    });
    for (const tell of view.lances) {
      draw(lance(art, screen(tell), motion));
    }
    for (const tell of view.phasers) {
      draw(enemyPhaser(art, screen(tell), motion));
    }
    // Each mine's frame sorts with the play objects by its centre, under its own hint arc,
    // flecks or pop; on a light field the frame takes the ink keyline.
    for (const dropped of view.mines) {
      const centre = scene.project(dropped.at);
      const depth = playDepth(centre.y);
      let graphics = scene.mineInk.get(dropped.id);
      if (!graphics) {
        graphics = scene.add.graphics();
        scene.mineInk.set(dropped.id, graphics);
      }
      graphics
        .clear()
        .setDepth(depth + 1e-7)
        .setVisible(true);
      const effect = mine(art, centre, dropped, motion);
      draw(effect, graphics);
      used.add(dropped.id);
      const solids = scene.weaponSolids;
      const solid = effect.solid;
      const texture = solid && solids && mineSolid(solids, solid.step, solid.blink);
      if (!solid || !solids || !texture || !scene.textures.exists(texture)) {
        continue;
      }
      const frames = solids.mine;
      let sprite = scene.mineSprites.get(dropped.id);
      if (!sprite) {
        sprite = scene.add.image(0, 0, texture);
        scene.mineSprites.set(dropped.id, sprite);
      }
      sprite
        .setTexture(texture)
        .setOrigin(frames.pivot.x, frames.pivot.y)
        .setDisplaySize(frames.width * solid.scale, frames.height * solid.scale)
        .setPosition(centre.x, centre.y)
        .setDepth(depth)
        .setAlpha(solid.alpha)
        .setVisible(true);
      if (light) {
        scene.keyed.push({
          depth: undefined,
          key: `mine:${dropped.id}`,
          sprite,
          width: art.lightField.edge,
        });
      }
    }
  }
  for (const [id, graphics] of scene.mineInk) {
    if (!used.has(id)) {
      graphics.destroy();
      scene.mineInk.delete(id);
    }
  }
  for (const [id, sprite] of scene.mineSprites) {
    if (!used.has(id)) {
      sprite.destroy();
      scene.mineSprites.delete(id);
    }
  }
}
