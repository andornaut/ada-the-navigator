import { readFileSync } from "node:fs";

import type { Rect } from "@andornaut/game-kit/runtime/rect";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CURRENT_FLIGHT_TOPOLOGY } from "../../model/flightTopology.ts";
import { CHARTING_ORIGIN, CHARTING_RADIUS, withinChartingRadius } from "../../model/map.ts";
import { UNLISTED_COLOURS } from "../layout/colours.ts";
import {
  MAP_COLORS,
  type MapView,
  mapWorldDiamond,
  panView,
  scaleLimits,
  toScreen,
} from "./layout/mapScreen.ts";
import { drawMapSurveyOutline } from "./mapSurveyOutline.ts";

const INNER = { height: 240, width: 600, x: 30, y: 80 };
const SIDE = CURRENT_FLIGHT_TOPOLOGY.side;
function canvas() {
  const commands: { args: unknown[]; name: string }[] = [];
  const context = {
    beginPath: () => commands.push({ args: [], name: "beginPath" }),
    canvas: { height: 360, width: 720 },
    clip: () => commands.push({ args: [], name: "clip" }),
    ellipse: (...args: number[]) => commands.push({ args, name: "ellipse" }),
    fill: vi.fn(),
    filter: "blur(4px)",
    globalAlpha: 1,
    globalCompositeOperation: "destination-out",
    lineCap: "round",
    lineWidth: 0,
    rect: (...args: number[]) => commands.push({ args, name: "rect" }),
    restore: () => commands.push({ args: [], name: "restore" }),
    save: () => commands.push({ args: [], name: "save" }),
    setLineDash: (args: number[]) => commands.push({ args, name: "dash" }),
    stroke: () => commands.push({ args: [context.lineWidth, context.strokeStyle], name: "stroke" }),
    strokeStyle: "",
  };
  return { commands, context };
}

describe("central survey outline", () => {
  it.each([
    { centre: { x: 0, y: 0 }, px: 1, scale: 0.001 },
    { centre: { x: 1500, y: -600 }, px: 2, scale: 0.01 },
    { centre: { x: -50000, y: 30000 }, px: 1.5, scale: 0.04 },
  ])("uses the progress circle through projection, pan and zoom: %j", ({ centre, px, scale }) => {
    const { commands, context } = canvas();
    const view = { centre, scale, worldSide: SIDE };
    drawMapSurveyOutline(context as unknown as CanvasRenderingContext2D, INNER, view, px);
    const at = toScreen(INNER, view, CHARTING_ORIGIN);
    const ellipses = commands.filter(({ name }) => name === "ellipse");
    expect(ellipses).toHaveLength(2);
    for (const ellipse of ellipses) {
      const [x, y, rx, ry] = ellipse.args as number[];
      expect(x).toBe(at.x * px);
      expect(y).toBe(at.y * px);
      // A canonical world boundary point must land exactly on the drawn ellipse.
      const boundary = { x: CHARTING_ORIGIN.x + CHARTING_RADIUS, y: CHARTING_ORIGIN.y };
      expect(withinChartingRadius(boundary)).toBe(true);
      expect(withinChartingRadius({ ...boundary, x: boundary.x + 1 })).toBe(false);
      const edge = toScreen(INNER, view, boundary);
      expect(((edge.x * px - x!) / rx!) ** 2 + ((edge.y * px - y!) / ry!) ** 2).toBeCloseTo(1, 10);
    }
    expect(commands.find(({ name }) => name === "rect")?.args).toEqual([
      0,
      0,
      context.canvas.width,
      context.canvas.height,
    ]);
    expect(commands.find(({ name }) => name === "dash")?.args).toEqual([6 * px, 4 * px]);
    expect(commands.filter(({ name }) => name === "stroke").map(({ args }) => args)).toEqual([
      [3 * px, MAP_COLORS.ink],
      [px, MAP_COLORS.supporting],
    ]);
    expect(commands.at(-1)?.name).toBe("restore");
    expect(context.fill).not.toHaveBeenCalled();
  });

  it.each([0, 360])("keeps the canvas clip when panning the oval across row boundary %s", (y) => {
    const { commands, context } = canvas();
    drawMapSurveyOutline(
      context as unknown as CanvasRenderingContext2D,
      INNER,
      { centre: { x: 0, y }, scale: 0.01, worldSide: SIDE },
      1,
    );
    expect(commands.find(({ name }) => name === "rect")?.args).toEqual([0, 0, 720, 360]);
    const ellipse = commands.find(({ name }) => name === "ellipse")!.args as number[];
    expect(ellipse[2]).toBeCloseTo(CHARTING_RADIUS * Math.SQRT2 * 0.01);
    expect(ellipse[3]).toBeCloseTo(ellipse[2]! / 2);
  });

  it("centres on the origin's canonical point, as map places draw", () => {
    const { commands, context } = canvas();
    const view: MapView = { centre: { x: 1151900, y: 0 }, scale: 0.01, worldSide: 1152000 };
    drawMapSurveyOutline(context as unknown as CanvasRenderingContext2D, INNER, view, 1);
    const at = toScreen(INNER, view, CHARTING_ORIGIN);
    expect(commands.find(({ name }) => name === "ellipse")?.args.slice(0, 2)).toEqual([at.x, at.y]);
  });

  it.each([
    { x: 1e7, y: 0 },
    { x: 0, y: -1e7 },
    { x: 1e7, y: -1e7 },
    { x: -1e7, y: 1e7 },
  ])("draws a visible arc after a minScale drag of %j", (delta) => {
    const { commands, context } = canvas();
    const field = { ...context.canvas, x: 0, y: 0 };
    const scale = scaleLimits(INNER, field, SIDE).min;
    const view = panView(INNER, field, delta, { centre: { x: 0, y: 0 }, scale, worldSide: SIDE });
    drawMapSurveyOutline(context as unknown as CanvasRenderingContext2D, INNER, view, 1);
    const [x, y, rx, ry] = commands.find(({ name }) => name === "ellipse")!.args as [
      number,
      number,
      number,
      number,
    ];
    const closest = Math.hypot(
      Math.max(0, -x, x - field.width) / rx,
      Math.max(0, -y, y - field.height) / ry,
    );
    const farthest = Math.hypot(
      Math.max(x, field.width - x) / rx,
      Math.max(y, field.height - y) / ry,
    );
    expect(closest).toBeLessThan(1);
    expect(farthest).toBeGreaterThan(1);
  });
});

it("draws the survey after fog and covers only the exterior after search markers", () => {
  const source = ts.createSourceFile(
    "mapScreen.ts",
    readFileSync(new URL("./mapScreen.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let declaration: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "drawFog") {
      declaration = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!declaration?.initializer) {
    throw new Error("Missing production drawFog");
  }
  const body = ts.transpileModule(
    `const drawFog = ${declaration.initializer.getText(source)}; return drawFog;`,
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  for (const explored of [[], [{ x: 0, y: 0 }]]) {
    const calls: string[] = [];
    const path: number[][] = [];
    const fills: { colour: string; rule: CanvasFillRule }[] = [];
    const context = {
      beginPath: () => {
        path.length = 0;
      },
      clearRect: () => calls.push("clear"),
      closePath: () => calls.push("close path"),
      fill: (rule: CanvasFillRule) => {
        calls.push("outer");
        fills.push({ colour: context.fillStyle, rule });
      },
      fillStyle: "",
      lineTo: (x: number, y: number) => path.push([x, y]),
      moveTo: (x: number, y: number) => path.push([x, y]),
      rect: (...args: number[]) => path.push(args),
      restore: () => calls.push("restore"),
      save: () => calls.push("save"),
    };
    const state = { field: { fog: "#000" }, map: { explored } };
    const fog = { getContext: () => context, height: 0, width: 0 };
    const draw = new Function(
      "state",
      "fog",
      "screen",
      "devicePixelRatio",
      "fogOver",
      "mapWorldDiamond",
      "drawMapSurveyOutline",
      "drawSearchArea",
      "UNLISTED_COLOURS",
      body,
    )(
      state,
      fog,
      { clientHeight: 400, clientWidth: 800 },
      2,
      () => calls.push("fog"),
      mapWorldDiamond,
      () => calls.push("survey"),
      () => calls.push("search"),
      UNLISTED_COLOURS,
    ) as (inner: Rect, unit: number, view: MapView) => void;
    draw(INNER, 1.25, { centre: { x: 60_000, y: -30_000 }, scale: 0.002, worldSide: 240_000 });
    expect(calls).toEqual([
      "clear",
      ...(explored.length ? ["fog"] : []),
      "survey",
      "search",
      "save",
      "close path",
      "outer",
      "restore",
    ]);
    expect(path).toEqual([
      [0, 0, 1600, 800],
      [525, 50],
      [1725, 650],
      [525, 1250],
      [-675, 650],
    ]);
    expect(fills).toEqual([{ colour: "#131119", rule: "evenodd" }]);
  }
});
