import type { Point, Rect } from "@andornaut/game-kit/rect";
import {
  MAX_RENDER_SCALE,
  type RenderFit,
  renderFit,
  renderScale,
} from "@andornaut/game-kit/view/renderScale";
import type Phaser from "phaser";

import { SCREEN } from "../data/screen.ts";
import type { Size } from "../ui/layout/playView.ts";

// The canvas's backing is in device pixels: followFrameTurn's deviceResolution sizes the game to
// the canvas's CSS size times r = min(devicePixelRatio, 2) and zooms the scale manager by 1 / r.
// Layout stays in logical px: every camera zooms the 720x360 base by r times the fit (renderFit),
// possibly fractionally, with its origin at the top-left, so world and scroll coordinates are
// logical px.

// The canvas's fit, from the scale manager: its game size is the backing and its zoom is 1 / r,
// so the canvas's CSS size is the game size times that zoom.
export function sceneFit(scene: Pick<Phaser.Scene, "scale">): RenderFit {
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

// The game area in the canvas, in device pixels, whole: the 720x360 base at the fit's zoom, at
// the canvas's top, centred across. A camera's viewport.
export function playViewport(fit: RenderFit): Rect {
  return {
    height: fit.view.height,
    width: fit.view.width,
    x: Math.floor((fit.backing.width - fit.view.width) / 2),
    y: 0,
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

// The intensity to pass a camera at zoom so its shake moves the view by intensity of the logical
// view's size. Phaser's shake offset is the intensity times the viewport's device-pixel size
// times the zoom, applied inside the zoomed matrix, so it grows with the cube of the zoom.
export function shakeIntensity(zoom: number, intensity: number): number {
  return intensity / zoom ** 2;
}

type FitScene = Pick<Phaser.Scene, "events" | "scale">;
type FitCamera = Pick<Phaser.Cameras.Scene2D.Camera, "setViewport">;

// Keeps camera's viewport at rectOf the canvas's fit, at the fit's zoom with its origin at the
// top-left, now and on every resize, until scene shuts down. It reads the scale manager rather
// than the resize event's size, since one refit fires several.
function keepViewport(scene: FitScene, camera: FitCamera, rectOf: (fit: RenderFit) => Rect): void {
  const fit = (): void => {
    const at = sceneFit(scene);
    const { height, width, x, y } = rectOf(at);
    camera.setViewport(x, y, width, height).setOrigin(0, 0).setZoom(at.zoom);
  };
  fit();
  // Phaser's Scale.Events.RESIZE and Scenes.Events.SHUTDOWN.
  scene.scale.on("resize", fit);
  scene.events.once("shutdown", () => scene.scale.off("resize", fit));
}

// Keeps camera (scene's main camera by default) on the game area (playViewport).
export function fitPlayCamera(
  scene: FitScene & Pick<Phaser.Scene, "cameras">,
  camera: FitCamera = scene.cameras.main,
): void {
  keepViewport(scene, camera, playViewport);
}

// Keeps camera on the whole canvas, for controls placed anywhere in it.
export function fitCanvasCamera(scene: FitScene, camera: FitCamera): void {
  keepViewport(scene, camera, ({ backing }) => ({ ...backing, x: 0, y: 0 }));
}
