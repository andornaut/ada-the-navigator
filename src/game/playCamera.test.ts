import { describe, expect, it, vi } from "vitest";

import { logicalView, playView, viewScale } from "../ui/layout/playView.ts";
import {
  canvasSize,
  fitCanvasCamera,
  fitPlayCamera,
  playViewport,
  sceneFit,
  shakeIntensity,
  viewShift,
} from "./playCamera.ts";

// A scale manager as followFrameTurn's deviceResolution leaves it for a canvas css big at r
// device pixels per CSS pixel: the game size is the backing and the zoom is 1 / r.
function deviceScale(css: { height: number; width: number }, r: number) {
  return {
    gameSize: { height: Math.round(css.height * r), width: Math.round(css.width * r) },
    zoom: 1 / r,
  };
}

// The fit of a scene whose canvas is css big at r.
function fitAt(css: { height: number; width: number }, r: number) {
  return sceneFit({ scale: deviceScale(css, r) } as unknown as Parameters<typeof sceneFit>[0]);
}

// A scene whose scale manager emits resize, and a camera recording what it was set to.
function fakeScene(css: { height: number; width: number }, r: number) {
  const listeners = new Map<string, () => void>();
  let shutdown = (): void => undefined;
  const camera = {
    origin: [0.5, 0.5],
    setOrigin(x: number, y: number) {
      camera.origin = [x, y];
      return camera;
    },
    setViewport(x: number, y: number, width: number, height: number) {
      camera.viewport = [x, y, width, height];
      return camera;
    },
    setZoom(zoom: number) {
      camera.zoom = zoom;
      return camera;
    },
    viewport: [0, 0, 0, 0],
    zoom: 1,
  };
  const scale = {
    ...deviceScale(css, r),
    off: vi.fn((event: string) => listeners.delete(event)),
    on: vi.fn((event: string, listener: () => void) => listeners.set(event, listener)),
  };
  const scene = {
    cameras: { main: camera },
    events: {
      once: (event: string, listener: () => void) => {
        expect(event).toBe("shutdown");
        shutdown = listener;
      },
    },
    scale,
  };
  const resize = (next: { height: number; width: number }, nextR: number): void => {
    Object.assign(scale, deviceScale(next, nextR));
    listeners.get("resize")?.();
  };
  return { camera, listeners, resize, scene, shutdown: () => shutdown() };
}

// The scene and camera types are Pick<> views of Phaser's; the fakes cover exactly those.
type Scene = Parameters<typeof fitPlayCamera>[0];
type Camera = Parameters<typeof fitCanvasCamera>[1];

describe("render fit", () => {
  it.each([
    // CSS size, r, zoom, device viewport, logical canvas.
    [{ height: 360, width: 720 }, 1, 1, [0, 0, 720, 360], { height: 360, width: 720 }],
    [{ height: 390, width: 844 }, 2, 2.1667, [64, 0, 1560, 780], { height: 360, width: 779.08 }],
    [{ height: 720, width: 1280 }, 2, 3.5556, [0, 0, 2560, 1280], { height: 405, width: 720 }],
    [{ height: 600, width: 1600 }, 1, 1.6667, [200, 0, 1200, 600], { height: 360, width: 960 }],
  ])("at %o and r %s zooms %s into %o over a %o canvas", (css, r, zoom, viewport, canvas) => {
    const fit = fitAt(css, r);
    expect(fit.r).toBeCloseTo(r, 9);
    expect(fit.zoom).toBeCloseTo(zoom, 4);
    const { height, width, x, y } = playViewport(fit);
    expect([x, y, width, height]).toEqual(viewport);
    const size = canvasSize(fit);
    expect(size.width).toBeCloseTo(canvas.width, 2);
    expect(size.height).toBeCloseTo(canvas.height, 2);
  });

  it("draws the same logical canvas as the DOM overlay's view scale", () => {
    for (const css of [
      { height: 390, width: 844 },
      { height: 412, width: 915 },
      { height: 900, width: 1440 },
    ]) {
      for (const r of [1, 1.5, 2]) {
        const fit = fitAt(css, r);
        expect(fit.fit).toBeCloseTo(viewScale(css), 3);
        const logical = logicalView(css);
        expect(canvasSize(fit).width).toBeCloseTo(logical.width, 0);
        expect(canvasSize(fit).height).toBeCloseTo(logical.height, 0);
      }
    }
  });

  it("shifts the game area by a whole device pixel, within one logical px of the DOM's", () => {
    const css = { height: 390, width: 844 };
    for (const r of [1, 2]) {
      const fit = fitAt(css, r);
      const shift = viewShift(fit);
      expect(Number.isInteger(shift.x * fit.zoom)).toBe(true);
      expect(shift.y).toBe(0);
      expect(Math.abs(shift.x - playView(logicalView(css)).x)).toBeLessThan(1);
    }
  });
});

describe("camera shake", () => {
  it("moves the view by the same logical share of 720 px at every zoom", () => {
    for (const zoom of [1, 1.0833, 2.1667, 3.5556]) {
      // Phaser's largest offset (Shake.update), applied inside the zoomed matrix, in device px.
      const viewportWidth = 720 * zoom;
      const device = shakeIntensity(zoom, 0.002) * viewportWidth * zoom * zoom;
      expect(device / zoom).toBeCloseTo(0.002 * 720, 9);
    }
  });
});

describe("play cameras", () => {
  it("keeps the main camera on the game area at the fit's zoom from the top-left", () => {
    const fake = fakeScene({ height: 390, width: 844 }, 2);
    fitPlayCamera(fake.scene as unknown as Scene);
    expect(fake.camera.viewport).toEqual([64, 0, 1560, 780]);
    expect(fake.camera.origin).toEqual([0, 0]);
    expect(fake.camera.zoom).toBeCloseTo(780 / 360, 9);
    fake.resize({ height: 360, width: 720 }, 1);
    expect(fake.camera.viewport).toEqual([0, 0, 720, 360]);
    expect(fake.camera.zoom).toBe(1);
  });

  it("keeps a canvas camera on the whole backing", () => {
    const fake = fakeScene({ height: 390, width: 844 }, 2);
    fitCanvasCamera(fake.scene as unknown as Scene, fake.camera as unknown as Camera);
    expect(fake.camera.viewport).toEqual([0, 0, 1688, 780]);
    expect(fake.camera.origin).toEqual([0, 0]);
  });

  it("stops following resizes when the scene shuts down", () => {
    const fake = fakeScene({ height: 390, width: 844 }, 2);
    fitPlayCamera(fake.scene as unknown as Scene);
    expect(fake.listeners.has("resize")).toBe(true);
    fake.shutdown();
    expect(fake.listeners.has("resize")).toBe(false);
  });
});
