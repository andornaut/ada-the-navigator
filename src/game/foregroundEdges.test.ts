import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { inkEdges, LIGHT_FIELD } from "./lightField.ts";

const hudSource = ts.createSourceFile(
  "sceneHud.ts",
  readFileSync(new URL("./sceneHud.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function production(source: ts.SourceFile, name: string) {
  const node = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  )!;
  return ts.transpileModule(`(${node.getText(source).replace(/^export /u, "")})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText;
}

describe("foreground edges", () => {
  it("edges an effect's geometry in ink without rewriting its fills", () => {
    const context = createContext({ LIGHT_FIELD, inkEdges });
    const draw = runInContext(production(hudSource, "keylineEdges"), context) as (
      scene: unknown,
      kinds: string[],
      shapes: unknown[],
    ) => { colour: number }[];
    const shape = { alpha: 1, at: { x: 10, y: 20 }, colour: 0xf0bd68, kind: "disc", radius: 4 };
    expect(draw({ light: true }, ["missile"], [shape])[0]!.colour).toBe(LIGHT_FIELD.ink);
    expect(shape.colour).toBe(0xf0bd68);
    expect(draw({ light: false }, ["missile"], [shape])).toEqual([]);
  });
});

it("edges the enemy weapons in Art's ink without replacing any fills", () => {
  const source = ts.createSourceFile(
    "sceneEnemies.ts",
    readFileSync(new URL("./sceneEnemies.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const effect = { edged: [], shapes: [] };
  const lance = vi.fn<(art: { colours: { ink: number } }, ...args: unknown[]) => typeof effect>(
      () => effect,
    ),
    phaser = vi.fn<(art: { colours: { ink: number } }, ...args: unknown[]) => typeof effect>(
      () => effect,
    ),
    mine = vi.fn<(art: unknown, ...args: unknown[]) => typeof effect>(() => effect),
    edges = vi.fn(() => []);
  const graphics = { clear: vi.fn(), setDepth: vi.fn(), setVisible: vi.fn() };
  for (const call of Object.values(graphics)) {
    call.mockReturnValue(graphics);
  }
  const context = createContext({
    drawEffect: vi.fn(),
    enemyInkEdges: edges,
    enemyPhaser: phaser,
    lance,
    mine,
    playDepth: () => 1,
    ringDart: () => effect,
    ringEmission: () => effect,
  });
  const draw = runInContext(production(source, "drawEnemyWeapons"), context) as (
    scene: unknown,
    view: unknown,
  ) => void;
  const art = { colours: { ink: LIGHT_FIELD.ink }, lightField: { edge: 2 } };
  const scene = {
    add: { graphics: () => graphics },
    enemyWeaponsArt: art,
    light: true,
    mineInk: new Map(),
    mineSprites: new Map(),
    project: (point: unknown) => point,
    reducedMotion: true,
  };
  const tell = { end: { x: 10, y: 20 }, muzzle: { x: 0, y: 0 } };
  draw(scene, {
    lances: [tell],
    mines: [{ at: { x: 5, y: 10 }, id: "mine" }],
    phasers: [tell],
    ringBolts: [],
    rings: [],
  });
  // The effects keep Art's own colours; their edges take the ink.
  expect(lance.mock.calls[0]![0]).toBe(art);
  expect(phaser.mock.calls[0]![0]).toBe(art);
  expect(mine.mock.calls[0]![0]).toBe(art);
  expect(art.colours.ink).toBe(LIGHT_FIELD.ink);
  expect(edges).toHaveBeenCalledWith(LIGHT_FIELD.ink, art.lightField.edge, effect.edged);
});
