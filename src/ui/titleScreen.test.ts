import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { engineJets, jetLength, layerAlpha, readEngineJets } from "../game/shipJets.ts";
import { fromAreaLeft, fromAreaTop } from "./layout/css.ts";
import { START_SCREEN } from "./layout/startScreen.ts";
import { START_SCREEN_CLASS, START_SCREEN_STYLE } from "./startScreen.ts";
import { jetPolygons, readTitleScreen, type TitleAsset, titleShip } from "./titleScreen.ts";

const publicJson = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
const manifest = publicJson("/art/manifest.json") as { assets: TitleAsset[]; titleScreen: string };
const data = publicJson(manifest.titleScreen) as Record<string, unknown>;
// The title ship's jets draw at Engine level 1.
const jets = engineJets(readEngineJets(publicJson("/art/ship-jets.json"))!, 1);
const art = readTitleScreen(manifest.assets, jets, data)!;

describe("title screen art", () => {
  it("links title-screen.json from the core manifest as titleScreen", () => {
    expect(manifest.titleScreen).toBe("/art/title-screen.json");
    expect(art).not.toBeNull();
  });

  it("bleeds the 960x660 field 120 past the game area's top and sides", () => {
    expect(art.background).toBe("#292734");
    expect(art.field).toEqual({
      at: { x: -120, y: -120 },
      height: 660,
      url: "/art/title-field.png",
      width: 960,
    });
    expect(art.wordmark).toEqual({ height: 102, url: "/art/ui/title-wordmark.svg", width: 270 });
  });

  it("draws the selected paint's ship-52, Classic's before a paint or for an unknown one", () => {
    expect(titleShip(art, null)).toBe("/art/ship-52.svg");
    const cobalt = manifest.assets.find(({ id }) => id === "ship-cobalt-52")!;
    expect(titleShip(art, "cobalt")).toBe(cobalt.path);
    expect(titleShip(art, "unknown")).toBe("/art/ship-52.svg");
  });

  it("holds frame 52 at f 0.8 with its selected physical attachment profile", () => {
    expect(data.ship).toMatchObject({ animated: false, frame: 52, jetSpeed: 0.8 });
    expect(art.jets.length).toBeGreaterThan(0);
    if (art.normalJets) {
      expect(art.jets.every(({ alpha }) => alpha === 1)).toBe(true);
      const scale = START_SCREEN.ship.size / jets.frame;
      const core = jets.layers.find((layer) => layer.name === "core")!;
      const polygons = jetPolygons(art);
      expect(polygons).toHaveLength(jets.headings[52]!.length * jets.layers.length);
      polygons.forEach((polygon, index) => {
        const mouth = jets.headings[52]![Math.floor(index / jets.layers.length)]!;
        const layerIndex = index % jets.layers.length;
        const layer = jets.layers[layerIndex]!;
        const width =
          layer.name === "core"
            ? mouth.normalAperture!.coreWidth
            : layerIndex === 0
              ? 1
              : (mouth.normalAperture!.coreWidth * layer.width) / core.width;
        const [base, tip, other] = polygon.points
          .split(" ")
          .map((point) => point.split(",").map(Number));
        expect((base![0]! + other![0]!) / 2).toBeCloseTo(mouth.anchor.x * scale, 10);
        expect((base![1]! + other![1]!) / 2).toBeCloseTo(mouth.anchor.y * scale, 10);
        expect((base![0]! - other![0]!) / 2).toBeCloseTo(mouth.half.x * width * scale, 10);
        expect((base![1]! - other![1]!) / 2).toBeCloseTo(mouth.half.y * width * scale, 10);
        const length = jetLength(jets, 0.8) * layer.length;
        expect(tip![0]).toBeCloseTo((mouth.anchor.x + mouth.axis.x * length) * scale, 10);
        expect(tip![1]).toBeCloseTo((mouth.anchor.y + mouth.axis.y * length) * scale, 10);
      });
      return;
    }
    expect(Math.min(...art.jets.map(({ alpha }) => alpha))).toBeCloseTo(0.25, 9);
    const scale = START_SCREEN.ship.size / jets.frame;
    const layers = jets.layers.filter((layer) => layerAlpha(layer, 0.8) > 0);
    const widest = layers.reduce((a, b) => (a.width > b.width ? a : b));
    const outer = layers.find((layer) => layer.name === "outer")!;
    const core = layers.find((layer) => layer.name === "core")!;
    const coreOffset = Math.min(
      outer.width - core.width,
      outer.width * (1 - core.length / outer.length),
    );
    expect(coreOffset).toBeGreaterThan(0);
    const polygons = jetPolygons(art);
    expect(polygons).toHaveLength(jets.headings[52]!.length * layers.length);
    for (const [index, polygon] of polygons.entries()) {
      const mouth = jets.headings[52]![Math.floor(index / layers.length)]!;
      const layer = layers[index % layers.length]!;
      const points = polygon.points.split(" ").map((point) => point.split(",").map(Number));
      const [base, tip, other] = points as [[number, number], [number, number], [number, number]];
      expect(mouth.outerCorner).toBeDefined();
      expect(mouth.coreOutboard).toBe(true);
      const corner = mouth.outerCorner!;
      const offset = layer.name === "core" ? coreOffset : 0;
      // All layers share the widest visible base's attachment; only the core moves within it.
      const centre = {
        x: corner.x - mouth.half.x * widest.width + mouth.half.x * offset,
        y: corner.y - mouth.half.y * widest.width + mouth.half.y * offset,
      };
      expect((base[0] + other[0]) / 2).toBeCloseTo(centre.x * scale, 10);
      expect((base[1] + other[1]) / 2).toBeCloseTo(centre.y * scale, 10);
      if (layer === widest) {
        expect(base[0]).toBeCloseTo(corner.x * scale, 10);
        expect(base[1]).toBeCloseTo(corner.y * scale, 10);
      }
      expect((base[0] - other[0]) / 2).toBeCloseTo(mouth.half.x * layer.width * scale, 10);
      expect((base[1] - other[1]) / 2).toBeCloseTo(mouth.half.y * layer.width * scale, 10);
      const length = jetLength(jets, 0.8) * layer.length;
      expect(tip[0]).toBeCloseTo((centre.x + mouth.axis.x * length) * scale, 10);
      expect(tip[1]).toBeCloseTo((centre.y + mouth.axis.y * length) * scale, 10);
    }
  });

  it("translates the entire group with its authored attachment without changing the other profile", () => {
    const withMouths = (
      transform: (
        mouth: (typeof jets.headings)[number][number],
      ) => (typeof jets.headings)[number][number],
    ) => ({
      ...jets,
      headings: jets.headings.map((mouths, heading) =>
        heading === 52 ? mouths.map(transform) : mouths,
      ),
    });
    const movedCentres = withMouths((mouth) => ({
      ...mouth,
      anchor: { x: mouth.anchor.x + 17, y: mouth.anchor.y - 9 },
    }));
    if (art.normalJets) {
      const original = jetPolygons(art);
      const moved = jetPolygons(readTitleScreen(manifest.assets, movedCentres, data)!);
      const scale = START_SCREEN.ship.size / jets.frame;
      moved.forEach((polygon, index) => {
        const points = polygon.points.split(/[ ,]/u).map(Number);
        const before = original[index]!.points.split(/[ ,]/u).map(Number);
        points.forEach((point, coordinate) =>
          expect(point - before[coordinate]!).toBeCloseTo(
            (coordinate % 2 === 0 ? 17 : -9) * scale,
            10,
          ),
        );
      });
      return;
    }
    expect(jetPolygons(readTitleScreen(manifest.assets, movedCentres, data)!)).toEqual(
      jetPolygons(art),
    );
    const movedCorners = withMouths((mouth) => ({
      ...mouth,
      outerCorner: { x: mouth.outerCorner!.x + 11, y: mouth.outerCorner!.y - 7 },
    }));
    const original = jetPolygons(art);
    const moved = jetPolygons(readTitleScreen(manifest.assets, movedCorners, data)!);
    const scale = START_SCREEN.ship.size / jets.frame;
    for (const [index, polygon] of moved.entries()) {
      const points = polygon.points.split(/[ ,]/u).map(Number);
      const before = original[index]!.points.split(/[ ,]/u).map(Number);
      points.forEach((point, coordinate) => {
        expect(point - before[coordinate]!).toBeCloseTo(
          (coordinate % 2 === 0 ? 11 : -7) * scale,
          10,
        );
      });
    }
  });

  it("keeps full-frame jet coordinates aligned when the manifest sprite pivot changes", () => {
    const assets = manifest.assets.map((asset) =>
      asset.id === "ship-52" ? { ...asset, pivot: { x: 0.2, y: 0.8 } } : asset,
    );
    const shifted = readTitleScreen(assets, jets, data)!;
    const expected = jetPolygons(art);
    for (const [index, polygon] of jetPolygons(shifted).entries()) {
      const points = polygon.points.split(/[ ,]/u).map(Number);
      const original = expected[index]!.points.split(/[ ,]/u).map(Number);
      points.forEach((point, coordinate) => expect(point).toBeCloseTo(original[coordinate]!, 10));
    }
  });

  it("moves authored per-mouth occluders into the same full title frame as their plume", () => {
    const occluders = [
      [
        { x: 12, y: 30 },
        { x: 20, y: 30 },
        { x: 20, y: 40 },
      ],
    ];
    const masked = {
      ...jets,
      headings: jets.headings.map((mouths, heading) =>
        heading === 52
          ? mouths.map((mouth, index) => (index === 0 ? { ...mouth, occluders } : mouth))
          : mouths,
      ),
    };
    const assets = manifest.assets.map((asset) =>
      asset.id === "ship-52" ? { ...asset, pivot: { x: 0.2, y: 0.8 } } : asset,
    );
    const title = readTitleScreen(assets, masked, data)!;
    const polygons = jetPolygons(title);
    const expected = occluders.map((polygon) =>
      polygon
        .map(
          ({ x, y }) =>
            `${(x * START_SCREEN.ship.size) / jets.frame},${(y * START_SCREEN.ship.size) / jets.frame}`,
        )
        .join(" "),
    );
    expect(polygons[0]!.occluders).toHaveLength(expected.length);
    polygons[0]!.occluders!.forEach((polygon, index) => {
      const coordinates = polygon.split(/[ ,]/u).map(Number);
      const wanted = expected[index]!.split(/[ ,]/u).map(Number);
      coordinates.forEach((coordinate, point) =>
        expect(coordinate).toBeCloseTo(wanted[point]!, 10),
      );
    });
    const untouched = jetPolygons(readTitleScreen(assets, jets, data)!)[3]!;
    expect(polygons[3]!.occluders).toEqual(untouched.occluders);
  });

  it("reads no art from malformed data", () => {
    expect(readTitleScreen(manifest.assets, jets, { ...data, version: 2 })).toBeNull();
    expect(
      readTitleScreen(manifest.assets, jets, { ...data, field: { at: [0], id: "title-field" } }),
    ).toBeNull();
    expect(
      readTitleScreen(manifest.assets, jets, { ...data, wordmark: { id: "missing" } }),
    ).toBeNull();
    expect(
      readTitleScreen(manifest.assets, jets, { ...data, ship: { frame: 99, jetSpeed: 0.8 } }),
    ).toBeNull();
    expect(readTitleScreen(manifest.assets, jets, null)).toBeNull();
    // Without valid jets the ship still draws, with none.
    expect(readTitleScreen(manifest.assets, undefined, data)?.jets).toEqual([]);
  });
});

describe("start screen style", () => {
  const rule = (selector: string) => {
    const start = START_SCREEN_STYLE.indexOf(`${selector}{`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    return START_SCREEN_STYLE.slice(start, START_SCREEN_STYLE.indexOf("}", start));
  };

  it("covers the play area under the HUD row's nav discs", () => {
    expect(START_SCREEN_CLASS).toBe("ada-start");
    const root = rule(`.${START_SCREEN_CLASS}`);
    expect(root).toContain("inset:0");
    // The controls overlay, with Achievements and Settings, draws at z-index 10.
    expect(root).toContain("z-index:4");
  });

  it("places the ship, wordmark, actions and note from the game area's top-left corner", () => {
    const { actions, note, ship, wordmark } = START_SCREEN;
    expect(rule(`.${START_SCREEN_CLASS} .ada-start-title`)).toContain(
      `left:${fromAreaLeft(wordmark.left)}`,
    );
    expect(rule(`.${START_SCREEN_CLASS} .ada-start-ship`)).toContain(
      `left:${fromAreaLeft(ship.centre.x - ship.size / 2)}`,
    );
    for (const action of ["continue", "restart", "start"] as const) {
      expect(rule(`.${START_SCREEN_CLASS} .ada-start-actions > [data-action=${action}]`)).toContain(
        `left:${fromAreaLeft(actions.left[action])}`,
      );
    }
    expect(rule(`.${START_SCREEN_CLASS} .ada-start-actions > button`)).toContain(
      `top:${fromAreaTop(actions.top)}`,
    );
    // The note (only the forced update's message) is one body line centred on the game area.
    const noteRule = rule(`.${START_SCREEN_CLASS} .ada-start-note`);
    expect(noteRule).toContain(`left:${fromAreaLeft(note.centre)}`);
    expect(noteRule).toContain(`top:${fromAreaTop(note.top)}`);
    expect(noteRule).toContain("transform:translateX(-50%)");
  });
});
