import { pageToGame } from "@andornaut/game-kit/runtime/view/pagePoint";
import { describe, expect, it } from "vitest";

import { frameDeviceOrigin, frameRect, readFrameTurn } from "./frameBox.ts";

// A 744x396 frame turned onto a 396x744 page box below a 121 CSS px toolbar.
const HOST = { height: 744, left: 0, top: 121, width: 396 };
const frame = { height: 396, width: 744 };

const root = (turn: string | null) => ({
  getAttribute: (name: string) => (name === "data-frame-turn" ? turn : null),
});

describe("frame turn", () => {
  it("reads the turn watchFrameTurn marks on the root, unturned without one", () => {
    expect(readFrameTurn(root("90"))).toBe(90);
    expect(readFrameTurn(root("-90"))).toBe(-90);
    expect(readFrameTurn(root(null))).toBe(0);
    expect(readFrameTurn(undefined)).toBe(0);
  });
});

describe("frame rect", () => {
  it("keeps an unturned page box", () => {
    const box = { height: 20, left: 150, top: 70, width: 40 };
    expect(frameRect(0, { height: 360, left: 100, top: 50, width: 720 }, box)).toEqual({
      height: 20,
      width: 40,
      x: 50,
      y: 20,
    });
  });

  it.each([90, -90] as const)(
    "maps a page box turned by %s as pageToGame maps its corners",
    (turn) => {
      const box = { height: 30, left: 40, top: 300, width: 28 };
      const rect = frameRect(turn, HOST, box);
      const corners = [
        { x: box.left, y: box.top },
        { x: box.left + box.width, y: box.top + box.height },
      ].map((client) =>
        pageToGame(
          turn,
          { height: HOST.height, width: HOST.width, x: HOST.left, y: HOST.top },
          frame,
          client,
        ),
      );
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      expect(rect.x).toBeCloseTo(Math.min(...xs), 9);
      expect(rect.y).toBeCloseTo(Math.min(...ys), 9);
      expect(rect.width).toBeCloseTo(Math.max(...xs) - Math.min(...xs), 9);
      expect(rect.height).toBeCloseTo(Math.max(...ys) - Math.min(...ys), 9);
    },
  );
});

describe("frame device grid", () => {
  const onGrid = (value: number) => Math.abs(value - Math.round(value)) < 1e-6;

  it.each([0, 90, -90] as const)(
    "puts whole device pixels along each frame axis on whole page device pixels, turned by %s",
    (turn) => {
      const dpr = 30 / 11;
      const host = { height: 744.08, left: 0.37, top: 121.21, width: 396.04 };
      const origin = frameDeviceOrigin(turn, host, dpr);
      // The page coordinate of a frame offset along axis (pageToGame inverted).
      const page = (axis: "x" | "y", offset: number): number => {
        if (turn === 90) {
          return axis === "x" ? host.top + offset : host.left + host.width - offset;
        }
        if (turn === -90) {
          return axis === "x" ? host.top + host.height - offset : host.left + offset;
        }
        return axis === "x" ? host.left + offset : host.top + offset;
      };
      for (const axis of ["x", "y"] as const) {
        for (const device of [-3, 40, 1010]) {
          const offset = (device - origin[axis]) / dpr;
          expect(onGrid(page(axis, offset) * dpr)).toBe(true);
          // Half a device pixel along is half a page device pixel off the grid.
          expect(onGrid(page(axis, offset + 0.5 / dpr) * dpr)).toBe(false);
        }
      }
    },
  );
});
