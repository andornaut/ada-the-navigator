import {
  canvasFit,
  emergencyGlow,
  irisRadius,
  jumpFrameAt,
  type QuantumJump,
  reducedWeights,
  switchMs,
} from "../game/quantum-jump.ts";
import type { Vec } from "../model/types.ts";
import { readViewUnit } from "./layout/viewScale.ts";

// Draws Art's quantum jump over the play area (art/quantum-jump.md). The real scene shows through
// the transparent canvas: the source until the switch, then the destination the game switched to.

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
  readonly field: SheetArt;
  readonly glow: SheetArt;
  readonly jump: QuantumJump;
  readonly star: SheetArt;
}
/** A scene as the effect needs it, in view logical px. */
export interface JumpScene {
  /** The ship's place, or the point the iris centres on in a scene without the ship. */
  readonly center: Vec;
  readonly ship: {
    readonly height: number;
    readonly image: CanvasImageSource;
    readonly width: number;
    /** Top-left. */
    readonly x: number;
    readonly y: number;
  } | null;
  /** Background specks that streak toward the ship. */
  readonly specks: readonly Vec[];
}
export interface JumpPlay {
  readonly destination: () => JumpScene;
  readonly emergency: boolean;
  readonly onDone: () => void;
  /** Called once, when the source is fully covered, to switch the game to the destination. */
  readonly onSwitch: () => void;
  readonly reducedMotion: boolean;
  readonly source: JumpScene;
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

export function createJumpOverlay(
  host: HTMLElement,
  art: JumpArt,
): {
  readonly active: () => boolean;
  readonly dispose: () => void;
  readonly play: (play: JumpPlay) => void;
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
  const images = { field: load(art.field.url), glow: load(art.glow.url), star: load(art.star.url) };
  let running: (JumpPlay & { start: number; switched: boolean }) | null = null;
  let request = 0;

  const drawFrame = (
    context: CanvasRenderingContext2D,
    sheet: SheetArt,
    image: HTMLImageElement,
    frame: string,
    at: { x: number; y: number; width: number; height: number },
    alpha = 1,
  ): void => {
    const source = sheetFrame(sheet, frame);
    if (!source || !image.complete || !image.naturalWidth) {
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

  const render = (now: number): void => {
    if (!running) {
      return;
    }
    const play = running;
    const ms = now - play.start;
    const jump = art.jump;
    if (!play.switched && ms >= switchMs(jump, play.reducedMotion)) {
      play.switched = true;
      play.onSwitch();
    }
    const done = play.reducedMotion ? reducedWeights(jump, ms) === null : !jumpFrameAt(jump, ms);
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
    const fit = canvasFit({ height: art.field.frameHeight, width: art.field.frameWidth }, view);
    const fieldRect = {
      height: art.field.frameHeight * fit.scale,
      width: art.field.frameWidth * fit.scale,
      x: fit.x,
      y: fit.y,
    };
    const scene = play.switched ? play.destination() : play.source;
    if (play.reducedMotion) {
      // A cross-fade through the still in-between: no iris, streaks, glow, whitening or star.
      const weights = reducedWeights(jump, ms)!;
      const still = play.emergency ? jump.emergency.still : jump.reducedMotion.still;
      drawFrame(context, art.field, images.field, still, fieldRect, weights.still);
      request = requestAnimationFrame(render);
      return;
    }
    const frame = jumpFrameAt(jump, ms)!;
    const center = scene.center;
    if (frame.star) {
      // The only bright frame: the field over the whole view and the star, no scene or ship.
      drawFrame(context, art.field, images.field, frame.field ?? "jump", fieldRect);
      const star = sheetFrame(art.star, "jump");
      if (star) {
        drawFrame(context, art.star, images.star, "jump", {
          height: star.height,
          width: star.width,
          x: center.x - star.width / 2,
          y: center.y - star.height / 2,
        });
      }
      request = requestAnimationFrame(render);
      return;
    }
    if (frame.streak) {
      context.strokeStyle = jump.streak.colour;
      context.lineWidth = jump.streak.width;
      context.beginPath();
      for (const speck of scene.specks) {
        const dx = center.x - speck.x;
        const dy = center.y - speck.y;
        const gap = Math.hypot(dx, dy);
        if (gap < 1) {
          continue;
        }
        const reach = Math.min(gap, jump.streak.length * frame.streak);
        context.moveTo(speck.x, speck.y);
        context.lineTo(speck.x + (dx / gap) * reach, speck.y + (dy / gap) * reach);
      }
      context.stroke();
    }
    const glow = play.emergency ? emergencyGlow(jump, frame) : frame.glow;
    if (glow) {
      const size = sheetFrame(art.glow, glow);
      if (size) {
        drawFrame(context, art.glow, images.glow, glow, {
          height: size.height,
          width: size.width,
          x: center.x - size.width / 2,
          y: center.y - size.height / 2,
        });
      }
      // The glow sits under the ship, so the ship draws again above it.
      if (scene.ship) {
        // The ship is vector art: smooth.
        context.imageSmoothingEnabled = true;
        context.drawImage(
          scene.ship.image,
          scene.ship.x,
          scene.ship.y,
          scene.ship.width,
          scene.ship.height,
        );
      }
    }
    if (frame.white && scene.ship) {
      const ship = scene.ship;
      const silhouette = document.createElement("canvas");
      silhouette.width = Math.max(1, Math.round(ship.width * s * ratio));
      silhouette.height = Math.max(1, Math.round(ship.height * s * ratio));
      const paint = silhouette.getContext("2d");
      if (paint) {
        paint.drawImage(ship.image, 0, 0, silhouette.width, silhouette.height);
        paint.globalCompositeOperation = "source-in";
        paint.fillStyle = "#ffffff";
        paint.fillRect(0, 0, silhouette.width, silhouette.height);
        context.globalAlpha = frame.white;
        context.imageSmoothingEnabled = true;
        context.drawImage(silhouette, ship.x, ship.y, ship.width, ship.height);
        context.globalAlpha = 1;
      }
    }
    if (frame.iris && frame.field) {
      const radius = irisRadius(view, frame.iris);
      context.save();
      context.beginPath();
      context.rect(0, 0, view.width, view.height);
      context.arc(center.x, center.y, radius, 0, Math.PI * 2, true);
      context.clip("evenodd");
      drawFrame(context, art.field, images.field, frame.field, fieldRect);
      context.restore();
      const { line, rim } = jump.iris;
      context.strokeStyle = rim.colour;
      context.lineWidth = rim.to - rim.from;
      context.beginPath();
      context.arc(center.x, center.y, radius + (rim.from + rim.to) / 2, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = line.colour;
      context.lineWidth = line.width;
      context.beginPath();
      context.arc(center.x, center.y, radius + line.at, 0, Math.PI * 2);
      context.stroke();
    }
    if (play.emergency && frame.name === "charge") {
      context.globalAlpha = jump.emergency.charge.wash.alpha;
      context.fillStyle = jump.emergency.charge.wash.colour;
      context.fillRect(0, 0, view.width, view.height);
      context.globalAlpha = 1;
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
      running = { ...play, start: performance.now(), switched: false };
      host.append(canvas);
      request = requestAnimationFrame(render);
    },
  };
}
