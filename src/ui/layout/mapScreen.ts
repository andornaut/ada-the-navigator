import { clamp } from "@andornaut/game-kit/numbers";
import type { Rect } from "@andornaut/game-kit/rect";

import { CHARTING_RADIUS, type MapSymbol } from "../../model/map.ts";
import { SCROLL } from "./contentCard.ts";
import { TEXT_BUTTON } from "./controls.ts";
import { HUD_BUTTON, hudRect, type Insets, safeRect, type Size } from "./playView.ts";
import { SPACING } from "./tokens.ts";

// The pause menu's full-screen map (art/map.md): the screen's header, tools, fog and fit
// (MAP_SCREEN), the place panel (MAP_PANEL) and the place symbols (MAP_SYMBOL), in logical px, and
// the projection, fit, zoom and pan that place them. Projected units are the flight's projection
// of world units; a view's scale is logical px per projected unit.

export const MAP_SCREEN = {
  /** The charting disc minScale fits (model/map.ts CHARTING_RADIUS). */
  chartRadius: CHARTING_RADIUS,
  /** Movement past this pans and never selects (SCROLL.dragThreshold). */
  dragThreshold: SCROLL.dragThreshold,
  /**
   * Return to Earth: a secondary TEXT_BUTTON on the HUD row, its "Return to Earth" label (116.5)
   * plus TEXT_BUTTON.inset each side.
   */
  earth: { height: TEXT_BUTTON.height, width: 116.5 + 2 * TEXT_BUTTON.inset },
  /** Chip radius plus SPACING.gap: symbols keep this far inside the fit region. */
  fitMargin: 22,
  fog: {
    /** Gaussian edge sigma as a share of the reveal's on-screen x radius. */
    feather: 0.16,
    /** Sigma never below this. */
    minFeather: 3,
    /** World units explored around each explored point, each discovered place and Ada. */
    reveal: 1500,
    /** Most world units flown between explored points. */
    sample: 250,
  },
  header: {
    /** Ink panel alpha, the HUD panel's. */
    alpha: 0.65,
    /** The divider between the name and the percent. */
    divider: { height: 16, width: 1 },
    /** Name, this gap, the divider, this gap, percent. */
    dividerGap: 12,
    /** The HUD row: HUD_BUTTON.target. */
    height: HUD_BUTTON.target,
    /** The percent's 20 line box top. */
    labelTop: 14,
    /** The name's 28 line box top. */
    nameTop: 10,
    padding: 16,
    /** Pip diameter, centred on the row. */
    pip: 6,
    /** Percent to the first pip. */
    pipGap: 8,
    /** Pip centre to centre. */
    pipPitch: 8,
    /** An uncharted pip's ring. */
    pipRing: 1,
    radius: 4,
  },
  /** The opening box is at least this many projected units across and down. */
  minBox: { height: 6000, width: 12000 },
  tools: {
    /** Tool targets top to top: HUD_BUTTON.target + HUD_BUTTON.gap. */
    pitch: HUD_BUTTON.target + HUD_BUTTON.gap,
  },
  /** Wheel deltaY px per zoom step. */
  wheelStep: 100,
  /** One zoom step. */
  zoomStep: 1.5,
} as const;

export const MAP_PANEL = {
  /** Text block to Travel here, at least. */
  actionGap: 16,
  /** Chip to the text block (SPACING.gap). */
  markGap: SPACING.gap,
  /** The card floor: half the 720 base width. */
  minWidth: 360,
  /** SPACING.panelPadding, including the 2 frame. */
  padding: SPACING.panelPadding,
  /** Row to the reason line (SPACING.gap). */
  reasonGap: SPACING.gap,
  /** The panel's row, TEXT_BUTTON.height. */
  row: 48,
  /** The two 20 lines' top inside the 48 row. */
  textTop: 4,
} as const;

export const MAP_SYMBOL = {
  ada: {
    /** Ink keyline outside the hull: a 3 ink stroke under the fill. */
    keyline: 1.5,
    /** Arrow box, centred on Ada's position. */
    size: 28,
  },
  /** Disc diameter. */
  chip: 28,
  /** Ink edge inside the disc. */
  edge: 1,
  /** Ink glyph mask, centred. */
  glyph: 20,
  /** Press area: hitAround of the chip, HIT_RULE.minTarget. */
  hit: 48,
  objective: {
    /** The indicator's drawing box around the chip centre: across, down, and its top above it. */
    box: { height: 28, top: 48, width: 16 },
    /** Ink stroke under the lavender one. */
    ink: 4,
    stroke: 2,
    /** Indicator tip above the chip centre. */
    tip: 23,
  },
  ring: {
    band: 2,
    fringe: 1,
    /** Selection ring centre radius: 2 outside the face. */
    radius: 17,
  },
} as const;

/** The map's colours (art/map.md "Symbols" and "Contrast per field"). */
export const MAP_COLORS = {
  canopy: "#70ace8",
  cream: "#ead4aa",
  divider: "#57536e",
  hull: "#ffffff",
  ink: "#181425",
  objective: "#c4afcc",
  supporting: "#b8b3c9",
} as const;

/**
 * Each symbol's chip face. A held job's own spot keeps the job's orange, as does any place that is
 * the job's target (the faces of gameplay/quests.md's job marks).
 */
export const MAP_FACES: Readonly<Record<MapSymbol, string>> = {
  beacon: "#ead4aa",
  destination: "#65c9bf",
  growers: "#9ccc5a",
  holodisk: "#e868c8",
  job: "#feae34",
  nebula: "#ead4aa",
  salvagers: "#8f9cf0",
  station: "#c4afcc",
  workshop: "#f2d15a",
  wreck: "#ead4aa",
};
export const MAP_JOB_FACE = MAP_FACES.job;

/** Each symbol's glyph: Art's map-*.svg masks (art/tools/map-icons.ts); a job spot has none. */
export const MAP_GLYPHS: Readonly<Record<MapSymbol, string | null>> = {
  beacon: "map-beacon",
  destination: "map-destination",
  growers: "map-growers",
  holodisk: "map-holodisk",
  job: null,
  nebula: "map-nebula",
  salvagers: "map-salvagers",
  station: "map-station",
  workshop: "map-workshop",
  wreck: "map-wreck",
};

/** The tools, top to bottom, with their glyphs. */
export const MAP_TOOLS = [
  { glyph: "map-close", id: "close" },
  { glyph: "map-zoom-in", id: "zoomIn" },
  { glyph: "map-zoom-out", id: "zoomOut" },
  { glyph: "map-recentre", id: "recentre" },
] as const;
export type MapTool = (typeof MAP_TOOLS)[number]["id"];

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A map view: logical px per projected unit, and the projected point at the inner centre. */
export interface MapView {
  readonly centre: Point;
  readonly scale: number;
}

/** The flight's projection of a world position: x - y across, half x + y down. */
export function mapProjection(world: Point): Point {
  return { x: world.x - world.y, y: (world.x + world.y) / 2 };
}

/**
 * The region left for the map: below the header row, left of the tool column, inside the page
 * safe rect.
 */
export function fitRegion(insets: Insets, view: Size): Rect {
  const page = safeRect(insets, SPACING.pageInset, view);
  const hud = hudRect(insets, view);
  const left = page.x;
  const top = hud.y + MAP_SCREEN.header.height + SPACING.gap;
  const right = toolColumnLeft(insets, view) - SPACING.gap;
  const bottom = page.y + page.height;
  return { height: bottom - top, width: right - left, x: left, y: top };
}

/** The tool column's left edge: one HUD button target in from the HUD rect's right. */
export function toolColumnLeft(insets: Insets, view: Size): number {
  const hud = hudRect(insets, view);
  return hud.x + hud.width - HUD_BUTTON.target;
}

/**
 * The place panel's widest: inside the page safe rect and, centred there, SPACING.gap clear of
 * the tool column on each side, so a tall panel never reaches under it (592 at the 720 base).
 */
export function panelMaxWidth(insets: Insets, view: Size): number {
  const page = safeRect(insets, SPACING.pageInset, view);
  const centre = page.x + page.width / 2;
  return Math.min(page.width, 2 * (toolColumnLeft(insets, view) - SPACING.gap - centre));
}

/**
 * Return to Earth on the HUD row (art/map.md "Return to Earth"): its top on the HUD rect's top
 * and its right edge SPACING.pageInset left of the tool column; it never moves with the header.
 */
export function mapEarthRect(insets: Insets, view: Size): Rect {
  const right = toolColumnLeft(insets, view) - SPACING.pageInset;
  const { height, width } = MAP_SCREEN.earth;
  return { height, width, x: right - width, y: hudRect(insets, view).y };
}

/** The header's cap: the HUD row from its left to SPACING.gap short of Return to Earth. */
export function mapHeaderCap(insets: Insets, view: Size): number {
  return mapEarthRect(insets, view).x - SPACING.gap - hudRect(insets, view).x;
}

/**
 * The header's width: its padding, the name, the divider and its gaps, the percent, then the
 * pips one pitch apart.
 */
export function mapHeaderWidth(nameWidth: number, percentWidth: number, pips: number): number {
  const { divider, dividerGap, padding, pip, pipGap, pipPitch } = MAP_SCREEN.header;
  const pipRow = pips > 0 ? pipGap + pip + (pips - 1) * pipPitch : 0;
  return 2 * padding + nameWidth + 2 * dividerGap + divider.width + percentWidth + pipRow;
}

/** The fit region inset by fitMargin on every side. */
export function innerRegion(fit: Rect): Rect {
  const margin = MAP_SCREEN.fitMargin;
  return {
    height: fit.height - 2 * margin,
    width: fit.width - 2 * margin,
    x: fit.x + margin,
    y: fit.y + margin,
  };
}

/** The zoom range: minScale fits the charting disc, maxScale the minimum box. */
export function scaleLimits(inner: Rect): { readonly max: number; readonly min: number } {
  const { chartRadius, minBox } = MAP_SCREEN;
  return {
    max: Math.min(inner.width / minBox.width, inner.height / minBox.height),
    min: Math.min(
      inner.width / (2 * Math.SQRT2 * chartRadius),
      inner.height / (Math.SQRT2 * chartRadius),
    ),
  };
}

const centreOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/** A world position's place on screen, in logical px. */
export function toScreen(inner: Rect, view: MapView, world: Point): Point {
  const projected = mapProjection(world);
  const middle = centreOf(inner);
  return {
    x: middle.x + (projected.x - view.centre.x) * view.scale,
    y: middle.y + (projected.y - view.centre.y) * view.scale,
  };
}

/** A projected bounding box. */
function bounds(points: readonly Point[]): Rect {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { height: Math.max(...ys) - y, width: Math.max(...xs) - x, x, y };
}

/**
 * The pan limit: the projected bounding box of the charting disc and every place, which the
 * inner centre stays inside, so a far station stays reachable and the map never drifts away.
 */
export function panLimit(places: readonly Point[]): Rect {
  const r = MAP_SCREEN.chartRadius;
  const disc = [
    { x: -r * Math.SQRT2, y: -(r * Math.SQRT2) / 2 },
    { x: r * Math.SQRT2, y: (r * Math.SQRT2) / 2 },
  ];
  return bounds([...disc, ...places.map(mapProjection)]);
}

/** A view with its centre clamped to the pan limit and its scale to the zoom range. */
export function clampView(inner: Rect, limit: Rect, view: MapView): MapView {
  const { max, min } = scaleLimits(inner);
  return {
    centre: {
      x: clamp(limit.x, limit.x + limit.width, view.centre.x),
      y: clamp(limit.y, limit.y + limit.height, view.centre.y),
    },
    scale: clamp(min, max, view.scale),
  };
}

/** Pans the least distance that brings a screen point inside a rect. */
function panInside(rect: Rect, point: Point, view: MapView): MapView {
  const dx = point.x < rect.x ? point.x - rect.x : Math.max(0, point.x - (rect.x + rect.width));
  const dy = point.y < rect.y ? point.y - rect.y : Math.max(0, point.y - (rect.y + rect.height));
  return {
    centre: { x: view.centre.x + dx / view.scale, y: view.centre.y + dy / view.scale },
    scale: view.scale,
  };
}

/**
 * The opening fit: the bounding box of Ada and every place, grown about its centre to at least
 * minBox, at the scale that fits it, clamped to the zoom range, its centre at the inner centre.
 * When minScale clamps it, the least pan that brings Ada inside the inner region.
 */
export function openingView(inner: Rect, places: readonly Point[], player: Point): MapView {
  const box = bounds([player, ...places].map(mapProjection));
  const width = Math.max(box.width, MAP_SCREEN.minBox.width);
  const height = Math.max(box.height, MAP_SCREEN.minBox.height);
  const { max, min } = scaleLimits(inner);
  const fitted = Math.min(inner.width / width, inner.height / height);
  const scale = clamp(min, max, fitted);
  const view = { centre: centreOf(box), scale };
  const opened = fitted < min ? panInside(inner, toScreen(inner, view, player), view) : view;
  return clampView(inner, panLimit(places), opened);
}

/**
 * Zooms by factor about a screen point, clamped to the zoom range. Refused when the scale is
 * already at the limit the zoom heads for.
 */
export function zoomView(
  inner: Rect,
  limit: Rect,
  factor: number,
  anchor: Point,
  view: MapView,
): { readonly refused: boolean; readonly view: MapView } {
  const { max, min } = scaleLimits(inner);
  const at = (factor > 1 ? max : min) * (1 + (factor > 1 ? -1e-9 : 1e-9));
  if (factor > 1 ? view.scale >= at : view.scale <= at) {
    return { refused: true, view };
  }
  const scale = clamp(min, max, view.scale * factor);
  const middle = centreOf(inner);
  const projected = {
    x: view.centre.x + (anchor.x - middle.x) / view.scale,
    y: view.centre.y + (anchor.y - middle.y) / view.scale,
  };
  return {
    refused: false,
    view: clampView(inner, limit, {
      centre: {
        x: projected.x - (anchor.x - middle.x) / scale,
        y: projected.y - (anchor.y - middle.y) / scale,
      },
      scale,
    }),
  };
}

/** Pans by a screen delta: the map follows the pointer. */
export function panView(inner: Rect, limit: Rect, delta: Point, view: MapView): MapView {
  return clampView(inner, limit, {
    centre: { x: view.centre.x - delta.x / view.scale, y: view.centre.y - delta.y / view.scale },
    scale: view.scale,
  });
}

/** Pans so Ada sits at the inner centre, at the same scale. */
export function recentreView(inner: Rect, limit: Rect, player: Point, view: MapView): MapView {
  return clampView(inner, limit, { centre: mapProjection(player), scale: view.scale });
}

/**
 * Keep clear: the least pan that puts a selected chip and its ring inside the fit region and at
 * least SPACING.gap above the panel's top (or the fit region's bottom without a panel).
 */
export function keepClear(
  fit: Rect,
  inner: Rect,
  panelTop: number | null,
  place: Point,
  view: MapView,
): MapView {
  const reach = MAP_SYMBOL.ring.radius + MAP_SYMBOL.ring.band / 2 + MAP_SYMBOL.ring.fringe;
  const bottom = Math.min(
    fit.y + fit.height,
    panelTop === null ? Infinity : panelTop - SPACING.gap,
  );
  const clear: Rect = {
    height: Math.max(0, bottom - fit.y - 2 * reach),
    width: Math.max(0, fit.width - 2 * reach),
    x: fit.x + reach,
    y: fit.y + reach,
  };
  return panInside(clear, toScreen(inner, view, place), view);
}

/** Places in reading order: drawn centre top to bottom, then left to right. */
export function readingOrder<T extends Point>(points: readonly T[]): T[] {
  return [...points].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** A chip's drawn rect around its screen centre. */
export function chipRect(centre: Point): Rect {
  const half = MAP_SYMBOL.chip / 2;
  return {
    height: MAP_SYMBOL.chip,
    width: MAP_SYMBOL.chip,
    x: centre.x - half,
    y: centre.y - half,
  };
}

/** The fog's colour: the sRGB channel mean of environment and environmentDetail, half up. */
export function fogColor(environment: number, environmentDetail: number): string {
  const channel = (shift: number) =>
    Math.floor((((environment >> shift) & 255) + ((environmentDetail >> shift) & 255)) / 2 + 0.5);
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, "0")).join("")}`;
}

/** The fog reveal's on-screen ellipse radii at a scale, and its feather sigma. */
export function fogReveal(scale: number): {
  readonly rx: number;
  readonly ry: number;
  readonly sigma: number;
} {
  const { feather, minFeather, reveal } = MAP_SCREEN.fog;
  const rx = reveal * Math.SQRT2 * scale;
  return { rx, ry: rx / 2, sigma: Math.max(minFeather, feather * rx) };
}

/** The fog mask's canvas blur, for a sigma in the canvas's device px. */
export function fogBlur(sigma: number): string {
  return `blur(${sigma}px)`;
}

/** Ada's arrow's screen angle for her facing: atan2((fx + fy) / 2, fx - fy). */
export function adaAngle(facing: Point): number {
  return Math.atan2((facing.x + facing.y) / 2, facing.x - facing.y);
}
