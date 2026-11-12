import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { readShipJets } from "../game/ship-jets.ts";
import { fromAreaLeft, units } from "./layout/css.ts";
import { START_SCREEN } from "./layout/startScreen.ts";
import { START_SCREEN_CLASS, START_SCREEN_STYLE } from "./start-screen.ts";
import { jetPolygons, readTitleScreen, type TitleAsset, titleShip } from "./title-screen.ts";

const publicJson = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
const manifest = publicJson("/art/manifest.json") as { assets: TitleAsset[]; titleScreen: string };
const data = publicJson(manifest.titleScreen) as Record<string, unknown>;
const jets = readShipJets(publicJson("/art/ship-jets.json"));
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

  it("holds the speed jets at f 0.8 behind the frame, at the frame's 280 / 96 scale", () => {
    expect(art.jets.length).toBeGreaterThan(0);
    // The halo layer at f 0.8: (0.8 - 0.6) / 0.4 of its 0.5 alpha.
    expect(Math.min(...art.jets.map(({ alpha }) => alpha))).toBeCloseTo(0.25, 9);
    // Art's ink extent: the jets reach play-view x 226.3, 11.7 left of the 238 frame edge.
    const xs = jetPolygons(art).flatMap(({ points }) =>
      points.split(" ").map((point) => Number(point.split(",")[0])),
    );
    expect(Math.min(...xs)).toBeCloseTo(226.3 - 238, 0);
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

  it("places the ship, wordmark and actions from the game area's left edge, with no note", () => {
    const { actions, ship, wordmark } = START_SCREEN;
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
    expect(START_SCREEN_STYLE).not.toContain("ada-start-note");
  });
});
