import { describe, expect, it } from "vitest";

import { fogReveal, toScreen } from "./layout/mapScreen.ts";
import { drawMapFog } from "./mapFog.ts";

const INNER = { height: 300, width: 600, x: 20, y: 40 };
const VIEW = { centre: { x: 0, y: 0 }, scale: 0.02 };
const player = { x: 0, y: 0 };

function canvas() {
  const commands: { name: string; args: number[] }[] = [];
  const context = {
    beginPath: () => commands.push({ args: [], name: "beginPath" }),
    clip: () => commands.push({ args: [], name: "clip" }),
    ellipse: (...args: number[]) => commands.push({ args, name: "ellipse" }),
    fill: () => commands.push({ args: [], name: "fill" }),
    fillRect: (...args: number[]) => commands.push({ args, name: "fillRect" }),
    filter: "none",
    globalCompositeOperation: "source-over",
    rect: (...args: number[]) => commands.push({ args, name: "rect" }),
    restore: () => commands.push({ args: [], name: "restore" }),
    save: () => commands.push({ args: [], name: "save" }),
  };
  return { commands, context: context as unknown as CanvasRenderingContext2D };
}

it("uses the current explored points, discovered places and player without retaining old data", () => {
  const { commands, context } = canvas();
  const map = { explored: [{ x: 100, y: 200 }], places: [], player };
  drawMapFog(context, INNER, VIEW, map, 1, "#c2b37f", 720, 360);
  expect(commands.filter(({ name }) => name === "ellipse")).toHaveLength(2);
  commands.length = 0;
  drawMapFog(context, INNER, VIEW, { ...map, explored: [] }, 1, "#254046", 720, 360);
  expect(commands.filter(({ name }) => name === "ellipse")).toHaveLength(1);
  expect(context.fillStyle).toBe("#000");
  expect(context.filter).toBe("none");
  expect(context.globalCompositeOperation).toBe("source-over");
});

it("culls distant reveals but keeps a reveal whose feather can reach the viewport", () => {
  const { commands, context } = canvas();
  const map = {
    explored: [
      { x: 1e9, y: 0 },
      { x: -1500, y: 1500 },
    ],
    places: [],
    player,
  };
  drawMapFog(context, { ...INNER, x: -300 }, VIEW, map, 1, "#c2b37f", 720, 360);
  expect(commands.filter(({ name }) => name === "ellipse")).toHaveLength(2);
  expect(commands.filter(({ name }) => name === "save")).toHaveLength(2);
  expect(commands.filter(({ name }) => name === "restore")).toHaveLength(2);
});

describe.each([1, 1.5, 2.6, 3])("fog at device scale %s", (px) => {
  it.each([0.00677, 0.02, 0.04742])("keeps exact ellipse geometry at zoom %s", (scale) => {
    const { commands, context } = canvas();
    const current = { centre: { x: 13.3, y: -20.7 }, scale };
    const point = { x: 17.7, y: -23.1 };
    drawMapFog(
      context,
      INNER,
      current,
      { explored: [], places: [], player: point },
      px,
      "#c2b37f",
      720 * px,
      360 * px,
    );
    const ellipse = commands.find(({ name }) => name === "ellipse")!.args;
    const at = toScreen(INNER, current, point);
    const reveal = fogReveal(scale);
    expect(ellipse).toEqual([
      at.x * px,
      at.y * px,
      reveal.rx * px,
      reveal.ry * px,
      0,
      0,
      Math.PI * 2,
    ]);
    const [left, top, width, height] = commands.find(({ name }) => name === "rect")!.args as [
      number,
      number,
      number,
      number,
    ];
    expect(left).toBeLessThanOrEqual(ellipse[0]! - ellipse[2]! - 8 * reveal.sigma * px);
    expect(top).toBeLessThanOrEqual(ellipse[1]! - ellipse[3]! - 8 * reveal.sigma * px);
    expect(left + width).toBeGreaterThanOrEqual(ellipse[0]! + ellipse[2]! + 8 * reveal.sigma * px);
    expect(top + height).toBeGreaterThanOrEqual(ellipse[1]! + ellipse[3]! + 8 * reveal.sigma * px);
    expect(commands.map(({ name }) => name)).toEqual([
      "fillRect",
      "save",
      "beginPath",
      "rect",
      "clip",
      "beginPath",
      "ellipse",
      "fill",
      "restore",
    ]);
  });
});
