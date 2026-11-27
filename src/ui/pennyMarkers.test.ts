import { existsSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  galaxyPalettes,
  readGalaxyFields,
  readSpacePalette,
  spaceColorCss,
} from "../art/spacePalette.ts";
import { EDGE_MARKERS } from "../data/edgeMarkers.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { TASK_COLORS, type TaskCategory } from "../data/taskCategories.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import { foregroundEdge, LIGHT_FIELD, lightGalaxy, readLightGalaxies } from "../game/lightField.ts";
import type { PennyMarker } from "../model/pennyMarkers.ts";
import { ART_MANIFEST, publicJson } from "../testing/publicArt.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  resolveAdaHoldAction,
} from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { units } from "./layout/css.ts";
import { PENNY_MARKER } from "./layout/pennyMarkers.ts";
import { safeGameArea } from "./layout/playView.ts";
import { layoutTargetMarkers } from "./layout/targetMarkers.ts";
import { playLayout } from "./layout/viewScale.ts";
import { MAP_COLORS, MAP_SYMBOL } from "./map/layout/mapScreen.ts";
import {
  createPennyMarkerLayer,
  PENNY_MARKERS_STYLE,
  pennyGlyph,
  pennyMarkerInkExtent,
} from "./pennyMarkers.ts";
let viewUnit = 1;
/** The symbol whose fixture glyph is 24 and so protrudes from its 24 badge's 1 border. */
let protruding: string | undefined;
beforeEach(() => {
  viewUnit = 1;
  protruding = undefined;
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (key: string) => (key === "--ada-unit" ? String(viewUnit) : "0px"),
  }));
});
afterEach(() => vi.unstubAllGlobals());
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
  it("draws a hostile station as the heavy's threat disc, with no badge icon", () => {
    expect(pennyGlyph({ ...marker, identified: true, symbol: "hostileStation" })).toBeNull();
    expect(pennyGlyph({ ...marker, identified: false, symbol: "hostileStation" })).toBeNull();
    expect(PENNY_MARKERS_STYLE).toContain('data-symbol="hostileStation"');
    expect(PENNY_MARKERS_STYLE).not.toContain("map-hostile-station");
    for (const light of [false, true]) {
      expect(
        pennyMarkerInkExtent({ ...marker, identified: true, symbol: "hostileStation" }, light),
      ).toEqual(pennyMarkerInkExtent({ ...marker, identified: true, symbol: "heavy" }, light));
    }
  });
  it("uses canonical real target glyphs while keeping unknown targets anonymous", () => {
    expect(pennyGlyph(marker)).toBeNull();
    for (const [symbol, glyph] of [
      ["station", "map-station"],
      ["destination", "map-destination"],
      ["wreck", "map-wreck"],
      ["nebula", "map-nebula"],
      ["growers", "map-growers"],
    ] as const) {
      expect(pennyGlyph({ ...marker, identified: true, symbol })).toBe(uiIconUrl(glyph));
      expect(pennyGlyph({ ...marker, identified: false, symbol })).toBeNull();
      expect(existsSync(new URL(`../../public${uiIconUrl(glyph)}`, import.meta.url))).toBe(true);
    }
    const job: PennyMarker = { ...marker, category: "objective", symbol: "job" };
    expect(pennyGlyph({ ...job, identified: true })).toBe(uiIconUrl("map-job"));
    expect(pennyGlyph(job)).toBeNull();
    expect(pennyGlyph({ ...job, identified: true, jobType: "hunt" })).toBe(
      uiIconUrl("map-job-hunt"),
    );
    expect(pennyGlyph({ ...job, jobType: "hunt" })).toBeNull();
    expect(
      pennyGlyph({ ...marker, category: "discovery", identified: true, item: "stardust" }),
    ).toBe(uiIconUrl("icon-stardust-20"));
    expect(PENNY_MARKERS_STYLE).toContain("/art/ui/fonts/font-body.png");
  });
  it("retains the opaque paint baseline; protruding native glyph alpha is handled by the caller", () => {
    for (const symbol of ["wreck", "station", "destination"] as const) {
      for (const identified of [false, true]) {
        expect(pennyMarkerInkExtent({ ...marker, identified, symbol }, true)).toEqual({
          height: 24,
          width: 24,
        });
      }
    }
    expect(pennyMarkerInkExtent({ ...marker, identified: true, item: "stardust" }, true)).toEqual({
      height: 24,
      width: 24,
    });
    for (const light of [false, true]) {
      const outline = light ? 2 * LIGHT_FIELD.markerOutline : 0;
      expect(pennyMarkerInkExtent({ ...marker, identified: true, symbol: "enemy" }, light)).toEqual(
        { height: 6 + outline, width: 6 + outline },
      );
      for (const symbol of ["guard", "heavy", "hostileStation"] as const) {
        expect(pennyMarkerInkExtent({ ...marker, identified: true, symbol }, light)).toEqual({
          height: 12 + outline,
          width: 12 + outline,
        });
      }
    }
    expect(PENNY_MARKER.question.width).toBeLessThan(PENNY_MARKER.size);
    expect(PENNY_MARKER.question.height).toBeLessThan(PENNY_MARKER.size);
  });
  it.each([
    { height: 360, width: 720 },
    { height: 320, width: 667 },
    { height: 575, width: 1280 },
  ])("uses the centered720 game area at the current view scale: %j", (css) => {
    const layout = playLayout(css),
      area = safeGameArea(layout.insets, layout.view);
    expect(area).toEqual({ height: 360, width: 720, x: 0, y: 0 });
    const ink = pennyMarkerInkExtent(marker, false);
    const [placement] = layoutTargetMarkers(
      { area, blocked: [], extent: () => ink, gap: 4, player: { x: 0, y: 0 } },
      [{ ...marker, x: 4000, y: -4000 }],
    );
    expect((area.width - placement!.at.x - ink.width / 2) * layout.s).toBeCloseTo(
      EDGE_MARKERS.gap * layout.s,
      9,
    );
  });
});
class ElementFixture extends EventTarget {
  readonly ownerDocument: Document | undefined;
  constructor(ownerDocument?: Document) {
    super();
    this.ownerDocument = ownerDocument;
  }
  connected = false;
  disabled = false;
  hidden = false;
  get isConnected(): boolean {
    return this.connected || this.parent?.isConnected === true;
  }
  get parentElement() {
    return this.parent;
  }
  matches(selector: string): boolean {
    return selector === ":disabled"
      ? this.disabled
      : selector.includes("button") && this.attributes.get("type") === "button";
  }
  closest(selector: string): ElementFixture | null {
    return selector.includes("[hidden]") && this.hidden
      ? this
      : (this.parent?.closest(selector) ?? null);
  }
  contains(node: ElementFixture): boolean {
    return node === this || (node.parent !== null && this.contains(node.parent));
  }
  querySelectorAll() {
    return [];
  }
  complete = true;
  naturalWidth = 24;
  naturalHeight = 24;
  onload: (() => void) | null = null;
  src = "";
  width = 24;
  height = 24;
  get firstElementChild() {
    return this.children[0];
  }
  getBoundingClientRect(): DOMRect {
    const number = (value: string) => Number(value.match(/-?\d+(?:\.\d+)?/u)?.[0] ?? 0);
    let x = number(this.style.left),
      y = number(this.style.top),
      width = 24 * viewUnit,
      height = width;
    if (this.className === "ada-penny-marker" && this.dataset.identified === "true") {
      if (this.dataset.symbol === "enemy") {
        width = height = 6 * viewUnit;
      }
      if (["heavy", "guard", "hostileStation"].includes(this.dataset.symbol!)) {
        width = height = 12 * viewUnit;
      }
    }
    if (this.className === "ada-penny-markers") {
      width = 720 * viewUnit;
      height = 360 * viewUnit;
    }
    if (this.className === "ada-penny-glyph" && this.parent) {
      const body = this.parent.getBoundingClientRect();
      width = (this.parent.dataset.symbol === protruding ? 24 : 20) * viewUnit;
      height = width;
      const border =
        this.parent.dataset.identified === "true" &&
        ["enemy", "guard", "heavy", "hostileStation"].includes(this.parent.dataset.symbol!)
          ? 0
          : Math.max(1, Math.floor(viewUnit));
      x = body.x + border + Math.max(0, (body.width - 2 * border - width) / 2);
      y = body.y + border + Math.max(0, (body.height - 2 * border - height) / 2);
    }
    return {
      bottom: y + height,
      height,
      left: x,
      right: x + width,
      top: y,
      width,
      x,
      y,
    } as DOMRect;
  }
  getContext() {
    return {
      drawImage: () => {},
      getImageData: () => {
        const data = new Uint8ClampedArray(this.width * this.height * 4);
        for (let y = 4; y < Math.min(20, this.height); y++) {
          for (let x = 0; x < this.width; x++) {
            data[(y * this.width + x) * 4 + 3] = 255;
          }
        }
        return { data };
      },
    };
  }
  pulses = 0;
  cancelledPulses = 0;
  textContent = "";
  animate() {
    this.pulses++;
    return { cancel: () => this.cancelledPulses++ };
  }
  children: ElementFixture[] = [];
  className = "";
  readonly classList = { add() {}, remove() {} };
  dataset: Record<string, string> = {};
  parent: ElementFixture | null = null;
  style = {
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
  replaceChildren(...children: ElementFixture[]) {
    for (const child of [...this.children]) {
      child.remove();
    }
    this.append(...children);
  }
  getAttribute(key: string) {
    return this.attributes.get(key) ?? null;
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
  removeAttribute(key: string) {
    this.attributes.delete(key);
  }
  toggleAttribute(key: string, force: boolean) {
    if (force) {
      this.setAttribute(key, "");
    } else {
      this.removeAttribute(key);
    }
  }
  set type(value: string) {
    this.setAttribute("type", value);
  }
  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((entry) => entry !== this);
      this.parent = null;
    }
  }
}
function interactiveMarkerLayer(
  actions: NonNullable<Parameters<typeof createPennyMarkerLayer>[2]>,
) {
  const doc: Document = {
    createElement: () => new ElementFixture(doc),
    createElementNS: () => new ElementFixture(doc),
    defaultView: { HTMLElement: ElementFixture, Node: ElementFixture },
  } as unknown as Document;
  const root = fixtureActionRoot(new ElementFixture(doc));
  root.connected = true;
  const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement, actions);
  return { layer: root.children[0]!, root, ui };
}

it("binds a marker before publication and rolls back a failed append", () => {
  const { layer, ui } = interactiveMarkerLayer({ available: () => true, open() {} });
  const append = layer.append.bind(layer);
  let original: HTMLElement | undefined;
  const failure = vi.spyOn(layer, "append").mockImplementationOnce((node) => {
    original = node as unknown as HTMLElement;
    assertAdaActionMetadata(original);
    append(node);
    throw new Error("Marker append failed");
  });
  const player = { x: 0, y: 0 };
  const area = { height: 360, width: 720, x: 0, y: 0 };
  const shown = vi.fn();
  const style = { color: "white", light: false, markerShown: shown };
  expect(() => ui.place(player, area, style, [marker])).toThrow("Marker append failed");
  expect(shown).not.toHaveBeenCalled();
  expect(layer.children).toEqual([]);
  expect(() => assertAdaActionMetadata(original!)).toThrow("no registered action binding");
  failure.mockRestore();
  ui.place(player, area, style, [marker]);
  expect(shown).toHaveBeenCalledExactlyOnceWith(marker);
  expect(layer.children).toHaveLength(1);
  assertAdaActionBindings(layer.children[0] as unknown as HTMLElement);
  ui.destroy();
});

it("activates the latest marker once and gates hidden, unavailable, and removed entries", () => {
  const open = vi.fn();
  let available = true;
  const { layer, root, ui } = interactiveMarkerLayer({ available: () => available, open });
  const place = (markers: readonly PennyMarker[]) =>
    ui.place({ x: 0, y: 0 }, { height: 360, width: 720, x: 0, y: 0 }, undefined, markers);
  place([marker]);
  const button = layer.children[0]!;
  expect(button.children.map(({ className }) => className)).toEqual(["ada-penny-glyph"]);
  const held = resolveAdaHoldAction(root as unknown as HTMLElement, button);
  expect(held?.rule.holdMs).toBe(500);

  const latest = { ...marker, identified: true };
  place([latest]);
  expect(layer.children).toEqual([button]);
  button.dispatchEvent(new Event("click"));
  expect(open).toHaveBeenCalledExactlyOnceWith(latest, button);
  held?.activate();
  expect(open.mock.calls).toEqual([
    [latest, button],
    [latest, button],
  ]);

  available = false;
  button.dispatchEvent(new Event("click"));
  held?.activate();
  available = true;
  button.hidden = true;
  button.dispatchEvent(new Event("click"));
  held?.activate();
  expect(button.hidden).toBe(true);
  expect(open).toHaveBeenCalledTimes(2);

  button.hidden = false;
  place([]);
  place([marker]);
  expect(layer.children[0]).not.toBe(button);
  expect(held?.available()).toBe(false);
  held?.activate();
  button.dispatchEvent(new Event("click"));
  expect(open).toHaveBeenCalledTimes(2);
  ui.destroy();
});

it("keeps the same marker node while identifying it and clearing its identity again", () => {
  const root = new ElementFixture();
  const doc = {
    createElement: () => new ElementFixture(),
    createElementNS: () => new ElementFixture(),
  } as unknown as Document;
  const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
  const area = { height: 360, width: 720, x: 0, y: 0 };
  const target: PennyMarker = { ...marker, id: "workshop", symbol: "destination" };
  ui.place({ x: 0, y: 0 }, area, undefined, [target]);
  const layer = root.children[0]!,
    chip = layer.children[0]!;
  const expectUnknown = () => {
    expect(layer.attributes.get("aria-hidden")).toBe("true");
    expect(layer.children).toEqual([chip]);
    expect(chip.dataset.identified).toBe("false");
    expect(chip.dataset).not.toHaveProperty("target");
    expect(chip.dataset).not.toHaveProperty("symbol");
    expect(chip.properties.has("--glyph")).toBe(false);
    expect(chip.attributes.size).toBe(0);
    expect(chip.firstElementChild?.attributes.size).toBe(0);
  };
  expectUnknown();
  expect(chip.properties.get("--marker-face")).toBe("#ead4aa");
  ui.place({ x: 0, y: 0 }, area, undefined, [{ ...target, taskCategory: "story" }]);
  expectUnknown();
  expect(chip.properties.get("--marker-face")).toBe("#65c9bf");
  ui.place({ x: 0, y: 0 }, area, { color: "#65c9bf", light: true }, [
    { ...target, identified: true, item: "stardust" },
  ]);
  expect(layer.children).toHaveLength(1);
  expect(layer.children[0]).toBe(chip);
  expect(chip.dataset).toMatchObject({
    identified: "true",
    light: "true",
    symbol: "destination",
    target: "workshop",
  });
  expect(chip.properties.get("--glyph")).toContain(uiIconUrl("icon-stardust-20"));
  expect(chip.properties.get("--marker-face")).toBe(TASK_COLORS.generic);
  for (const [category, symbol] of [
    ["station", "station"],
    ["objective", "destination"],
  ] as const) {
    ui.place({ x: 0, y: 0 }, area, undefined, [{ ...target, category, identified: true, symbol }]);
    expect(chip.properties.get("--marker-face")).toBe(TASK_COLORS.generic);
  }
  expect(PENNY_MARKER.size).toBe(24);
  expect(PENNY_MARKERS_STYLE).toContain("border-radius:50%");
  expect(PENNY_MARKERS_STYLE).not.toContain("ada-penny-direction");
  expect(chip.children).toHaveLength(1);
  expect(chip.children[0]!.className).toBe("ada-penny-glyph");
  expect(chip.children[0]!.children).toHaveLength(0);
  ui.place({ x: 0, y: 0 }, area, undefined, [target]);
  expectUnknown();
  ui.place({ x: 0, y: 0 }, area, undefined, []);
  expect(layer.children).toEqual([]);
  ui.destroy();
  expect(root.children).toEqual([]);
});
describe("enemy marker colour and outline in every galaxy", () => {
  const art = readSpacePalette(publicJson("/art/space-palette.json"))!;
  const galaxies = publicJson(ART_MANIFEST.galaxyFields);
  const palettes = galaxyPalettes(art, readGalaxyFields(galaxies));
  const light = readLightGalaxies(galaxies);
  // The style the scene passes: whether the field draws its foreground edge.
  const styles = GALAXY_NUMBERS.map((galaxy) => {
    const palette = palettes.get(galaxy)!;
    return {
      galaxy,
      style: {
        color: spaceColorCss(palette.pointOfInterest),
        light: foregroundEdge(galaxy) !== undefined,
        threat: spaceColorCss(palette.threat),
      },
    };
  });
  function layer() {
    const root = new ElementFixture();
    const doc = {
      createElement: () => new ElementFixture(),
      createElementNS: () => new ElementFixture(),
    } as unknown as Document;
    const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
    return { root, ui };
  }
  const area = { height: 360, width: 720, x: 0, y: 0 };
  const categories = [undefined, ...(Object.keys(TASK_COLORS) as TaskCategory[])];
  const threats = ["enemy", "heavy", "guard", "hostileStation"] as const;

  it("edges every galaxy in ink: the foreground edge, each enemy disc's ring and badge border", () => {
    expect(styles.map(({ galaxy }) => galaxy)).toEqual([...GALAXY_NUMBERS]);
    for (const { galaxy, style } of styles) {
      expect([galaxy, foregroundEdge(galaxy), style.light]).toEqual([
        galaxy,
        LIGHT_FIELD.ink,
        true,
      ]);
    }
    // Phantom keeps its dark field and still takes the ink edge.
    expect(lightGalaxy(light, 6)).toBe(false);
    expect(MAP_COLORS.ink.toLowerCase()).toBe(spaceColorCss(LIGHT_FIELD.ink));
    expect(LIGHT_FIELD.markerOutline).toBe(1);
    expect(MAP_SYMBOL.edge).toBe(1);
    expect(PENNY_MARKERS_STYLE).toContain(`border:${units(1)} solid ${MAP_COLORS.ink};`);
    for (const symbol of threats) {
      expect(PENNY_MARKERS_STYLE).toContain(
        `[data-symbol="${symbol}"][data-light="true"]{\nbox-shadow:0 0 0 ${units(1)} ${MAP_COLORS.ink}}`,
      );
    }
    expect(PENNY_MARKERS_STYLE).not.toContain("--marker-edge");
  });
  it.each(styles)(
    "draws a task-target enemy, heavy, guard and hostile station threat red in galaxy $galaxy",
    ({ style }) => {
      expect(style.threat).toBe("#ff6b6b");
      const { root, ui } = layer();
      for (const symbol of threats) {
        for (const taskCategory of categories) {
          const target: PennyMarker = {
            ...marker,
            identified: true,
            symbol,
            ...(taskCategory ? { taskCategory } : {}),
          };
          ui.place({ x: 0, y: 0 }, area, style, [target]);
          const node = root.children[0]!.children[0]!;
          expect(node.dataset.symbol).toBe(symbol);
          expect(node.properties.get("--marker-face")).toBe(style.threat);
        }
      }
      ui.destroy();
    },
  );
  it.each(styles)("rings every enemy disc in its ink outline in galaxy $galaxy", ({ style }) => {
    const { root, ui } = layer();
    for (const symbol of threats) {
      ui.place({ x: 0, y: 0 }, area, style, [{ ...marker, identified: true, symbol }]);
      const node = root.children[0]!.children[0]!;
      expect(node.dataset.light).toBe(String(style.light));
      // The outline adds its width on every side, as the light field's ink outline does.
      const disc = symbol === "enemy" ? 6 : 12;
      const ring = style.light ? 2 * LIGHT_FIELD.markerOutline : 0;
      expect(pennyMarkerInkExtent({ ...marker, identified: true, symbol }, style.light)).toEqual({
        height: disc + ring,
        width: disc + ring,
      });
    }
    ui.destroy();
  });
  it.each(styles)(
    "keeps an unidentified marker the generic colour unless a story or job targets it, galaxy $galaxy",
    ({ style }) => {
      const { root, ui } = layer();
      for (const symbol of [...threats, "station"] as const) {
        for (const [taskCategory, colour] of [
          [undefined, TASK_COLORS.generic],
          ["generic", TASK_COLORS.generic],
          ["story", TASK_COLORS.story],
          ["job", TASK_COLORS.job],
        ] as const) {
          ui.place({ x: 0, y: 0 }, area, style, [
            { ...marker, symbol, ...(taskCategory ? { taskCategory } : {}) },
          ]);
          const node = root.children[0]!.children[0]!;
          expect(node.dataset.identified).toBe("false");
          expect(node.dataset).not.toHaveProperty("symbol");
          expect(node.properties.get("--marker-face")).toBe(colour);
        }
      }
      ui.destroy();
    },
  );
});
it("renders two coincident IDs at their ray despite the blocking HUD and retains their native nodes", () => {
  const root = new ElementFixture();
  const doc = {
    createElement: () => new ElementFixture(),
    createElementNS: () => new ElementFixture(),
  } as unknown as Document;
  const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
  const area = { height: 360, width: 720, x: 0, y: 0 };
  const style = { blocked: [area], color: "#65c9bf", light: false };
  const first = { ...marker, id: "a", x: 1336, y: 1336 },
    second = { ...marker, id: "b", x: 2672, y: 2672 };
  ui.place({ x: 0, y: 0 }, area, style, [first, second]);
  const layer = root.children[0]!,
    [a, b] = layer.children;
  expect(layer.children).toHaveLength(2);
  expect(layer.children.map((n) => n.dataset.target)).toEqual([undefined, undefined]);
  for (const node of layer.children) {
    const bounds = node.getBoundingClientRect();
    expect(bounds.x + bounds.width / 2).toBe(360);
    expect(bounds.y + bounds.height / 2).toBe(347);
    expect(node.dataset.crowded).toBe("true");
  }
  ui.place({ x: 0, y: 0 }, area, style, [second, first]);
  expect(layer.children).toEqual([a, b]);
  expect(a!.style.left).toBe(b!.style.left);
  expect(a!.style.top).toBe(b!.style.top);
  ui.place({ x: 0, y: 0 }, area, style, [second]);
  expect(layer.children).toEqual([b]);
  ui.destroy();
});
it("keeps actual displayed centres on cardinal/diagonal rays across unit and DPR resize", () => {
  const root = new ElementFixture();
  const doc = {
    createElement: () => new ElementFixture(),
    createElementNS: () => new ElementFixture(),
  } as unknown as Document;
  const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
  const player = { x: 12000, y: -8000 },
    area = { height: 360, width: 720, x: 0, y: 0 };
  const directions = [
    { screen: { x: 1, y: 0 }, world: { x: 1, y: -1 } },
    { screen: { x: -1, y: 0 }, world: { x: -1, y: 1 } },
    { screen: { x: 0, y: 1 }, world: { x: 1, y: 1 } },
    { screen: { x: 0, y: -1 }, world: { x: -1, y: -1 } },
    { screen: { x: 1, y: 1 }, world: { x: 3, y: 1 } },
    { screen: { x: -1, y: -1 }, world: { x: -3, y: -1 } },
    { screen: { x: 1, y: -1 }, world: { x: -1, y: -3 } },
    { screen: { x: -1, y: 1 }, world: { x: 1, y: 3 } },
  ];
  for (const { dpr, unit } of [
    { dpr: 1, unit: 1 },
    { dpr: 2, unit: 0.5 },
    { dpr: 1, unit: 8 / 9 },
  ]) {
    viewUnit = unit;
    vi.stubGlobal("devicePixelRatio", dpr);
    for (const { screen, world } of directions) {
      const target = { ...marker, x: player.x + world.x * 1000, y: player.y + world.y * 1000 };
      ui.place(player, area, { blocked: [area], color: "#65c9bf", light: false }, [target]);
      const node = root.children[0]!.children[0]!,
        bounds = node.getBoundingClientRect();
      const x = (bounds.x + bounds.width / 2) / unit - 360,
        y = (bounds.y + bounds.height / 2) / unit - 180;
      expect(x * screen.y - y * screen.x).toBeCloseTo(0, 8);
      expect(x * screen.x + y * screen.y).toBeGreaterThan(0);
      expect(node.dataset).not.toHaveProperty("target");
      expect(node.dataset.crowded).toBe("true");
    }
  }
  ui.destroy();
});
it.each([false, true])(
  "places actual caller ink on the perimeter while one ID changes from ? to known and light=%s",
  (light) => {
    const root = new ElementFixture();
    const doc = {
      createElement: () => new ElementFixture(),
      createElementNS: () => new ElementFixture(),
    } as unknown as Document;
    const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
    const area = { height: 360, width: 720, x: 0, y: 0 };
    const style = { color: "#65c9bf", light };
    const target = { ...marker, x: 4000, y: -4000 };
    ui.place({ x: 0, y: 0 }, area, style, [target]);
    const node = root.children[0]!.children[0]!;
    const left = () => Number(node.style.left.match(/-?\d+(?:\.\d+)?/u)?.[0]);
    expect(left()).toBe(695);
    expect(node.dataset.identified).toBe("false");
    for (const symbol of ["enemy", "guard", "heavy", "hostileStation", "station"] as const) {
      const known = { ...target, identified: true, symbol };
      ui.place({ x: 0, y: 0 }, area, style, [known]);
      expect(root.children[0]!.children[0]).toBe(node);
      const body = symbol === "enemy" ? 6 : symbol === "station" ? 24 : 12;
      const outside = symbol !== "station" && light ? LIGHT_FIELD.markerOutline : 0;
      expect(area.width - left() - body - outside).toBe(EDGE_MARKERS.gap);
      expect(node.dataset.target).toBe(target.id);
      expect(node.dataset.identified).toBe("true");
    }
    ui.destroy();
  },
);
it("unions actual native SVG alpha outside the badge and removes pending image callbacks on disposal", () => {
  protruding = "station";
  const root = new ElementFixture(),
    images: ElementFixture[] = [];
  const doc = {
    createElement: (tag: string) => {
      const node = new ElementFixture();
      if (tag === "img") {
        images.push(node);
      }
      return node;
    },
    createElementNS: () => new ElementFixture(),
  } as unknown as Document;
  const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
  const target = {
    ...marker,
    identified: true,
    symbol: "station" as const,
    x: 4000,
    y: -4000,
  };
  for (const unit of [1, 0.5]) {
    viewUnit = unit;
    vi.stubGlobal("devicePixelRatio", 1 / unit);
    ui.place(
      { x: 0, y: 0 },
      { height: 360, width: 720, x: 0, y: 0 },
      { color: "#65c9bf", light: true },
      [target],
    );
    const node = root.children[0]!.children[0]!;
    const left = Number.parseFloat(node.style.left) / unit;
    const actualGlyphSupportRight = left + 24 + 1 / unit;
    // The support's edge moves inward to the device pixel grid only, so the gap stays 1 at
    // devicePixelRatio 2 too, where a whole CSS px snap would have taken 1 more.
    expect(720 - actualGlyphSupportRight).toBe(1);
    expect(node.dataset.target).toBe(target.id);
  }
  expect(images).toHaveLength(1);
  expect(images[0]!.onload).not.toBeNull();
  ui.destroy();
  expect(images[0]!.onload).toBeNull();
});

it("keeps one registry node across the tracked edge, world and label transitions", () => {
  const root = new ElementFixture();
  const doc = {
    createElement: () => new ElementFixture(),
    createElementNS: () => new ElementFixture(),
  } as unknown as Document;
  const ui = createPennyMarkerLayer(doc, root as unknown as HTMLElement);
  const area = { height: 360, width: 720, x: 0, y: 0 };
  const player = { x: 0, y: 0 };
  const target = {
    ...marker,
    identified: true,
    symbol: "station",
    trackedLabel: "Practice Channel",
    x: 1000,
    y: -1000,
  } as const;
  ui.place(player, area, undefined, [target]);
  const layer = root.children[0]!;
  const node = layer.children[0]!;
  expect(node.children.map(({ className }) => className)).toEqual(["ada-penny-glyph"]);
  expect(node.dataset.tracked).toBe("true");
  expect(node.properties.get("--glyph")).toContain(uiIconUrl("map-station"));
  const edge = node.style.left;
  expect(node.pulses).toBe(1);

  const onScreen = { ...target, onScreen: true, x: 10, y: 0 };
  ui.place(player, area, undefined, [onScreen]);
  expect(layer.children).toEqual([node]);
  expect(node.children).toEqual([node.firstElementChild]);
  expect(node.style.left).not.toBe(edge);
  expect(node.pulses).toBe(1);

  ui.place(player, area, undefined, [{ ...onScreen, trackedLabel: "Ring 2" }]);
  expect(node.children).toEqual([node.firstElementChild]);
  expect(node.pulses).toBe(2);
  ui.place(player, area, { color: "black", light: true, reducedMotion: true }, [
    { ...onScreen, trackedLabel: "Ring 3" },
  ]);
  expect(node.pulses).toBe(2);
  expect(node.cancelledPulses).toBe(2);

  ui.place(player, area, undefined, [{ ...onScreen, identified: false }]);
  expect(node.children).toEqual([node.firstElementChild]);
  expect(node.dataset).not.toHaveProperty("tracked");
  expect(node.dataset).not.toHaveProperty("target");
});
