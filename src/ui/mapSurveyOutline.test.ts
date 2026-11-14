import { readFileSync } from "node:fs";

import type { Rect } from "@andornaut/game-kit/rect";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CHARTING_ORIGIN, CHARTING_RADIUS, withinChartingRadius } from "../model/map.ts";
import { MAP_COLORS, type MapView, toScreen } from "./layout/mapScreen.ts";
import { drawMapSurveyOutline } from "./mapSurveyOutline.ts";

const INNER = { height: 240, width: 600, x: 30, y: 80 };
function canvas() {
  const commands: { args: unknown[]; name: string }[] = [];
  const context = {
    beginPath: () => commands.push({ args: [], name: "beginPath" }),
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
    const view = { centre, scale };
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
    expect(commands.find(({ name }) => name === "rect")?.args).toEqual(
      [INNER.x, INNER.y, INNER.width, INNER.height].map((value) => value * px),
    );
    expect(commands.find(({ name }) => name === "dash")?.args).toEqual([6 * px, 4 * px]);
    expect(commands.filter(({ name }) => name === "stroke").map(({ args }) => args)).toEqual([
      [3 * px, MAP_COLORS.ink],
      [px, MAP_COLORS.supporting],
    ]);
    expect(commands.at(-1)?.name).toBe("restore");
    expect(context.fill).not.toHaveBeenCalled();
  });

  it("uses the same periodic origin image as map places", () => {
    const { commands, context } = canvas();
    const view: MapView = { centre: { x: 1151900, y: 0 }, scale: 0.01, worldSide: 1152000 };
    drawMapSurveyOutline(context as unknown as CanvasRenderingContext2D, INNER, view, 1);
    const at = toScreen(INNER, view, CHARTING_ORIGIN);
    expect(commands.find(({ name }) => name === "ellipse")?.args.slice(0, 2)).toEqual([at.x, at.y]);
  });
});

it("draws the survey outline after fog and before search markers, including an unexplored map", () => {
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
    const context = { clearRect: () => calls.push("clear") };
    const state = { field: { fog: "#000" }, map: { explored } };
    const fog = { getContext: () => context, height: 360, width: 720 };
    const draw = new Function(
      "state",
      "fog",
      "screen",
      "devicePixelRatio",
      "fogOver",
      "drawMapSurveyOutline",
      "drawSearchArea",
      body,
    )(
      state,
      fog,
      { clientHeight: 360, clientWidth: 720 },
      1,
      () => calls.push("fog"),
      () => calls.push("survey"),
      () => calls.push("search"),
    ) as (inner: Rect, unit: number, view: MapView) => void;
    draw(INNER, 1, { centre: { x: 0, y: 0 }, scale: 0.01 });
    expect(calls).toEqual(
      explored.length ? ["clear", "fog", "survey", "search"] : ["clear", "survey", "search"],
    );
  }
});
