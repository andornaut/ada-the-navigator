// Drawing story ships, currents, Whirlpool projects, landmarks, tows and jobs.
// Functions over the scene's WorldContext.
import { Math as PhaserMath, type Scene } from "phaser";

import { CURRENTS } from "../data/galaxyFeatures.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { SCREEN } from "../data/screen.ts";
import { CARTWHEEL_STORY_SHIPS, STORY_SHIP_CRAFT } from "../data/storyShips.ts";
import { currentsNear, flowFraction } from "../model/currents.ts";
import { drawnHeading, hubBay, storyShips } from "../model/storyShips.ts";
import type { FlightState, Vec } from "../model/types.ts";
import { hexNumber, playDepth } from "./asteroidArt.ts";
import { streakMarks } from "./currentStreaks.ts";
import { enemyJetTriangles, selectEnemyFrame } from "./enemyArt.ts";
import {
  beaconLandmarkFrame,
  dashes,
  glintFrame,
  glintPing,
  type JobFrame,
  nebulaTint,
} from "./jobArt.ts";
import { LIGHT_FIELD } from "./lightField.ts";
import { boundsOnScreen, revealAlpha } from "./projectArt.ts";
import type { GameScene } from "./scene.ts";
import { keylineSprite } from "./sceneHud.ts";
import { LANDMARK_DEPTH, STORY_SHIP } from "./sceneShared.ts";
import { objectSprite } from "./sceneSprites.ts";
import { hubBuoyKey, hubStoryKey, partKey } from "./spriteKeys.ts";
import { stationFrame } from "./stationArt.ts";
import {
  craftFrame,
  craftHeading,
  strandedCraftId,
  towBeads,
  towCurve,
  type TowLine,
  towOffset,
} from "./towArt.ts";
import {
  buoyFrame,
  buoyPlaces,
  frameBounds,
  nurseryFrame,
  poolRings,
  whalesCurrent,
} from "./whirlpoolProjects.ts";

/** The scene state and methods this module's functions use. */
export type WorldContext = Scene &
  Pick<
    GameScene,
    | "add"
    | "asteroidArt"
    | "backdropRules"
    | "backdrops"
    | "buoyArt"
    | "buoySprites"
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
    | "enemyJets"
    | "enemySprites"
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
    | "glintSprite"
    | "hubArt"
    | "indicatorInk"
    | "ink"
    | "jobArt"
    | "keyed"
    | "keylines"
    | "landmarkSprites"
    | "landmarksDrawn"
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
    | "passes"
    | "project"
    | "projectArt"
    | "quantum"
    | "rasters"
    | "reducedMotion"
    | "resourceFiles"
    | "resourceRocks"
    | "reveals"
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
    | "towDepth"
    | "towInk"
    | "towLine"
    | "towSprite"
    | "useCallout"
    | "whaleArt"
    | "whaleRequests"
    | "whalesCurrentFor"
    | "whirlpoolProjects"
  >;

/**
 * Cartwheel's buoys and story ships around the hub. Each craft draws Art's frame for the
 * nearest of its 16 headings, with its speed jets while it moves; a craft whose frames are not
 * loaded yet draws as a vector dart.
 */
export function drawStoryShips(scene: WorldContext, flight: FlightState): void {
  const hub =
    flight.galaxy === CARTWHEEL_STORY_SHIPS.galaxy
      ? flight.objects.find((object) => object.kind === "destination" && object.id === "hub")
      : undefined;
  if (!hub) {
    return;
  }
  if (scene.buoyArt) {
    for (const [group, offset] of Object.entries(CARTWHEEL_STORY_SHIPS.buoys)) {
      const at = { x: hub.x + offset.x, y: hub.y + offset.y };
      const point = scene.project(at);
      const frame = stationFrame(scene.buoyArt, scene.reducedMotion, scene.time.now);
      scene.passes(
        objectSprite(scene, hubBuoyKey(hub.id, group), frame.id)
          .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setPosition(point.x, point.y)
          .setDepth(playDepth(point.y)),
      );
    }
  }
  const progress = scene.model.state.progress[flight.galaxy];
  for (const ship of storyShips(
    hub,
    progress,
    { bay: hubBay(progress), noses: scene.storyNoses },
    flight.storyScene,
    flight.time,
  )) {
    const point = scene.project(ship);
    const art = scene.craftArt.get(STORY_SHIP_CRAFT[ship.id]);
    if (art) {
      const frame = selectEnemyFrame(art, ship.heading);
      scene.passes(
        objectSprite(scene, hubStoryKey(hub.id, ship.id), frame.id)
          .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setPosition(point.x, point.y)
          .setDepth(playDepth(point.y)),
      );
      for (const { alpha, color, points } of enemyJetTriangles(art, frame, ship.thrust ? 1 : 0)) {
        scene.enemyJets.fillStyle(color, alpha);
        scene.enemyJets.fillTriangle(
          point.x + points[0].x,
          point.y + points[0].y,
          point.x + points[1].x,
          point.y + points[1].y,
          point.x + points[2].x,
          point.y + points[2].y,
        );
      }
      continue;
    }
    const heading = drawnHeading(ship.heading);
    const at = (along: number, across: number) =>
      scene.project({
        x: ship.x + heading.x * along - heading.y * across,
        y: ship.y + heading.y * along + heading.x * across,
      });
    const nose = at(10, 0);
    const left = at(-8, 7);
    const right = at(-8, -7);
    scene.ink.fillStyle(ship.id === "blocker" ? STORY_SHIP.blocker : STORY_SHIP.hull);
    scene.ink.fillTriangle(nose.x, nose.y, left.x, left.y, right.x, right.y);
    scene.ink.lineStyle(1, scene.palette.environmentDetail);
    scene.ink.strokeTriangle(nose.x, nose.y, left.x, left.y, right.x, right.y);
  }
}

/**
 * Whirlpool's current streaks from Art's spec (currentStreaks.ts): chevrons on the world
 * plane in each lane, moving with the lane's flow and fading with it, on the field above the
 * specks and backdrop rocks and below every play object.
 */
export function drawCurrents(scene: WorldContext, flight: FlightState): void {
  const spec = scene.streakSpec;
  if (!spec) {
    return;
  }
  const reach = Math.max(SCREEN.width, SCREEN.height) * 1.5;
  const color = hexNumber(spec.color);
  const margin = 24;
  const near = (point: Vec) => {
    const at = scene.project(point);
    return (
      at.x > -margin &&
      at.y > -margin &&
      at.x < SCREEN.width + margin &&
      at.y < SCREEN.height + margin
    );
  };
  for (const current of currentsNear(flight.galaxy, reach, flight.player)) {
    const marks = streakMarks(
      spec,
      current,
      CURRENTS.peakFlow,
      (arc, offset) => flowFraction(current, arc, offset),
      flight.time,
      scene.reducedMotion,
      near,
    );
    for (const mark of marks) {
      scene.ink.lineStyle(mark.width, color, mark.alpha);
      scene.ink.strokePoints(
        mark.points.map((point) => {
          const at = scene.project(point);
          return new PhaserMath.Vector2(at.x, at.y);
        }),
        false,
        false,
      );
    }
  }
}

/**
 * Whirlpool's funded world changes (art/whirlpool.md "Project world changes"): the nursery
 * beacon at the family with its light pool on the field below every play object, and the
 * current-map buoys along both edges of the whales' current. Both are passable decoration that
 * Ada draws in front of while she overlaps them. A change not yet revealed stays unseen until
 * the first frame its site is on screen in live flight, then fades in (reduced motion cuts).
 */
export function drawWhirlpoolProjects(scene: WorldContext, flight: FlightState): void {
  const art = scene.whirlpoolProjects;
  const family = flight.objects.find(
    (object) => object.kind === "destination" && object.id === "family",
  );
  if (!art || !family) {
    pruneBuoys(scene, new Set());
    return;
  }
  const funded = new Map(
    scene.model.worldChanges(flight.galaxy).map((change) => [change.project, change]),
  );
  const now = scene.flightClock;
  const revealMs = scene.projectArt?.revealMs ?? 0;
  // A funded change's opacity scene frame, recording its reveal the first frame its site shows;
  // undefined while it stays unseen.
  const alphaOf = (project: string, onScreen: boolean): number | undefined => {
    const change = funded.get(project);
    if (!change) {
      return undefined;
    }
    if (!change.revealed) {
      if (!onScreen || !scene.flightLive) {
        return undefined;
      }
      scene.model.revealWorldChange(flight.galaxy, project);
      if (!scene.reducedMotion) {
        scene.reveals.set(project, now);
      }
    }
    const start = scene.reveals.get(project);
    if (start === undefined) {
      return 1;
    }
    if (now - start >= revealMs) {
      scene.reveals.delete(project);
      return 1;
    }
    return revealAlpha(revealMs, now - start);
  };
  const beacon = art.nurseryBeacon;
  if (beacon) {
    const index = nurseryFrame(art, beacon, scene.reducedMotion, scene.time.now);
    const frame = beacon.frames[index];
    const point = scene.project({ x: family.x + beacon.offset.x, y: family.y + beacon.offset.y });
    const rings = poolRings(beacon, family, index);
    const pool = scene.project(rings[0]!.centre);
    // The outermost ring bounds the pool, which reaches past the lantern.
    const reach = Math.max(...rings.map(({ radius }) => radius));
    const onScreen =
      boundsOnScreen(SCREEN, point, frameBounds(frame)) ||
      boundsOnScreen(SCREEN, pool, {
        bottom: reach / Math.SQRT2,
        left: -reach * Math.SQRT2,
        right: reach * Math.SQRT2,
        top: -reach / Math.SQRT2,
      });
    const alpha = alphaOf("nurseryBeacon", onScreen);
    if (alpha !== undefined) {
      const color = hexNumber(beacon.pool.color);
      for (const ring of rings) {
        scene.ink.fillStyle(color, ring.alpha * alpha);
        // A world circle on the projected plane: sqrt 2 r across and r / sqrt 2 down.
        scene.ink.fillEllipse(
          pool.x,
          pool.y,
          2 * Math.SQRT2 * ring.radius,
          Math.SQRT2 * ring.radius,
        );
      }
      const sprite = objectSprite(scene, partKey(family.id, "nurseryBeacon"), frame.id)
        .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setPosition(point.x, point.y)
        .setDepth(playDepth(point.y))
        .setAlpha(alpha);
      scene.passes(sprite);
    }
  }
  const buoys = art.currentBuoys;
  const drawn = new Set<string>();
  if (buoys) {
    if (
      scene.whalesCurrentFor?.family.x !== family.x ||
      scene.whalesCurrentFor.family.y !== family.y
    ) {
      scene.whalesCurrentFor = {
        current: whalesCurrent(flight.galaxy, family),
        family: { x: family.x, y: family.y },
      };
    }
    const current = scene.whalesCurrentFor.current;
    const visible = current
      ? buoyPlaces(buoys, current)
          .map((place) => ({
            ...place,
            frame:
              buoys.frames[buoyFrame(art, buoys, place.k, scene.reducedMotion, scene.time.now)],
            screen: scene.project(place.point),
          }))
          .filter(({ frame, screen }) => boundsOnScreen(SCREEN, screen, frameBounds(frame)))
      : [];
    const alpha = alphaOf("currentBuoys", visible.length > 0);
    for (const { frame, k, screen, side } of alpha === undefined ? [] : visible) {
      const key = `${current!.id}:${side}:${k}`;
      drawn.add(key);
      let sprite = scene.buoySprites.get(key);
      if (!sprite) {
        sprite = scene.add.image(0, 0, frame.id);
        scene.buoySprites.set(key, sprite);
      }
      sprite
        .setTexture(frame.id)
        .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setPosition(screen.x, screen.y)
        .setDepth(playDepth(screen.y))
        .setAlpha(alpha!)
        .setVisible(true);
      scene.passes(sprite);
    }
  }
  pruneBuoys(scene, drawn);
}

/** Destroys the buoy sprites not drawn this frame. */
export function pruneBuoys(scene: WorldContext, drawn: ReadonlySet<string>): void {
  for (const [key, sprite] of scene.buoySprites) {
    if (!drawn.has(key)) {
      sprite.destroy();
      scene.buoySprites.delete(key);
    }
  }
}

/**
 * Landmarks, a rescue's craft on its tow line, a hunt's search area and its lost item's glint
 * (gameplay/quests.md, art/jobs.md). Landmarks and the search rim lie on the ground layer under
 * play objects, and Ada flies through the landmarks; a part whose art is missing keeps its
 * placeholder.
 */
export function drawJobs(scene: WorldContext): void {
  const scenery = scene.model.jobScenery;
  const galaxy = scene.model.state.flight?.galaxy;
  const art = scene.jobArt;
  const margin = 200;
  const near = (point: Vec) =>
    point.x >= -margin &&
    point.y >= -margin &&
    point.x <= SCREEN.width + margin &&
    point.y <= SCREEN.height + margin;
  const pulse = scene.reducedMotion ? 0.5 : (scene.time.now / 1200) % 1;
  for (const landmark of scenery.landmarks) {
    const point = scene.project(landmark);
    if (!near(point)) {
      continue;
    }
    const key = `landmark:${landmark.x},${landmark.y}`;
    if (landmark.kind === "nebula" && art?.nebula && galaxy) {
      art.nebula.forEach((layer, index) =>
        drawLandmarkLayer(scene, `${key}#${index}`, layer.frame, point, index, {
          ...(layer.keyline ? { keyline: layer.keyline } : {}),
          ...(layer.tint ? { tint: nebulaTint(art, galaxy, layer.tint) } : {}),
        }),
      );
    } else if (landmark.kind === "wreck" && art?.wreck) {
      art.wreck.forEach((layer, index) =>
        drawLandmarkLayer(scene, `${key}#${index}`, layer.frame, point, index, {
          ...(layer.keyline ? { keyline: layer.keyline } : {}),
        }),
      );
    } else if (landmark.kind === "beacon" && art?.beacon) {
      const frame =
        art.beacon.frames[beaconLandmarkFrame(art.beacon, scene.reducedMotion, scene.time.now)];
      drawLandmarkLayer(scene, key, frame, point, 0, {
        ...(art.beacon.keyline ? { keyline: art.beacon.keyline } : {}),
      });
    } else if (landmark.kind === "nebula") {
      scene.ink.fillStyle(scene.palette.environmentDetail, 0.22);
      scene.ink.fillEllipse(point.x, point.y, 220, 110);
      scene.ink.fillEllipse(point.x + 46, point.y - 16, 130, 64);
      scene.ink.fillEllipse(point.x - 52, point.y + 12, 110, 52);
    } else if (landmark.kind === "wreck") {
      scene.ink.lineStyle(2, scene.palette.environmentDetail, 0.9);
      const hull = [
        [-34, 4],
        [-10, -12],
        [18, -8],
        [4, 2],
        [30, 12],
        [-6, 16],
      ].map(([x, y]) => new PhaserMath.Vector2(point.x + x!, point.y + y!));
      scene.ink.strokePoints(hull, true);
    } else {
      scene.ink.fillStyle(scene.palette.pointOfInterest, 0.9);
      scene.ink.fillCircle(point.x, point.y, 4);
      scene.ink.lineStyle(1, scene.palette.pointOfInterest, 0.7 - pulse * 0.5);
      scene.ink.strokeCircle(point.x, point.y, 10 + pulse * 18);
    }
  }
  if (scenery.area) {
    const { radius, x, y } = scenery.area;
    const points = Array.from({ length: 96 }, (_, index) => {
      const angle = (index / 96) * Math.PI * 2;
      return scene.project({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
    });
    const rim = art?.searchArea;
    if (rim) {
      const runs = dashes(points, rim.dash);
      const stroke = (width: number, colour: number, alpha: number) => {
        scene.ink.lineStyle(width, colour, alpha);
        for (const run of runs) {
          scene.ink.strokePoints(
            run.map(({ x: px, y: py }) => new PhaserMath.Vector2(px, py)),
            false,
            false,
          );
        }
      };
      // On a light field the rim draws over an ink dash on the same path.
      if (scene.light) {
        stroke(rim.lightInk.width, LIGHT_FIELD.ink, rim.lightInk.alpha);
      }
      stroke(rim.width, scene.palette.pointOfInterest, rim.alpha);
    } else {
      scene.ink.lineStyle(1, scene.palette.pointOfInterest, 0.45);
      scene.ink.strokePoints(
        points.map(({ x: px, y: py }) => new PhaserMath.Vector2(px, py)),
        true,
      );
    }
  }
  if (scenery.craft) {
    drawTow(scene, scenery.craft, scenery.towing);
  }
  if (scenery.glint) {
    const glint = scene.project(scenery.glint);
    const sprite = art?.glint;
    if (sprite) {
      const ping = glintPing(sprite, scene.reducedMotion, scene.time.now);
      if (ping) {
        // The ping is on the world plane, under the glint; a light field draws it over ink.
        if (scene.light) {
          scene.ink.lineStyle(sprite.ping.lightInk, LIGHT_FIELD.ink, ping.alpha);
          scene.ink.strokeEllipse(glint.x, glint.y, ping.width, ping.height);
        }
        scene.ink.lineStyle(sprite.ping.width, scene.palette.pointOfInterest, ping.alpha);
        scene.ink.strokeEllipse(glint.x, glint.y, ping.width, ping.height);
      }
      scene.glintSprite ??= scene.add.image(0, 0, sprite.asset.id);
      const image = scene.glintSprite
        .setTexture(sprite.asset.id, glintFrame(sprite, scene.reducedMotion, scene.time.now))
        .setDisplaySize(sprite.asset.displayWidth!, sprite.asset.displayHeight!)
        .setOrigin(sprite.asset.pivot.x, sprite.asset.pivot.y)
        .setPosition(glint.x, glint.y)
        .setDepth(playDepth(glint.y))
        .setVisible(true);
      if (sprite.keyline) {
        keylineSprite(scene, sprite.keyline, "hunt-glint", image);
      }
    } else {
      const size = 4 + pulse * 4;
      scene.overlay.lineStyle(2, scene.palette.active, 1 - pulse * 0.5);
      scene.overlay.lineBetween(glint.x - size, glint.y, glint.x + size, glint.y);
      scene.overlay.lineBetween(glint.x, glint.y - size, glint.x, glint.y + size);
    }
  }
}

/**
 * One landmark layer on the ground layer, under every play object: its frame at the landmark's
 * point, multiplied by its galaxy tint, keylined on a light field when its kind is.
 */
export function drawLandmarkLayer(
  scene: WorldContext,
  key: string,
  frame: JobFrame,
  point: Vec,
  layer: number,
  style: { keyline?: string; tint?: number },
): void {
  let sprite = scene.landmarkSprites.get(key);
  if (!sprite) {
    sprite = scene.add.image(0, 0, frame.id);
    scene.landmarkSprites.set(key, sprite);
  }
  sprite
    .setTexture(frame.id)
    .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
    .setOrigin(frame.pivot.x, frame.pivot.y)
    .setPosition(point.x, point.y)
    .setDepth(LANDMARK_DEPTH + layer * 1e-7)
    .setVisible(true);
  if (style.tint === undefined) {
    sprite.clearTint();
  } else {
    sprite.setTint(style.tint);
  }
  scene.landmarksDrawn.add(key);
  if (style.keyline) {
    keylineSprite(scene, style.keyline, key, sprite);
  }
}

/**
 * A rescue's craft facing Ada, and its tow line while attached: the flight's galaxy's stranded
 * craft, keylined on a light field, and Art's cable, else the placeholder ellipse and line.
 */
export function drawTow(
  scene: WorldContext,
  craft: Vec & { readonly item: string },
  towing: boolean,
): void {
  const flight = scene.model.state.flight!;
  const point = scene.project(craft);
  const id = strandedCraftId(flight.galaxy, craft.item);
  const art = id === undefined ? undefined : scene.strandedCraft.get(flight.galaxy)?.get(id);
  const heading = craftHeading(craft, flight.player);
  const frame = art && craftFrame(art, heading, scene.reducedMotion, scene.time.now);
  const offset = art && frame ? towOffset(art, frame, heading) : { x: 0, y: 0 };
  if (towing) {
    const ship = scene.project(flight.player);
    if (scene.towLine) {
      drawTowLine(scene, scene.towLine, flight, craft, offset);
      // placeAda sets the line's depth once Ada's is known.
      scene.towDepth = playDepth(point.y);
    } else {
      scene.ink.lineStyle(1, scene.palette.pointOfInterest, 0.8);
      scene.ink.lineBetween(ship.x, ship.y, point.x, point.y);
    }
  }
  if (frame) {
    scene.towSprite
      .setTexture(frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y))
      .setVisible(true);
    scene.passes(scene.towSprite);
    keylineSprite(scene, "strandedCraft", "tow-craft", scene.towSprite);
    return;
  }
  scene.ink.fillStyle(scene.palette.environmentDetail, 1);
  scene.ink.fillEllipse(point.x, point.y, 22, 12);
  scene.ink.lineStyle(1, scene.palette.active, 0.9);
  scene.ink.strokeEllipse(point.x, point.y, 22, 12);
}

/**
 * The cable from Ada's pivot to the craft's tow point, `offset` display px from its pivot:
 * Art's layered stroke with round joins and caps, its beads and the tow point's cap.
 */
export function drawTowLine(
  scene: WorldContext,
  line: TowLine,
  flight: NonNullable<typeof scene.model.state.flight>,
  craft: Vec,
  offset: Vec,
): void {
  const curve = towCurve(JOB_TUNING.tow.line, flight.velocity, flight.player, craft);
  // The craft end moves onto the tow point, the offset easing in along the line.
  const points = curve.map((world, index) => {
    const at = scene.project(world);
    const t = index / (curve.length - 1);
    return { x: at.x + offset.x * t, y: at.y + offset.y * t };
  });
  for (const layer of line.layers) {
    const color = hexNumber(layer.color);
    scene.towInk.lineStyle(layer.width, color, 1);
    scene.towInk.strokePoints(
      points.map((point) => new PhaserMath.Vector2(point.x, point.y)),
      false,
    );
    scene.towInk.fillStyle(color, 1);
    for (const point of points) {
      scene.towInk.fillCircle(point.x, point.y, layer.width / 2);
    }
  }
  scene.towInk.fillStyle(hexNumber(line.beads.color), 1);
  for (const bead of towBeads(line.beads, points)) {
    scene.towInk.fillCircle(bead.x, bead.y, line.beads.radius);
  }
  const end = points[points.length - 1]!;
  for (const disc of line.cap) {
    scene.towInk.fillStyle(hexNumber(disc.color), 1);
    scene.towInk.fillCircle(end.x, end.y, disc.radius);
  }
}
