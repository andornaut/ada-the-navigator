import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { engineJets, jetLength, layerAlpha, readEngineJets } from "../game/shipJets.ts";
import { fromAreaLeft, units } from "./layout/css.ts";
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

  it("places the 960x540 field at (-120, 0) over the space background", () => {
    expect(art.background).toBe("#292734");
    expect(art.field).toEqual({
      at: { x: -120, y: 0 },
      height: 540,
      url: "/art/title-field.png",
      width: 960,
    });
    expect(art.wordmark).toEqual({ height: 102, url: "/art/ui/title-wordmark.svg", width: 270 });
  });

  it("draws the selected paint's ship-26, Classic's before a paint or for an unknown one", () => {
    expect(titleShip(art, null)).toBe("/art/ship-26.svg");
    const cobalt = manifest.assets.find(({ id }) => id === "ship-cobalt-26")!;
    expect(titleShip(art, "cobalt")).toBe(cobalt.path);
    expect(titleShip(art, "unknown")).toBe("/art/ship-26.svg");
  });

  it("holds frame 26's jets at f 0.8, attached to each exported mouth at the title frame's scale", () => {
    expect(data.ship).toMatchObject({ animated: false, frame: 26, jetSpeed: 0.8 });
    expect(art.jets.length).toBeGreaterThan(0);
    expect(Math.min(...art.jets.map(({ alpha }) => alpha))).toBeCloseTo(0.25, 9);
    const scale = START_SCREEN.ship.size / jets.frame;
    const layers = jets.layers.filter((layer) => layerAlpha(layer, 0.8) > 0);
    const polygons = jetPolygons(art);
    expect(polygons).toHaveLength(jets.headings[26]!.length * layers.length);
    for (const [index, polygon] of polygons.entries()) {
      const mouth = jets.headings[26]![Math.floor(index / layers.length)]!;
      const layer = layers[index % layers.length]!;
      const points = polygon.points.split(" ").map((point) => point.split(",").map(Number));
      const [base, tip, other] = points as [[number, number], [number, number], [number, number]];
      // The base straddles the exported mouth centre; no heading-specific translation.
      expect((base[0] + other[0]) / 2).toBeCloseTo(mouth.anchor.x * scale, 10);
      expect((base[1] + other[1]) / 2).toBeCloseTo(mouth.anchor.y * scale, 10);
      expect((base[0] - other[0]) / 2).toBeCloseTo(mouth.half.x * layer.width * scale, 10);
      expect((base[1] - other[1]) / 2).toBeCloseTo(mouth.half.y * layer.width * scale, 10);
      const length = jetLength(jets, 0.8) * layer.length;
      expect(tip[0]).toBeCloseTo((mouth.anchor.x + mouth.axis.x * length) * scale, 10);
      expect(tip[1]).toBeCloseTo((mouth.anchor.y + mouth.axis.y * length) * scale, 10);
    }
  });

  it("keeps full-frame jet coordinates aligned when the manifest sprite pivot changes", () => {
    const assets = manifest.assets.map((asset) =>
      asset.id === "ship-26" ? { ...asset, pivot: { x: 0.2, y: 0.8 } } : asset,
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
        heading === 26
          ? mouths.map((mouth, index) => (index === 0 ? { ...mouth, occluders } : mouth))
          : mouths,
      ),
    };
    const assets = manifest.assets.map((asset) =>
      asset.id === "ship-26" ? { ...asset, pivot: { x: 0.2, y: 0.8 } } : asset,
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

  it("places the ship, wordmark, actions and note from the game area's left edge", () => {
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
      `top:${units(actions.top)}`,
    );
    // The note (only the forced update's message) is one body line centred on the game area.
    const noteRule = rule(`.${START_SCREEN_CLASS} .ada-start-note`);
    expect(noteRule).toContain(`left:${fromAreaLeft(note.centre)}`);
    expect(noteRule).toContain(`top:${units(note.top)}`);
    expect(noteRule).toContain("transform:translateX(-50%)");
  });
});
