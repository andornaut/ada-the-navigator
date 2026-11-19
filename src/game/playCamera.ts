import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import {
  MAX_RENDER_SCALE,
  type RenderFit,
  renderFit,
  renderScale,
} from "@andornaut/game-kit/runtime/view/renderScale";
import type { Cameras, Scene } from "phaser";

import { SCREEN } from "../data/screen.ts";
import { playView, type Size } from "../ui/layout/playView.ts";

// The canvas's backing is in device pixels: followFrameTurn's deviceResolution sizes the game to
// the canvas's CSS size times r = min(devicePixelRatio, 2) and zooms the scale manager by 1 / r.
// Layout stays in logical px: every camera zooms the 720x360 base by r times the fit (renderFit),
// possibly fractionally, with its origin at the top-left, so world and scroll coordinates are
// logical px.

// The canvas's fit, from the scale manager: its game size is the backing and its zoom is 1 / r,
// so the canvas's CSS size is the game size times that zoom.
export function sceneFit(scene: Pick<Scene, "scale">): RenderFit {
  const { gameSize, zoom } = scene.scale;
  return renderFit(SCREEN, 1 / zoom, {
    height: gameSize.height * zoom,
    width: gameSize.width * zoom,
  });
}

// The fit a canvas filling parent gets at devicePixelRatio once followFrameTurn sizes it, from
// the parent's layout size, as followFrameTurn measures it.
export function parentFit(
  devicePixelRatio: number,
  parent: Pick<HTMLElement, "offsetHeight" | "offsetWidth">,
): RenderFit {
  return renderFit(SCREEN, renderScale(MAX_RENDER_SCALE, devicePixelRatio), {
    height: parent.offsetHeight,
    width: parent.offsetWidth,
  });
}

// The game area in the canvas, in device pixels, whole: the 720x360 base at the fit's zoom, its
// origin at the DOM game area's (playView of the canvas's logical size) on the nearest device
// pixel, so the canvas and the HTML HUD share one game area. A camera's viewport.
export function playViewport(fit: RenderFit): Rect {
  const area = playView(canvasSize(fit));
  return {
    height: fit.view.height,
    width: fit.view.width,
    x: Math.round(area.x * fit.zoom),
    y: Math.round(area.y * fit.zoom),
  };
}

// The whole canvas in logical px: its backing at the fit's zoom, so a camera at that zoom over
// the whole backing shows exactly this.
export function canvasSize(fit: RenderFit): Size {
  return { height: fit.backing.height / fit.zoom, width: fit.backing.width / fit.zoom };
}

// Where the game area's top-left sits in the canvas, in logical px. The offset is whole in device
// pixels, so it can be fractional here.
export function viewShift(fit: RenderFit): Point {
  const { x, y } = playViewport(fit);
  return { x: x / fit.zoom, y: y / fit.zoom };
}

// The world rectangle a camera fitted here shows, its origin at the top-left, grown by margin
// logical px on every side.
export function cameraWorldView(
  camera: Pick<Cameras.Scene2D.Camera, "height" | "scrollX" | "scrollY" | "width" | "zoom">,
  margin: number,
): Rect {
  return {
    height: camera.height / camera.zoom + 2 * margin,
    width: camera.width / camera.zoom + 2 * margin,
    x: camera.scrollX - margin,
    y: camera.scrollY - margin,
  };
}

// The intensity to pass a camera at zoom so its shake moves the view by intensity of the logical
// view's size. Phaser's shake offset is the intensity times the viewport's device-pixel size
// times the zoom, applied inside the zoomed matrix, so it grows with the cube of the zoom.
export function shakeIntensity(zoom: number, intensity: number): number {
  return intensity / zoom ** 2;
}

type FitScene = Pick<Scene, "events" | "scale">;
type FitCamera = Pick<Cameras.Scene2D.Camera, "setViewport">;

// Keeps camera's viewport at rectOf the canvas's fit, at the fit's zoom with its origin at the
// top-left, now and on every resize, until scene shuts down. It reads the scale manager rather
// than the resize event's size, since one refit fires several.
function keepViewport(
  scene: FitScene,
  camera: FitCamera,
  rectOf: (fit: RenderFit) => Rect,
  scrollOf?: (fit: RenderFit) => Point,
): () => void {
  const fit = (): void => {
    const at = sceneFit(scene);
    const { height, width, x, y } = rectOf(at);
    const fitted = camera.setViewport(x, y, width, height).setOrigin(0, 0).setZoom(at.zoom);
    const scroll = scrollOf?.(at);
    if (scroll) {
      fitted.setScroll(scroll.x, scroll.y);
    }
  };
  fit();
  // Phaser's Scale.Events.RESIZE and Scenes.Events.SHUTDOWN.
  scene.scale.on("resize", fit);
  scene.events.once("shutdown", () => scene.scale.off("resize", fit));
  return fit;
}

// Keeps camera (scene's main camera by default) on the game area (playViewport).
export function fitPlayCamera(
  scene: FitScene & Pick<Scene, "cameras">,
  camera: FitCamera = scene.cameras.main,
  fullBleed?: () => boolean,
): void {
  if (!fullBleed) {
    keepViewport(scene, camera, playViewport);
    return;
  }
  const refresh = keepViewport(
    scene,
    camera,
    (fit) => (fullBleed() ? { ...fit.backing, x: 0, y: 0 } : playViewport(fit)),
    (fit) => {
      const shift = viewShift(fit);
      return fullBleed() ? { x: -shift.x, y: -shift.y } : { x: 0, y: 0 };
    },
  );
  let wide = fullBleed();
  const modeChanged = () => {
    const next = fullBleed();
    if (next !== wide) {
      wide = next;
      refresh();
    }
  };
  scene.events.on("preupdate", modeChanged);
  scene.events.once("shutdown", () => scene.events.off("preupdate", modeChanged));
}

// Keeps camera on the whole canvas, for controls placed anywhere in it.
export function fitCanvasCamera(scene: FitScene, camera: FitCamera): void {
  keepViewport(scene, camera, ({ backing }) => ({ ...backing, x: 0, y: 0 }));
}
