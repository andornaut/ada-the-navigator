import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { JET_LENGTH, plumeReach } from "../../art/tools/ship-jet-layers.ts";
import { FRAME, mouthEdgeJetMouths } from "../../art/tools/ship-model.ts";
import { plumePolygon } from "../../art/tools/ship-plume.ts";
import { engineJets, jetLength, layerColor, readEngineJets, readJetMouths } from "../art/index.ts";
import { fromAreaLeft, fromAreaTop, units } from "./layout/css.ts";
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
type Fields = Record<string, unknown>;
const ship = data.ship as Fields & { jetMouths: Fields[] };
// The title's own mouths and its jets' length at f 0.8: the flight curve times jetLengthScale.
const mouths = readJetMouths(ship.jetMouths)!;
const titleLength = jetLength(jets, 0.8) * 1.3;
/** title-screen.json with its ship's jetMouths changed by `change`. */
const withMouths = (change: (mouth: Fields, index: number) => Fields) => ({
  ...data,
  ship: { ...ship, jetMouths: ship.jetMouths.map(change) },
});
const coordinates = (points: string) => points.split(/[ ,]/u).map(Number);

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

  it("holds frame 52 at f 0.8 with front teardrop plumes on the title's own mouths", () => {
    expect(data.ship).toMatchObject({
      animated: false,
      frame: 52,
      jetLengthScale: 1.3,
      jetSpeed: 0.8,
    });
    expect(art.frontJets).toBe(true);
    expect(art.jets.every(({ alpha }) => alpha === 1)).toBe(true);
    const scale = START_SCREEN.ship.size / jets.frame;
    const polygons = jetPolygons(art);
    // The 280 px ship is past the halo's maxDisplay: only the outer flame and core draw.
    const shown = jets.layers.filter(({ underHull }) => !underHull);
    expect(shown.map(({ name }) => name)).toEqual(["outer", "core"]);
    expect(polygons).toHaveLength(mouths.length * shown.length);
    polygons.forEach((polygon, index) => {
      const mouth = mouths[Math.floor(index / shown.length)]!;
      const layer = shown[index % shown.length]!;
      expect(polygon.fill).toBe(`#${layerColor(layer, 0.8).toString(16).padStart(6, "0")}`);
      const expected = plumePolygon(
        jets.profile!,
        {
          anchor: [mouth.anchor.x, mouth.anchor.y],
          axis: [mouth.axis.x, mouth.axis.y],
          half: [mouth.half.x, mouth.half.y],
        },
        layer,
        titleLength,
      ).flatMap(([x, y]) => [x * scale, y * scale]);
      const actual = polygon.points.split(/[ ,]/u).map(Number);
      expect(actual).toHaveLength(expected.length);
      actual.forEach((value, at) => expect(value).toBeCloseTo(expected[at]!, 10));
    });
  });

  it("starts each plume on its lit mouth's bottom edge at the flight angle", () => {
    const reach = plumeReach((JET_LENGTH.base + JET_LENGTH.scale) * 1.3);
    const produced = mouthEdgeJetMouths(FRAME / 2, { yaw: 52 }, reach);
    expect(mouths).toEqual(readJetMouths(produced));
    // The flight file's axis at frame 52: straight back, as in flight.
    for (const [index, mouth] of mouths.entries()) {
      expect(mouth.axis).toEqual(jets.headings[52]![index]!.axis);
    }
    // Each plume's root samples lie on its start line, anchor + s * half, in display px.
    const scale = START_SCREEN.ship.size / jets.frame;
    jetPolygons(art).forEach((polygon, index) => {
      const mouth = mouths[Math.floor(index / 2)]!;
      const points = coordinates(polygon.points);
      const anchor = { x: mouth.anchor.x * scale, y: mouth.anchor.y * scale };
      const ends = [points.slice(0, 2), points.slice(-2)];
      for (const [x, y] of ends) {
        const cross = (x! - anchor.x) * mouth.half.y - (y! - anchor.y) * mouth.half.x;
        expect(cross / Math.hypot(mouth.half.x, mouth.half.y)).toBeCloseTo(0, 9);
      }
    });
  });

  it("scales the flight length curve by jetLengthScale on the start screen only", () => {
    const tip = (title: ReturnType<typeof readTitleScreen>) => {
      const [outer] = jetPolygons(title!);
      const points = coordinates(outer!.points);
      // The outline's middle sample is the outer layer's tip.
      const middle = (points.length / 2) & ~1;
      return { x: points[middle]!, y: points[middle + 1]! };
    };
    const reach = (scale: number) => {
      const title = readTitleScreen(manifest.assets, jets, {
        ...data,
        ship: { ...ship, jetLengthScale: scale },
      });
      const root = mouths[0]!.anchor;
      const at = tip(title);
      const px = START_SCREEN.ship.size / jets.frame;
      return Math.hypot(at.x / px - root.x, at.y / px - root.y);
    };
    const axis = Math.hypot(mouths[0]!.axis.x, mouths[0]!.axis.y);
    expect(reach(1.3)).toBeCloseTo(titleLength * axis, 9);
    expect(reach(1.3) / reach(1)).toBeCloseTo(1.3, 9);
    // Flight keeps its own curve: the title scales a copy.
    expect(jets.length).toEqual(readEngineJets(publicJson("/art/ship-jets.json"))!.length);
  });

  it.each([
    ["no jetLengthScale", { jetLengthScale: undefined }],
    ["a zero jetLengthScale", { jetLengthScale: 0 }],
    ["a non-numeric jetLengthScale", { jetLengthScale: "1.3" }],
    ["no jetMouths", { jetMouths: undefined }],
    ["empty jetMouths", { jetMouths: [] }],
    ["a malformed mouth", { jetMouths: [{ anchor: [1], axis: [0, 1], half: [1, 0] }] }],
  ])("reads no art from %s", (_, change) => {
    const changed = { ...data, ship: { ...ship, ...change } };
    expect(readTitleScreen(manifest.assets, jets, changed)).toBeNull();
  });

  it("draws no halo on the start screen ship and marks an under-hull layer it does draw", () => {
    expect(START_SCREEN.ship.size).toBeGreaterThan(jets.layers[0]!.maxDisplay!);
    expect(jetPolygons(art).some(({ underHull }) => underHull)).toBe(false);
    const ungated = {
      ...jets,
      layers: jets.layers.map((layer) => ({ ...layer, maxDisplay: Infinity })),
    };
    const polygons = jetPolygons(readTitleScreen(manifest.assets, ungated, data)!);
    expect(polygons.map(({ underHull }) => underHull === true)).toEqual([
      ...[true, false, false],
      ...[true, false, false],
    ]);
  });

  it("translates every plume with its mouth root", () => {
    const moved = withMouths((mouth) => {
      const [x, y] = mouth.anchor as [number, number];
      return { ...mouth, anchor: [x + 17, y - 9] };
    });
    const original = jetPolygons(art);
    const shifted = jetPolygons(readTitleScreen(manifest.assets, jets, moved)!);
    const scale = START_SCREEN.ship.size / jets.frame;
    shifted.forEach((polygon, index) => {
      const points = polygon.points.split(/[ ,]/u).map(Number);
      const before = original[index]!.points.split(/[ ,]/u).map(Number);
      points.forEach((point, coordinate) =>
        expect(point - before[coordinate]!).toBeCloseTo(
          (coordinate % 2 === 0 ? 17 : -9) * scale,
          10,
        ),
      );
    });
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
    const authored = occluders.map((polygon) => polygon.map(({ x, y }) => [x, y]));
    const masked = withMouths((mouth, index) =>
      index === 0 ? { ...mouth, occluders: authored } : mouth,
    );
    const assets = manifest.assets.map((asset) =>
      asset.id === "ship-52" ? { ...asset, pivot: { x: 0.2, y: 0.8 } } : asset,
    );
    const title = readTitleScreen(assets, jets, masked)!;
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
    const row = rule(`.${START_SCREEN_CLASS} .ada-start-actions`);
    expect(row).toContain(`left:${fromAreaLeft(note.centre)}`);
    expect(row).toContain(`top:${fromAreaTop(actions.top)}`);
    expect(row).toContain("transform:translateX(-50%)");
    expect(row).toContain("display:flex");
    const button = rule(`.${START_SCREEN_CLASS} .ada-start-actions > button`);
    expect(button).toContain("width:max-content");
    expect(button).toContain(`max-width:${units(actions.width)}`);
    // The note (only the forced update's message) is one body line centred on the game area.
    const noteRule = rule(`.${START_SCREEN_CLASS} .ada-start-note`);
    expect(noteRule).toContain(`left:${fromAreaLeft(note.centre)}`);
    expect(noteRule).toContain(`top:${fromAreaTop(note.top)}`);
    expect(noteRule).toContain("transform:translateX(-50%)");
  });
});
