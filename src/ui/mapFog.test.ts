import { describe, expect, it } from "vitest";

import { fogReveal, mapProjection, toScreen } from "./layout/mapScreen.ts";
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

it("reveals a known seam image near the view without revealing its far canonical position", () => {
  const side = 1_152_000;
  const player = { x: side / 2 - 100, y: 0 };
  const place = {
    id: "known",
    job: false,
    kind: "landmark" as const,
    label: "Wreck",
    objective: false,
    symbol: "wreck" as const,
    travel: false,
    x: -side / 2 + 100,
    y: 0,
  };
  const periodic = { centre: mapProjection(player), scale: 0.02, worldSide: side };
  const { commands, context } = canvas();
  drawMapFog(
    context,
    INNER,
    periodic,
    { explored: [], places: [place], player },
    1,
    "#123456",
    640,
    360,
  );
  const ellipses = commands.filter(({ name }) => name === "ellipse");
  expect(ellipses).toHaveLength(2);
  expect(ellipses[0]!.args.slice(0, 2)).toEqual(Object.values(toScreen(INNER, periodic, place)));
  expect(place.x).toBe(-side / 2 + 100);
});

function cachedCanvas(width = 720, height = 360) {
  const target = canvas();
  const raster = canvas();
  const image = { getContext: () => raster.context, height: 0, width: 0 };
  const createElement = () => {
    allocations++;
    return image;
  };
  let allocations = 0;
  Object.assign(target.context, {
    canvas: { height, ownerDocument: { createElement }, width },
    drawImage: (...args: unknown[]) =>
      target.commands.push({ args: args.slice(1) as number[], name: "drawImage" }),
  });
  return { ...target, allocations: () => allocations, image, raster };
}

describe("bounded Gaussian stamp", () => {
  it("blurs once per exact geometry while applying every current reveal in source order", () => {
    const target = cachedCanvas();
    const map = {
      explored: [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
      ],
      places: [],
      player: { x: 40, y: 60 },
    };
    drawMapFog(target.context, INNER, VIEW, map, 1, "#123456", 720, 360);
    const draws = target.commands.filter(({ name }) => name === "drawImage");
    expect(draws).toHaveLength(3);
    expect(target.raster.commands.filter(({ name }) => name === "fill")).toHaveLength(1);
    expect(target.commands.filter(({ name }) => name === "ellipse")).toHaveLength(0);
    const origin = draws[0]!.args;
    const points = [...map.explored, map.player].map((point) => toScreen(INNER, VIEW, point));
    draws.forEach(({ args }, index) => {
      expect(args[0]! - origin[0]!).toBeCloseTo(points[index]!.x - points[0]!.x, 10);
      expect(args[1]! - origin[1]!).toBeCloseTo(points[index]!.y - points[0]!.y, 10);
    });
    const before = target.commands.length;
    drawMapFog(
      target.context,
      INNER,
      VIEW,
      { explored: [], places: [], player: map.player },
      1,
      "#654321",
      720,
      360,
    );
    expect(target.commands.slice(before).filter(({ name }) => name === "drawImage")).toHaveLength(
      1,
    );
    expect(target.raster.commands.filter(({ name }) => name === "fill")).toHaveLength(1);
    expect(target.context.fillStyle).toBe("#000");
    expect(target.context.globalCompositeOperation).toBe("source-over");
    expect(target.context.filter).toBe("none");
    expect(target.allocations()).toBe(1);
  });

  it("rebuilds the same bounded canvas on zoom or device scale changes, never on fog colour", () => {
    const target = cachedCanvas(2160, 1080);
    const map = { explored: [], places: [], player };
    drawMapFog(target.context, INNER, VIEW, map, 1, "#123456", 2160, 1080);
    const first = target.image.width;
    drawMapFog(target.context, INNER, { ...VIEW, scale: 0.03 }, map, 1, "#123456", 2160, 1080);
    expect(target.image.width).toBeGreaterThan(first);
    drawMapFog(target.context, INNER, { ...VIEW, scale: 0.03 }, map, 2, "#123456", 2160, 1080);
    expect(target.raster.commands.filter(({ name }) => name === "fill")).toHaveLength(3);
    drawMapFog(target.context, INNER, { ...VIEW, scale: 0.03 }, map, 2, "#654321", 2160, 1080);
    expect(target.raster.commands.filter(({ name }) => name === "fill")).toHaveLength(3);
    expect(target.image.width * target.image.height).toBeLessThanOrEqual(2160 * 1080);
    expect(target.allocations()).toBe(1);
  });

  it("releases an oversized cached raster on viewport shrink and retains the vector rendering", () => {
    const target = cachedCanvas();
    const map = { explored: [], places: [], player };
    drawMapFog(target.context, INNER, VIEW, map, 1, "#123456", 720, 360);
    expect(target.image.width).toBeGreaterThan(0);
    Object.assign(target.context.canvas, { height: 20, width: 20 });
    const shrunk = target.commands.length;
    drawMapFog(
      target.context,
      { height: 20, width: 20, x: 0, y: 0 },
      VIEW,
      map,
      1,
      "#123456",
      20,
      20,
    );
    expect(target.commands.slice(shrunk).filter(({ name }) => name === "ellipse")).toHaveLength(1);
    expect(target.image.width).toBe(0);
    expect(target.image.height).toBe(0);
    Object.assign(target.context.canvas, { height: 360, width: 720 });
    drawMapFog(target.context, INNER, VIEW, map, 1, "#123456", 720, 360);
    expect(target.allocations()).toBe(2);
    expect(target.image.width).toBeGreaterThan(0);
  });

  it("does not retain a previous place after it becomes hidden or leaves the visible area", () => {
    const target = cachedCanvas();
    const map = {
      explored: [],
      places: [
        {
          id: "known",
          job: false,
          kind: "landmark" as const,
          label: "Known",
          objective: false,
          symbol: "wreck" as const,
          travel: false,
          x: 0,
          y: 0,
        },
      ],
      player: { x: 1e6, y: 1e6 },
    };
    drawMapFog(target.context, INNER, VIEW, map, 1, "#123456", 720, 360);
    expect(target.commands.filter(({ name }) => name === "drawImage")).toHaveLength(1);
    const start = target.commands.length;
    drawMapFog(target.context, INNER, VIEW, { ...map, places: [] }, 1, "#123456", 720, 360);
    expect(target.commands.slice(start).filter(({ name }) => name === "drawImage")).toHaveLength(0);
    expect(target.commands.slice(start).filter(({ name }) => name === "fillRect")).toHaveLength(1);
  });
});
