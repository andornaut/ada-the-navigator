import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { edgePoint, gameAreaPoint } from "../model/edgeMarkers.ts";
import type { PennyMarker } from "../model/pennyMarkers.ts";
import { MAP_FACES } from "./layout/mapScreen.ts";
import { PENNY_MARKER } from "./layout/pennyMarkers.ts";
import {
  createPennyMarkerLayer,
  PENNY_MARKER_INSET,
  PENNY_MARKERS_STYLE,
  pennyGlyph,
} from "./pennyMarkers.ts";

const marker: PennyMarker = {
  category: "discovery",
  id: "a",
  identified: false,
  known: false,
  symbol: "wreck",
  x: 1450,
  y: 0,
};

describe("Penny's existing marker art", () => {
  it("uses canonical real target glyphs while keeping unknown targets anonymous", () => {
    expect(pennyGlyph(marker)).toBeNull();
    for (const [symbol, glyph] of [
      ["station", "map-station"],
      ["destination", "map-destination"],
      ["wreck", "map-wreck"],
      ["nebula", "map-nebula"],
      ["growers", "map-growers"],
    ] as const) {
      expect(pennyGlyph({ ...marker, identified: true, symbol })).toBe(
        `/art/ui/icons/${glyph}.svg`,
      );
      expect(pennyGlyph({ ...marker, identified: false, symbol })).toBeNull();
      expect(existsSync(new URL(`../../public/art/ui/icons/${glyph}.svg`, import.meta.url))).toBe(
        true,
      );
    }
    expect(
      pennyGlyph({ ...marker, category: "objective", identified: true, jobType: "hunt" }),
    ).toBe("/art/ui/icons/map-job-hunt.svg");
    expect(
      pennyGlyph({ ...marker, category: "discovery", identified: true, item: "stardust" }),
    ).toBe("/art/ui/sprites/icon-stardust-20.png");
    expect(PENNY_MARKERS_STYLE).toContain("/art/ui/fonts/font-body.png");
  });

  it("keeps the complete chip inside asymmetric safe bounds in every direction", () => {
    const area = { height: 300, width: 640, x: 35, y: 22 },
      player = { x: 0, y: 0 };
    for (const x of [-1500, 0, 1500]) {
      for (const y of [-1500, 0, 1500]) {
        if (!x && !y) {
          continue;
        }
        const at = edgePoint(
          area,
          PENNY_MARKER_INSET,
          gameAreaPoint(player, player),
          gameAreaPoint(player, { x, y }),
        );
        expect(at.x - PENNY_MARKER_INSET).toBeGreaterThanOrEqual(area.x);
        expect(at.y - PENNY_MARKER_INSET).toBeGreaterThanOrEqual(area.y);
        expect(at.x + PENNY_MARKER_INSET).toBeLessThanOrEqual(area.x + area.width);
        expect(at.y + PENNY_MARKER_INSET).toBeLessThanOrEqual(area.y + area.height);
      }
    }
  });
});

class ElementFixture {
  children: ElementFixture[] = [];
  className = "";
  dataset: Record<string, string> = {};
  parent: ElementFixture | null = null;
  style = {
    background: "",
    left: "",
    removeProperty: (key: string) => this.properties.delete(key),
    setProperty: (key: string, value: string) => this.properties.set(key, value),
    top: "",
    transform: "",
  };
  properties = new Map<string, string>();
  attributes = new Map<string, string>();
  get lastElementChild() {
    return this.children.at(-1);
  }
  append(...children: ElementFixture[]) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((entry) => entry !== this);
    }
  }
}

it("reuses one DOM target through identification, clears obsolete nodes and releases the overlay", () => {
  const root = new ElementFixture();
  const doc = {
    createElement: () => new ElementFixture(),
    createElementNS: () => new ElementFixture(),
  } as unknown as Document;
  const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
  const area = { height: 360, width: 720, x: 0, y: 0 };
  ui.place({ x: 0, y: 0 }, area, undefined, [marker]);
  const layer = root.children[0]!,
    chip = layer.children[0]!;
  expect(layer.attributes.get("aria-hidden")).toBe("true");
  expect(chip.dataset).toMatchObject({ identified: "false", target: "a" });
  expect(chip.properties.has("--glyph")).toBe(false);
  ui.place(
    { x: 0, y: 0 },
    area,
    {
      color: "#65c9bf",
      edge: "#102030",
      light: true,
    },
    [{ ...marker, identified: true, item: "stardust" }],
  );
  expect(layer.children).toHaveLength(1);
  expect(layer.children[0]).toBe(chip);
  expect(chip.dataset).toMatchObject({
    identified: "true",
    light: "true",
    target: "a",
  });
  expect(chip.properties.get("--glyph")).toContain("icon-stardust-20.png");
  expect(chip.style.background).toBe(MAP_FACES.beacon);
  for (const [category, symbol, face] of [
    ["station", "station", MAP_FACES.station],
    ["objective", "destination", MAP_FACES.destination],
  ] as const) {
    ui.place({ x: 0, y: 0 }, area, undefined, [{ ...marker, category, identified: true, symbol }]);
    expect(chip.style.background).toBe(face);
  }
  expect(PENNY_MARKER.size).toBe(24);
  expect(PENNY_MARKERS_STYLE).toContain("border-radius:50%");
  expect(PENNY_MARKERS_STYLE).not.toContain("ada-penny-direction");
  expect(chip.children).toHaveLength(1);
  expect(chip.children[0]!.className).toBe("ada-penny-glyph");
  expect(chip.children[0]!.children).toHaveLength(0);
  ui.place({ x: 0, y: 0 }, area, undefined, []);
  expect(layer.children).toEqual([]);
  ui.destroy();
  expect(root.children).toEqual([]);
});

it.each([
  { height: 360, width: 720 },
  { height: 320, width: 667 },
])(
  "places distinct live target IDs through the shared layout around actual blocked rectangles: %j",
  (size) => {
    const root = new ElementFixture();
    const doc = {
      createElement: () => new ElementFixture(),
      createElementNS: () => new ElementFixture(),
    } as unknown as Document;
    const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
    const area = { ...size, x: 0, y: 0 };
    const style = {
      blocked: [{ height: 110, width: size.width, x: 0, y: 250 }],
      color: "#65c9bf",
      light: false,
    };
    const second = { ...marker, id: "b" };
    ui.place({ x: 0, y: 0 }, area, style, [marker, second]);
    const layer = root.children[0]!;
    const [a, b] = layer.children;
    expect(layer.children.map((node) => node.dataset.target)).toEqual(["a", "b"]);
    expect(new Set(layer.children.map((node) => `${node.style.left}:${node.style.top}`)).size).toBe(
      2,
    );
    for (const node of layer.children) {
      expect(node.dataset.crowded).toBe("false");
      expect(Number(node.dataset.anchorY)).toBeGreaterThan(250);
      const y = Number(node.style.top.match(/-?\d+(?:\.\d+)?/u)?.[0]);
      expect(y + PENNY_MARKER.size / 2).toBeLessThanOrEqual(250);
    }
    ui.place({ x: 0, y: 0 }, area, style, [{ ...second, identified: true }, marker]);
    expect(layer.children[0]).toBe(a);
    expect(layer.children[1]).toBe(b);
    expect(b!.dataset.identified).toBe("true");
    ui.place({ x: 0, y: 0 }, area, style, [second]);
    expect(layer.children).toEqual([b]);
    ui.destroy();
  },
);
