// Drawing the in-world HUD: the Use callout, edge markers, indicators, feedback and keylines.
// Functions over the scene's HudContext.
import { GameObjects, Math as PhaserMath, ScaleModes, type Scene, Textures } from "phaser";

import { EDGE_MARKER_GLYPHS, edgeMarkerInset } from "../data/edgeMarkers.ts";
import { SCREEN } from "../data/screen.ts";
import { edgePoint } from "../model/edgeMarkers.ts";
import type { FlightState, Vec } from "../model/types.ts";
import { safeGameArea } from "../ui/layout/playView.ts";
import { USE_CALLOUT_FADE_MS, useCalloutAlpha, useCalloutLift } from "../ui/touchChrome.ts";
import { USE_CALLOUT_DEPTH } from "./drawOrder.ts";
import { type FeedbackPulse } from "./feedback.ts";
import {
  alphaTopRow,
  inkEdges,
  KEYLINE_ALPHA,
  keylineOffsets,
  keylineWidth,
  LIGHT_FIELD,
  thresholdSilhouette,
} from "./lightField.ts";
import type { GameScene } from "./scene.ts";
import { filterTexture } from "./sceneAssets.ts";
import { createUseCallout } from "./touchChrome.ts";
import { type EffectShape } from "./weaponEffects.ts";

/** The scene state and methods this module's functions use. */
export type HudContext = Scene &
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
  >;

/**
 * The Use callout above the destination Use acts on (art/destinations.md "Use callout"): its
 * action's symbol, O on the pivot's vertical with the tail tip 3 px above the drawn top, fading
 * in and out over 150 ms with cubicOut, at once under reduced motion. It holds its place while
 * it fades out.
 */
export function drawUseCallout(scene: HudContext, flight: FlightState | null | undefined): void {
  scene.useCallout ??= createUseCallout(scene, scene.rasters.scale).setDepth(USE_CALLOUT_DEPTH);
  const target = flight ? scene.model.useTarget : undefined;
  const object =
    target && flight?.objects.find((entry) => entry.id === target.id && entry.kind !== "enemy");
  const now = scene.time.now;
  const state = scene.calloutState;
  if (object && target) {
    if (!state.showing || state.id !== target.id) {
      state.edge = state.showing ? now : now - calloutRemaining(scene, now);
      state.showing = true;
      state.id = target.id;
    }
    const point = scene.project(object);
    const top = drawnTop(scene, target.id, point);
    state.at = { x: point.x, y: point.y - useCalloutLift(top) };
    scene.useCallout.setFrame(target.action);
  } else if (state.showing) {
    state.edge = now - calloutRemaining(scene, now);
    state.showing = false;
  }
  const alpha = useCalloutAlpha(now - state.edge, scene.reducedMotion, state.showing);
  scene.useCallout
    .setPosition(state.at.x, state.at.y)
    .setAlpha(alpha)
    .setVisible(alpha > 0);
}

/**
 * How far into the opposite fade the callout's current alpha already is, so a reversed fade
 * continues from where it stands: fading in, 1 - (1 - t)^3 = a; fading out, (1 - t)^3 = a.
 */
export function calloutRemaining(scene: HudContext, now: number): number {
  const state = scene.calloutState;
  const alpha = useCalloutAlpha(now - state.edge, scene.reducedMotion, state.showing);
  const t = state.showing ? 1 - Math.cbrt(alpha) : 1 - Math.cbrt(1 - alpha);
  return t * USE_CALLOUT_FADE_MS;
}

/**
 * A drawn object's top in display px above its pivot at `point`: the topmost pixel at alpha 0.5
 * or more over its sprites and every frame they have shown this flight.
 */
export function drawnTop(scene: HudContext, id: string, point: Vec): number {
  let top = scene.drawnTops.get(id) ?? 0;
  for (const [key, sprite] of scene.enemySprites) {
    if ((key === id || key.startsWith(`${id}#`)) && sprite.visible) {
      const fraction = frameTop(scene, sprite.frame);
      const drawn =
        sprite.y - sprite.originY * sprite.displayHeight + fraction * sprite.displayHeight;
      top = Math.max(top, point.y - drawn);
    }
  }
  scene.drawnTops.set(id, top);
  return top;
}

/** The topmost row of a frame with alpha 0.5 or more, as a fraction of its height. */
export function frameTop(scene: HudContext, frame: Textures.Frame): number {
  const key = `${frame.texture.key}#${String(frame.name)}@${frame.cutWidth}`;
  const known = scene.frameTops.get(key);
  if (known !== undefined) {
    return known;
  }
  const width = Math.max(1, frame.cutWidth);
  const height = Math.max(1, frame.cutHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let row = height;
  if (context) {
    context.drawImage(
      frame.source.image as CanvasImageSource,
      frame.cutX,
      frame.cutY,
      width,
      height,
      0,
      0,
      width,
      height,
    );
    const data = context.getImageData(0, 0, width, height).data;
    row = alphaTopRow(data, width, height, KEYLINE_ALPHA);
  }
  const fraction = row / height;
  scene.frameTops.set(key, fraction);
  return fraction;
}

/**
 * On a light field, records a sprite of a keylined kind (`lightField.keylined`) for this
 * frame's ink keyline.
 */
export function keylineSprite(
  scene: HudContext,
  kind: string,
  key: string,
  sprite: GameObjects.Image,
  depth?: number,
): void {
  if (
    scene.light &&
    (LIGHT_FIELD.keylined.includes(kind) || LIGHT_FIELD.destinationKeyline.kinds.includes(kind))
  ) {
    scene.keyed.push({ depth, key, sprite, width: keylineWidth(LIGHT_FIELD, kind) });
  }
}

/**
 * Each keylined sprite's ink keyline: eight copies of its frame's ink silhouette offset by
 * its kind's keyline width in every direction (a square kernel), just beneath it in its depth
 * slot (or at its group's keyline depth), at its alpha. Keylines not drawn this frame are
 * destroyed.
 */
export function drawKeylines(scene: HudContext): void {
  const used = new Set<string>();
  for (const { depth, key, sprite, width } of scene.keyed) {
    const offsets = keylineOffsets(width);
    if (!sprite.visible) {
      continue;
    }
    used.add(key);
    const silhouette = keylineSilhouette(scene, sprite);
    if (!silhouette) {
      continue;
    }
    let copies = scene.keylines.get(key);
    if (!copies) {
      copies = offsets.map(() => scene.add.image(0, 0, silhouette));
      scene.keylines.set(key, copies);
    }
    copies.forEach((copy, index) => {
      copy
        .setTexture(silhouette)
        .setOrigin(sprite.originX, sprite.originY)
        .setDisplaySize(sprite.displayWidth, sprite.displayHeight)
        .setPosition(sprite.x + offsets[index]!.x, sprite.y + offsets[index]!.y)
        .setDepth(depth ?? sprite.depth - 2e-6)
        .setAlpha(sprite.alpha)
        .setVisible(true);
    });
  }
  for (const [key, copies] of scene.keylines) {
    if (!used.has(key)) {
      for (const copy of copies) {
        copy.destroy();
      }
      scene.keylines.delete(key);
    }
  }
  // Every copy now draws its frame's current silhouette; replaced ones nothing draws go.
  scene.silhouettes.sweep(
    (key) =>
      scene.children.list.some(
        (child) => child instanceof GameObjects.Image && child.texture.key === key,
      ),
    (key) => scene.textures.remove(key),
  );
}

/**
 * A sprite frame's keyline source, made once per frame: opaque ink where the frame's alpha is
 * at least KEYLINE_ALPHA, clear elsewhere, so the grown edge is crisp.
 */
export function keylineSilhouette(
  scene: HudContext,
  sprite: { frame: Textures.Frame },
): string | undefined {
  const frame = sprite.frame;
  // Keyed by the frame's raster size too, so a frame rasterised again gets a new silhouette and
  // the old one is swept once nothing draws it (silhouettes.ts).
  const traced = `${frame.texture.key}#${String(frame.name)}`;
  const key = `keyline:${traced}@${frame.cutWidth}`;
  scene.silhouettes.use(traced, key);
  if (scene.textures.exists(key)) {
    return key;
  }
  const width = Math.max(1, frame.cutWidth);
  const height = Math.max(1, frame.cutHeight);
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) {
    return undefined;
  }
  const context = canvas.getContext();
  context.drawImage(
    frame.source.image as CanvasImageSource,
    frame.cutX,
    frame.cutY,
    width,
    height,
    0,
    0,
    width,
    height,
  );
  const pixels = context.getImageData(0, 0, width, height);
  thresholdSilhouette(LIGHT_FIELD.ink, KEYLINE_ALPHA, pixels.data);
  context.putImageData(pixels, 0, 0);
  canvas.refresh();
  // The silhouette samples as its source does.
  filterTexture(scene, key, frame.source.scaleMode === ScaleModes.NEAREST ? "nearest" : "linear");
  return key;
}

/** On a light field, the ink edges beneath an effect whose kind takes them (`lightField.effects`). */
export function keylineEdges(
  scene: HudContext,
  kinds: readonly string[],
  shapes: readonly EffectShape[],
): EffectShape[] {
  return scene.light && kinds.some((kind) => LIGHT_FIELD.effects.includes(kind))
    ? inkEdges(LIGHT_FIELD.ink, LIGHT_FIELD.keyline, shapes)
    : [];
}

/**
 * A marker at the game area's edge toward each seen enemy, heavy and station off screen and
 * within range (model/edgeMarkers.ts); a direction indicator on the same object wins. Discs in
 * the palette's threat, the station diamond in pointOfInterest; a light field adds an ink outline
 * (lightField.markerOutline) under each, as the indicators' ink does.
 */
export function drawEdgeMarkers(scene: HudContext, flight: FlightState): void {
  const indicated = new Set(scene.model.indicatorTargets.map(({ id }) => id));
  const centre = scene.project(flight.player);
  const outline = LIGHT_FIELD.markerOutline;
  const { insets, view } = scene.controls.layout();
  // Inside the safe game area: never under a notch, a curved corner or the home bar.
  const area = safeGameArea(insets, view);
  for (const marker of scene.edgeMarkers.update(flight, indicated, scene.time.now)) {
    // The outermost drawn pixel, the ink outline included on a light field, sits 1 in.
    const at = edgePoint(
      area,
      edgeMarkerInset(scene.light ? outline : 0, marker.kind),
      centre,
      scene.project(marker),
    );
    if (marker.kind === "station") {
      const { diamond, stroke } = EDGE_MARKER_GLYPHS.station;
      // The stroke sits inside the diamond's extent.
      const half = (diamond - stroke) / 2;
      const points = [
        new PhaserMath.Vector2(at.x, at.y - half),
        new PhaserMath.Vector2(at.x + half, at.y),
        new PhaserMath.Vector2(at.x, at.y + half),
        new PhaserMath.Vector2(at.x - half, at.y),
      ];
      if (scene.light) {
        scene.edgeMarkerInk.lineStyle(stroke + 2 * outline, LIGHT_FIELD.ink, 1);
        scene.edgeMarkerInk.strokePoints(points, true, true);
      }
      scene.edgeMarkerInk.lineStyle(stroke, scene.palette.pointOfInterest, 1);
      scene.edgeMarkerInk.strokePoints(points, true, true);
      continue;
    }
    const radius = EDGE_MARKER_GLYPHS[marker.kind].disc / 2;
    if (scene.light) {
      scene.edgeMarkerInk.fillStyle(LIGHT_FIELD.ink, 1);
      scene.edgeMarkerInk.fillCircle(at.x, at.y, radius + outline);
    }
    scene.edgeMarkerInk.fillStyle(scene.palette.threat, 1);
    scene.edgeMarkerInk.fillCircle(at.x, at.y, radius);
    // A guard's ink bar; a guard just disabled fades it out, or drops it under reduced motion.
    const bar = marker.kind === "guard" || !scene.reducedMotion ? (marker.bar ?? 0) : 0;
    if (bar > 0) {
      const { height, width } = EDGE_MARKER_GLYPHS.guard.bar;
      scene.edgeMarkerInk.fillStyle(LIGHT_FIELD.ink, bar);
      scene.edgeMarkerInk.fillRect(at.x - width / 2, at.y - height / 2, width, height);
    }
  }
}

/**
 * An arrow at the view's edge toward each marked place off screen, at any distance
 * (model/indicators.ts), and the holodisk's placeholder beacon ring while it is on screen.
 */
export function drawIndicators(scene: HudContext): void {
  const cx = SCREEN.width / 2;
  const cy = SCREEN.height / 2;
  for (const target of scene.model.indicatorTargets) {
    const point = scene.project(target);
    const onScreen =
      point.x >= 0 && point.y >= 0 && point.x <= SCREEN.width && point.y <= SCREEN.height;
    if (onScreen) {
      if (target.kind === "holodisk") {
        // Placeholder until Art's beacon ring sprite.
        const pulse = (scene.time.now / 1000) % 1;
        scene.overlay.lineStyle(2, scene.palette.pointOfInterest, 0.9 - pulse * 0.6);
        scene.overlay.strokeCircle(point.x, point.y, 24 + pulse * 16);
      }
      continue;
    }
    const dx = point.x - cx;
    const dy = point.y - cy;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const scale = Math.min((cx - 44) / Math.abs(dx), (cy - 100) / Math.abs(dy));
    const x = cx + dx * Math.max(0, scale);
    const y = cy + dy * Math.max(0, scale);
    const arrow = [
      { x: x + ux * 8, y: y + uy * 8 },
      { x: x - ux * 5 - uy * 5, y: y - uy * 5 + ux * 5 },
      { x: x - ux * 5 + uy * 5, y: y - uy * 5 - ux * 5 },
    ] as const;
    const ring = { x: x - ux * 13, y: y - uy * 13 };
    if (scene.light) {
      drawIndicatorInk(scene, arrow, ring);
    }
    scene.overlay.lineStyle(2, scene.palette.pointOfInterest, 0.8);
    scene.overlay.strokeTriangle(
      arrow[0].x,
      arrow[0].y,
      arrow[1].x,
      arrow[1].y,
      arrow[2].x,
      arrow[2].y,
    );
    scene.overlay.strokeCircle(ring.x, ring.y, 3);
  }
}

/**
 * A light field's ink stroke under an indicator (`lightField.indicatorStroke`), round joined.
 * It draws opaque on a layer at alpha 0.8, so the joins do not stack.
 */
export function drawIndicatorInk(
  scene: HudContext,
  arrow: readonly [Vec, Vec, Vec],
  ring: Vec,
): void {
  const width = LIGHT_FIELD.indicatorStroke;
  const ink = scene.indicatorInk.setAlpha(0.8);
  ink.lineStyle(width, LIGHT_FIELD.ink, 1);
  ink.strokeTriangle(arrow[0].x, arrow[0].y, arrow[1].x, arrow[1].y, arrow[2].x, arrow[2].y);
  ink.strokeCircle(ring.x, ring.y, 3);
  ink.fillStyle(LIGHT_FIELD.ink, 1);
  for (const corner of arrow) {
    ink.fillCircle(corner.x, corner.y, width / 2);
  }
}

/**
 * Feedback pulses; on a light field each stroke first draws in ink 2 keyline wider on the same
 * path, its 1 px ink edge.
 */
export function drawFeedback(scene: HudContext): void {
  const grow = scene.light ? LIGHT_FIELD.keyline : 0;
  for (const edge of grow ? [true, false] : [false]) {
    for (const pulse of scene.feedback.pulses) {
      drawPulse(scene, edge ? grow : 0, pulse);
    }
  }
}

/** One feedback pulse, or with `grow` its ink edge: the same strokes `2 grow` wider in ink. */
export function drawPulse(scene: HudContext, grow: number, pulse: FeedbackPulse): void {
  // Travel plays the quantum jump; the old teleport ring is retired with it.
  if (pulse.kind === "teleport" && scene.quantum) {
    return;
  }
  const at = scene.project(pulse);
  const radius = 12 + pulse.age * (pulse.kind === "teleport" ? 140 : 55);
  scene.overlay.lineStyle(
    (pulse.kind === "damage" ? 3 : 1.5) + 2 * grow,
    grow
      ? LIGHT_FIELD.ink
      : pulse.kind === "damage"
        ? scene.palette.obstacle
        : pulse.kind === "shield" || pulse.kind === "pickup"
          ? scene.palette.active
          : pulse.kind === "hit"
            ? scene.palette.weapon
            : scene.palette.pointOfInterest,
    Math.max(0, 1 - pulse.age / 0.65),
  );
  if (pulse.kind === "hit" || pulse.kind === "disabled") {
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      scene.overlay.lineBetween(
        at.x + Math.cos(angle) * radius,
        at.y + Math.sin(angle) * radius,
        at.x + Math.cos(angle) * (radius + 7),
        at.y + Math.sin(angle) * (radius + 7),
      );
    }
    if (pulse.kind === "disabled") {
      scene.overlay.strokeRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
    }
  } else if (pulse.kind === "pickup" || pulse.kind === "deposit") {
    scene.overlay.strokePoints(
      [
        new PhaserMath.Vector2(at.x, at.y - radius),
        new PhaserMath.Vector2(at.x + radius, at.y),
        new PhaserMath.Vector2(at.x, at.y + radius),
        new PhaserMath.Vector2(at.x - radius, at.y),
      ],
      true,
    );
    if (pulse.kind === "deposit") {
      scene.overlay.strokeCircle(at.x, at.y, radius * 0.65);
    }
  } else {
    scene.overlay.strokeCircle(at.x, at.y, radius);
    if (pulse.kind === "damage") {
      scene.overlay.lineBetween(
        at.x - radius,
        at.y - radius,
        at.x - radius * 0.65,
        at.y - radius * 0.65,
      );
      scene.overlay.lineBetween(
        at.x + radius,
        at.y + radius,
        at.x + radius * 0.65,
        at.y + radius * 0.65,
      );
    }
    if (pulse.kind === "teleport") {
      scene.overlay.strokeCircle(at.x, at.y, radius * 0.6);
    }
  }
}
