import { describe, expect, it } from "vitest";

import { edgePoint, gameAreaPoint } from "../model/edgeMarkers.ts";
import type { PennyMarker } from "../model/pennyMarkers.ts";
import { MAP_GLYPHS } from "./layout/mapScreen.ts";
import {
  createPennyMarkerLayer,
  PENNY_MARKER_INSET,
  PENNY_MARKERS_STYLE,
  pennyGlyph,
} from "./pennyMarkers.ts";

const marker: PennyMarker = {
  id: "a",
  identified: false,
  known: false,
  symbol: "wreck",
  x: 1450,
  y: 0,
};

describe("Penny's existing marker art", () => {
  it("keeps an unknown target anonymous, then uses the canonical matching map or item asset", () => {
    expect(pennyGlyph(marker)).toBeNull();
    expect(pennyGlyph({ ...marker, identified: true })).toBe(
      `/art/ui/icons/${MAP_GLYPHS.wreck}.svg`,
    );
    expect(pennyGlyph({ ...marker, identified: true, symbol: "station" })).toBe(
      "/art/ui/icons/map-station.svg",
    );
    expect(pennyGlyph({ ...marker, identified: true, jobType: "hunt" })).toBe(
      "/art/ui/icons/map-job-hunt.svg",
    );
    expect(pennyGlyph({ ...marker, identified: true, item: "stardust" })).toBe(
      "/art/ui/sprites/icon-stardust-20.png",
    );
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
      light: true,
    },
    [{ ...marker, identified: true, item: "stardust" }],
  );
  expect(layer.children).toHaveLength(1);
  expect(layer.children[0]).toBe(chip);
  expect(chip.dataset).toMatchObject({
    identified: "true",
    item: "stardust",
    light: "true",
    target: "a",
  });
  expect(chip.properties.get("--glyph")).toContain("icon-stardust-20.png");
  expect(chip.lastElementChild!.children[0]!.children).toHaveLength(2);
  ui.place({ x: 0, y: 0 }, area, undefined, []);
  expect(layer.children).toEqual([]);
  ui.destroy();
  expect(root.children).toEqual([]);
});
