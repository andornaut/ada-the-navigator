import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { expect, it, vi } from "vitest";

import { whaleFrameAsset, whaleViewBox } from "../art/whaleArt.ts";
import { galaxyLoadsAtOnce } from "./artManifest.ts";
import type { Asset } from "./sceneShared.ts";
import { vectorSheetKey } from "./svgSheet.ts";

const names = new Set([
  "arrivalQueues",
  "followArrivalLoad",
  "queueEagerSvgSheets",
  "svgSheets",
  "loadGalaxyAsset",
  "queueWhaleSheetFrame",
  "whaleSheets",
  "whaleTexture",
]);
const source = ts.createSourceFile(
  "sceneAssets.ts",
  readFileSync(new URL("./sceneAssets.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const code = source.statements
  .filter((node) => {
    if (ts.isFunctionDeclaration(node)) {
      return names.has(node.name?.text ?? "");
    }
    return (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(({ name }) => names.has(name.getText(source)))
    );
  })
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");

const sheet = "/art/whales/adult-6-sheet.svg";
const frames = Array.from({ length: 8 }, (_, index): Asset => ({
  directionIndex: 6,
  displayHeight: 48,
  displayWidth: 91,
  height: 48,
  id: `whale-adult-6-${index}`,
  kind: "adult",
  path: sheet,
  pivot: { x: 0.5, y: 0.49 },
  svgSheet: true,
  width: 91,
}));
const first = frames[0]!;
const even = frames[2]!;
const last = frames[7]!;
const event = `filecomplete-xml-${vectorSheetKey(sheet)}`;

function fixture() {
  const downloads = new EventEmitter();
  const events = new EventEmitter();
  const xml = vi.fn();
  const textures = new Set<string>();
  const cache = new Map<string, unknown>();
  const loadSvg = vi.fn();
  const vectorSheetSource = vi.fn((_xml, _path, { id }: { id: string }) => `data:${id}`);
  const context = createContext({
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
    console: { warn: vi.fn() },
    galaxyLoadsAtOnce,
    loadSvg,
    vectorSheetKey,
    vectorSheetSource,
    whaleFrameAsset,
    whaleViewBox,
  });
  runInContext(ts.transpile(code), context);
  const scene = {
    cache: { xml: cache },
    events,
    load: { once: downloads.once.bind(downloads), xml },
    rockQueued: false,
    textures: { exists: (key: string) => textures.has(key) },
    whaleArt: {
      kinds: new Map([["adult", { viewBoxes: { 6: { height: 109.714, width: 208 } } }]]),
    },
    whaleRequests: new Set<string>(),
  };
  return {
    boot: (
      context.queueEagerSvgSheets as (
        sourceScene: typeof scene,
        current: () => boolean,
        fail: (error: unknown) => void,
        assets: readonly Asset[],
      ) => void
    ).bind(undefined, scene, () => true, vi.fn()),
    cache,
    downloads,
    events,
    galaxy: (context.loadGalaxyAsset as (sourceScene: typeof scene, frame: Asset) => void).bind(
      undefined,
      scene,
    ),
    loadSvg,
    scene,
    texture: (context.whaleTexture as (sourceScene: typeof scene, frame: Asset) => boolean).bind(
      undefined,
      scene,
    ),
    textures,
    vectorSheetSource,
    xml,
  };
}

it("excludes whale sheets from both core preload and galaxy admission", () => {
  const f = fixture();
  const other = { ...first, id: "enemy-fighter-0", kind: "fighter", path: "/art/fighter.svg" };
  f.boot([...frames, other]);
  for (const frame of frames) {
    f.galaxy(frame);
  }
  expect(f.xml).toHaveBeenCalledExactlyOnceWith(vectorSheetKey(other.path), other.path);
  expect(f.loadSvg).not.toHaveBeenCalled();
});

it("shares one pending request and extracts only named frames in request order", () => {
  const f = fixture();
  expect([f.texture(last), f.texture(first), f.texture(last)]).toEqual([false, false, false]);
  expect(f.xml).toHaveBeenCalledExactlyOnceWith(vectorSheetKey(sheet), sheet);
  expect(f.scene.rockQueued).toBe(true);
  expect(f.loadSvg).not.toHaveBeenCalled();
  f.downloads.emit(event, vectorSheetKey(sheet), "xml", {});
  expect(f.loadSvg.mock.calls.map(([, frame]) => frame)).toEqual([
    { ...last, path: `data:${last.id}` },
    { ...first, path: `data:${first.id}` },
  ]);
  expect(f.vectorSheetSource).toHaveBeenNthCalledWith(1, {}, sheet, {
    height: 109.714,
    id: last.id,
    intrinsicHeight: 48,
    intrinsicWidth: 91,
    width: 208,
  });
  f.cache.set(vectorSheetKey(sheet), {});
  f.texture(even);
  expect(f.loadSvg).toHaveBeenLastCalledWith(f.scene, { ...even, path: `data:${even.id}` });
  expect(f.xml).toHaveBeenCalledOnce();
  f.textures.add(first.id);
  expect(f.texture(first)).toBe(true);
});

it("does not publish a stopped scene's completion or keep its pending frame in a restart", () => {
  const f = fixture();
  f.texture(first);
  f.events.emit("shutdown");
  f.downloads.emit(event, vectorSheetKey(sheet), "xml", {});
  expect(f.loadSvg).not.toHaveBeenCalled();
  f.texture(even);
  expect(f.xml).toHaveBeenCalledTimes(2);
  f.downloads.emit(event, vectorSheetKey(sheet), "xml", {});
  expect(f.loadSvg).toHaveBeenCalledExactlyOnceWith(f.scene, { ...even, path: `data:${even.id}` });
});

it("keeps standalone requests and a malformed sheet frame on their existing fallback", () => {
  const f = fixture();
  const standalone = { ...first, path: "/art/whales/adult-6-0.svg" };
  delete standalone.svgSheet;
  expect(f.texture(standalone)).toBe(false);
  expect(f.texture(standalone)).toBe(false);
  expect(f.loadSvg).toHaveBeenCalledExactlyOnceWith(f.scene, standalone);
  f.vectorSheetSource.mockImplementationOnce(() => {
    throw Error("missing frame");
  });
  expect(f.texture(even)).toBe(false);
  f.downloads.emit(event, vectorSheetKey(sheet), "xml", {});
  expect(f.texture(even)).toBe(false);
  expect(f.loadSvg).toHaveBeenCalledOnce();
});

it("does not rasterize a packed frame without raw dimensions for its own kind and heading", () => {
  const f = fixture();
  const wrongHeading = { ...first, directionIndex: 5 };
  f.texture(wrongHeading);
  f.downloads.emit(event, vectorSheetKey(sheet), "xml", {});
  expect(f.vectorSheetSource).not.toHaveBeenCalled();
  expect(f.loadSvg).not.toHaveBeenCalled();
});
