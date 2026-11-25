import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { inkEdges, KEYLINE_ALPHA, LIGHT_FIELD, thresholdSilhouette } from "./lightField.ts";
import { Silhouettes } from "./silhouettes.ts";

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

describe("data-selected foreground boundaries", () => {
  it("keeps white and dark silhouette caches distinct across galaxy transitions", () => {
    const pixels = new Map<string, Uint8ClampedArray>();
    const events = new EventEmitter();
    class ImageSource {}
    vi.stubGlobal("HTMLImageElement", ImageSource);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    const scene = {
      edgeInk: 0xffffff,
      events,
      rasters: { scale: 1 },
      silhouettes: new Silhouettes(),
      textures: {
        createCanvas(key: string) {
          const data = new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, 0]);
          return {
            getContext: () => ({
              drawImage() {},
              getImageData: () => ({ data }),
              putImageData() {
                pixels.set(key, data);
              },
            }),
            refresh() {},
          };
        },
        exists: (key: string) => pixels.has(key),
        remove: (key: string) => pixels.delete(key),
      },
    };
    const context = createContext({
      KEYLINE_ALPHA,
      LIGHT_FIELD,
      ScaleModes: { NEAREST: 0 },
      Scenes: { Events: { DESTROY: "destroy", SHUTDOWN: "shutdown" } },
      filterTexture: vi.fn(),
      thresholdSilhouette,
    });
    const draw = runInContext(production(hudSource, "keylineSilhouette"), context) as (
      scene: unknown,
      sprite: unknown,
    ) => string;
    const sprite = {
      frame: {
        cutHeight: 1,
        cutWidth: 2,
        cutX: 0,
        cutY: 0,
        name: "0",
        source: { image: new ImageSource(), scaleMode: 0 },
        texture: { key: "ship" },
      },
    };
    const white = draw(scene, sprite);
    expect([...pixels.get(white)!]).toEqual([255, 255, 255, 255, 255, 255, 255, 0]);
    scene.edgeInk = LIGHT_FIELD.ink;
    const dark = draw(scene, sprite);
    expect(dark).not.toBe(white);
    expect([...pixels.get(dark)!].slice(0, 4)).toEqual([24, 20, 37, 255]);
    scene.edgeInk = 0xffffff;
    expect(draw(scene, sprite)).toBe(white);
    // A frame later, the silhouette nothing drew since goes; the one still drawn stays.
    for (let frame = 0; frame < 2; frame++) {
      scene.silhouettes.sweep(
        scene.rasters.scale,
        scene.edgeInk,
        (key) => key === white,
        (key) => pixels.delete(key),
      );
    }
    expect([...pixels.keys()]).toEqual([white]);
    events.emit("shutdown");
    expect([...pixels.keys()]).toEqual([]);
    expect(events.listenerCount("destroy")).toBe(0);
  });

  it("uses the selected edge for geometry without rewriting original fills", () => {
    const context = createContext({ LIGHT_FIELD, inkEdges });
    const draw = runInContext(production(hudSource, "keylineEdges"), context) as (
      scene: unknown,
      kinds: string[],
      shapes: unknown[],
    ) => { colour: number }[];
    const shape = { alpha: 1, at: { x: 10, y: 20 }, colour: 0xf0bd68, kind: "disc", radius: 4 };
    expect(draw({ edgeInk: 0xffffff, light: true }, ["missile"], [shape])[0]!.colour).toBe(
      0xffffff,
    );
    expect(shape.colour).toBe(0xf0bd68);
    expect(draw({ edgeInk: 0xffffff, light: false }, ["missile"], [shape])).toEqual([]);
  });
});

it("selects enemy beam boundary ink without replacing mine or signal fills", () => {
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
    edgeInk: 0xffffff,
    enemyWeaponsArt: art,
    light: true,
    mineInk: new Map(),
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
  expect(lance.mock.calls[0]![0].colours.ink).toBe(0xffffff);
  expect(phaser.mock.calls[0]![0].colours.ink).toBe(0xffffff);
  expect(mine.mock.calls[0]![0]).toBe(art);
  expect(art.colours.ink).toBe(LIGHT_FIELD.ink);
  expect(edges).toHaveBeenCalledWith(0xffffff, art.lightField.edge, effect.edged);
});
