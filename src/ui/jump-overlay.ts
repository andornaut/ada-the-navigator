import {
  canvasFit,
  emergencyGlow,
  irisRadius,
  type JumpFrame,
  type JumpStep,
  jumpStepAt,
  posePaths,
  type QuantumJump,
  reducedShipWeights,
  reducedWeights,
  spriteHeading,
  switchMs,
  tunnelScale,
  warpPoseSize,
} from "../game/quantum-jump.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import type { Vec } from "../model/types.ts";
import { readViewUnit } from "./layout/viewScale.ts";

// Draws Art's quantum jump over the play area (art/quantum-jump.md). The real scene shows through
// the transparent canvas: the source until the switch, then the destination the game switched to.
// Each step holds for its ms; the warp ship draws over the scene from the first step with a ship.

/** A sprite sheet from the root art manifest: frames in rows of `width / frameWidth`. */
export interface SheetArt {
  readonly frameHeight: number;
  readonly frameWidth: number;
  readonly frames: Readonly<Record<string, number>>;
  readonly height: number;
  readonly url: string;
  readonly width: number;
}
export interface JumpArt {
  /** The reduced-motion stills. */
  readonly field: SheetArt;
  readonly glow: SheetArt;
  readonly jump: QuantumJump;
  readonly star: SheetArt;
  readonly tunnel: SheetArt;
}
/** A scene as the effect needs it, in view logical px. */
export interface JumpScene {
  /** The jump centre: the play view's centre. */
  readonly center: Vec;
  /** Ada's ship heading in the scene; null for a scene without her ship, which draws no warp ship. */
  readonly heading: number | null;
  /** Background specks that streak toward the centre. */
  readonly specks: readonly Vec[];
}
export interface JumpPlay {
  readonly destination: () => JumpScene;
  readonly emergency: boolean;
  /** Called once, as the warp ship first draws, so the scene hides its own ship until done. */
  readonly onCover: () => void;
  readonly onDone: () => void;
  /** Called once, when the source is fully covered, to switch the game to the destination. */
  readonly onSwitch: () => void;
  readonly reducedMotion: boolean;
  readonly source: JumpScene;
}
/** The paint in use: its scheme for the warp poses and its in-game idle frame URL per heading. */
export interface WarpPaint {
  readonly scheme: string;
  readonly sprites: readonly string[];
}

/** The pixel rectangle of a named frame within its sheet. */
export function sheetFrame(
  sheet: SheetArt,
  frame: string,
): { x: number; y: number; width: number; height: number } | null {
  const index = sheet.frames[frame];
  if (index === undefined) {
    return null;
  }
  const columns = Math.max(1, Math.floor(sheet.width / sheet.frameWidth));
  return {
    height: sheet.frameHeight,
    width: sheet.frameWidth,
    x: (index % columns) * sheet.frameWidth,
    y: Math.floor(index / columns) * sheet.frameHeight,
  };
}

const ready = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;

export function createJumpOverlay(
  host: HTMLElement,
  art: JumpArt,
): {
  readonly active: () => boolean;
  readonly dispose: () => void;
  readonly play: (play: JumpPlay) => void;
  /** Loads the paint's poses and sprite frames; a pose still loading draws the sprite instead. */
  readonly setPaint: (paint: WarpPaint) => void;
} {
  const canvas = document.createElement("canvas");
  canvas.className = "ada-jump";
  // Above every layer, taking input so nothing acts mid-jump.
  Object.assign(canvas.style, {
    height: "100%",
    inset: "0",
    pointerEvents: "auto",
    position: "absolute",
    width: "100%",
    zIndex: "1000",
  });
  canvas.setAttribute("aria-hidden", "true");
  const load = (url: string) => {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    return image;
  };
  const jump = art.jump;
  const { warp } = jump;
  const images = {
    field: load(art.field.url),
    glow: load(art.glow.url),
    star: load(art.star.url),
    tunnel: load(art.tunnel.url),
  };
  // The paint's poses by id and its sprite frames by heading, loaded when the paint is set; and
  // the rasterized ship and its white silhouette per image and device px size.
  let paint: WarpPaint | null = null;
  let poses = new Map<string, HTMLImageElement>();
  let sprites: readonly (HTMLImageElement | null)[] = [];
  let rasters = new Map<string, HTMLCanvasElement>();
  let running: (JumpPlay & { covered: boolean; start: number; switched: boolean }) | null = null;
  let request = 0;

  const raster = (image: HTMLImageElement, pixels: number, white: boolean): HTMLCanvasElement => {
    const size = Math.max(1, Math.round(pixels));
    const key = `${image.src}|${size}|${white ? 1 : 0}`;
    let drawn = rasters.get(key);
    if (!drawn) {
      drawn = document.createElement("canvas");
      drawn.width = size;
      drawn.height = size;
      const paint2d = drawn.getContext("2d");
      if (paint2d) {
        paint2d.drawImage(image, 0, 0, size, size);
        if (white) {
          paint2d.globalCompositeOperation = "source-in";
          paint2d.fillStyle = "#ffffff";
          paint2d.fillRect(0, 0, size, size);
        }
      }
      rasters.set(key, drawn);
    }
    return drawn;
  };

  const drawSheet = (
    context: CanvasRenderingContext2D,
    sheet: SheetArt,
    image: HTMLImageElement,
    frame: string,
    at: { x: number; y: number; width: number; height: number },
    alpha = 1,
  ): void => {
    const source = sheetFrame(sheet, frame);
    if (!source || !ready(image)) {
      return;
    }
    context.globalAlpha = alpha;
    // Art's sheets are pixel art: nearest at their fractional scale.
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      at.x,
      at.y,
      at.width,
      at.height,
    );
    context.globalAlpha = 1;
  };

  const centred = (sheet: SheetArt, centre: Vec, scale: number) => ({
    height: sheet.frameHeight * scale,
    width: sheet.frameWidth * scale,
    x: centre.x - (sheet.frameWidth * scale) / 2,
    y: centre.y - (sheet.frameHeight * scale) / 2,
  });

  // The ship at the centre: a pose's SVG, or the sprite frame at a heading, then its whitening.
  const drawShip = (
    context: CanvasRenderingContext2D,
    options: {
      readonly alpha: number;
      readonly centre: Vec;
      readonly heading: number;
      readonly pixels: number;
      readonly pose: string | null;
      readonly scale: number;
      readonly white: number;
    },
  ): boolean => {
    const pose = options.pose === null ? undefined : poses.get(options.pose);
    let image: HTMLImageElement | null = null;
    let size = 0;
    if (pose && ready(pose)) {
      image = pose;
      size = warpPoseSize(warp, options.scale);
    } else {
      const frame = sprites[options.heading];
      if (frame && ready(frame)) {
        image = frame;
        // The sprite frame at the poses' display scale: its in-game size at scale 1.
        size = frame.naturalWidth * warp.displayScale * options.scale;
      }
    }
    if (!image) {
      return false;
    }
    const x = options.centre.x - size / 2;
    const y = options.centre.y - size / 2;
    context.imageSmoothingEnabled = true;
    context.globalAlpha = options.alpha;
    context.drawImage(raster(image, size * options.pixels, false), x, y, size, size);
    if (options.white > 0) {
      context.globalAlpha = options.alpha * options.white;
      context.drawImage(raster(image, size * options.pixels, true), x, y, size, size);
    }
    context.globalAlpha = 1;
    return true;
  };

  const drawStep = (
    context: CanvasRenderingContext2D,
    play: JumpPlay,
    scene: JumpScene,
    frame: JumpFrame,
    step: JumpStep,
    view: { height: number; width: number },
    pixels: number,
  ): boolean => {
    const centre = scene.center;
    if (step.streak) {
      context.strokeStyle = jump.streak.colour;
      context.lineWidth = jump.streak.width;
      context.beginPath();
      for (const speck of scene.specks) {
        const dx = centre.x - speck.x;
        const dy = centre.y - speck.y;
        const gap = Math.hypot(dx, dy);
        if (gap < 1) {
          continue;
        }
        const reach = Math.min(gap, jump.streak.length * step.streak);
        context.moveTo(speck.x, speck.y);
        context.lineTo(speck.x + (dx / gap) * reach, speck.y + (dy / gap) * reach);
      }
      context.stroke();
    }
    if (step.tunnel) {
      const scale = tunnelScale(
        { height: art.tunnel.frameHeight, width: art.tunnel.frameWidth },
        centre,
        view,
      );
      const radius = step.iris ? irisRadius(view, step.iris) : 0;
      context.save();
      if (step.iris) {
        // The tunnel outside the iris; the scene shows through inside it.
        context.beginPath();
        context.rect(0, 0, view.width, view.height);
        context.arc(centre.x, centre.y, radius, 0, Math.PI * 2, true);
        context.clip("evenodd");
      }
      drawSheet(
        context,
        art.tunnel,
        images.tunnel,
        step.tunnel,
        centred(art.tunnel, centre, scale),
      );
      context.restore();
      if (step.iris) {
        const { line, rim } = jump.iris;
        context.strokeStyle = rim.colour;
        context.lineWidth = rim.to - rim.from;
        context.beginPath();
        context.arc(centre.x, centre.y, radius + (rim.from + rim.to) / 2, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = line.colour;
        context.lineWidth = line.width;
        context.beginPath();
        context.arc(centre.x, centre.y, radius + line.at, 0, Math.PI * 2);
        context.stroke();
      }
    }
    const glow = play.emergency ? emergencyGlow(jump, frame, step) : step.glow;
    if (glow) {
      drawSheet(context, art.glow, images.glow, glow, centred(art.glow, centre, 1));
    }
    let drewShip = false;
    if (step.ship && scene.heading !== null) {
      const source = play.source.heading ?? warp.heading;
      drewShip = drawShip(context, {
        alpha: 1,
        centre,
        heading: spriteHeading(source, warp.heading, step.ship.turn, SHIP_HEADINGS),
        pixels,
        pose: step.ship.pose === "sprite" ? null : step.ship.pose,
        scale: step.ship.scale,
        white: step.ship.white ?? 0,
      });
    }
    if (step.star) {
      drawSheet(context, art.star, images.star, "jump", centred(art.star, centre, 1));
    }
    if (play.emergency && frame.name === "charge") {
      context.globalAlpha = jump.emergency.charge.wash.alpha;
      context.fillStyle = jump.emergency.charge.wash.colour;
      context.fillRect(0, 0, view.width, view.height);
      context.globalAlpha = 1;
    }
    return drewShip;
  };

  const render = (now: number): void => {
    if (!running) {
      return;
    }
    const play = running;
    const ms = now - play.start;
    if (!play.switched && ms >= switchMs(jump, play.reducedMotion)) {
      play.switched = true;
      play.onSwitch();
    }
    const done = play.reducedMotion ? reducedWeights(jump, ms) === null : !jumpStepAt(jump, ms);
    if (done) {
      running = null;
      // The canvas is in the page only while a jump plays.
      canvas.remove();
      play.onDone();
      return;
    }
    const s = readViewUnit(host);
    const ratio = window.devicePixelRatio || 1;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    // Everything below is in view logical px.
    context.setTransform(ratio * s, 0, 0, ratio * s, 0, 0);
    const view = { height: height / s, width: width / s };
    const scene = play.switched ? play.destination() : play.source;
    let drewShip = false;
    if (play.reducedMotion) {
      // A cross-fade through the still in-between, the ship held over it: no iris, streaks, glow,
      // whitening or star.
      const weights = reducedWeights(jump, ms)!;
      const fit = canvasFit({ height: art.field.frameHeight, width: art.field.frameWidth }, view);
      const still = play.emergency ? jump.emergency.still : jump.reducedMotion.still;
      drawSheet(
        context,
        art.field,
        images.field,
        still,
        {
          height: art.field.frameHeight * fit.scale,
          width: art.field.frameWidth * fit.scale,
          x: fit.x,
          y: fit.y,
        },
        weights.still,
      );
      const ship = reducedShipWeights(jump, ms);
      const arrival = play.destination().heading;
      for (const [heading, alpha] of [
        [play.source.heading, ship.source],
        [play.switched ? arrival : null, ship.destination],
      ] as const) {
        if (heading !== null && alpha > 0) {
          const drawn = drawShip(context, {
            alpha,
            centre: scene.center,
            heading,
            pixels: ratio * s,
            pose: null,
            scale: 1,
            white: 0,
          });
          drewShip ||= drawn;
        }
      }
    } else {
      const { frame, step } = jumpStepAt(jump, ms)!;
      drewShip = drawStep(context, play, scene, frame, step, view, ratio * s);
    }
    if (drewShip && !play.covered) {
      play.covered = true;
      play.onCover();
    }
    request = requestAnimationFrame(render);
  };

  return {
    active: () => running !== null,
    dispose: () => {
      cancelAnimationFrame(request);
      running = null;
      canvas.remove();
    },
    play: (play) => {
      cancelAnimationFrame(request);
      // A hidden page draws no frames, so the jump completes at once.
      if (document.hidden) {
        play.onSwitch();
        play.onDone();
        return;
      }
      running = { ...play, covered: false, start: performance.now(), switched: false };
      host.append(canvas);
      request = requestAnimationFrame(render);
    },
    setPaint: (next) => {
      if (
        paint &&
        paint.scheme === next.scheme &&
        paint.sprites.join("\n") === next.sprites.join("\n")
      ) {
        return;
      }
      paint = next;
      poses = new Map([...posePaths(warp, next.scheme)].map(([id, url]) => [id, load(url)]));
      sprites = next.sprites.map((url) => (url ? load(url) : null));
      rasters = new Map();
    },
  };
}
