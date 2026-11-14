import { clamp } from "@andornaut/game-kit/numbers";
import type { Rect } from "@andornaut/game-kit/rect";

import {
  HUD_BUTTON,
  MAP_HUD_LABEL_WIDTHS,
  MAP_SCREEN_LAYOUT,
  MAP_SYMBOL,
  SPACING,
  TEXT_BUTTON,
} from "../../data/layout.ts";
import { CHARTING_RADIUS, type MapSymbol } from "../../model/map.ts";
import { nearestImage, wrapPoint } from "../../model/worldGeometry.ts";
import { type Insets, safeRect, type Size } from "./playView.ts";
import { BUTTON_GAP, TYPE } from "./tokens.ts";
export { MAP_PANEL, MAP_SYMBOL } from "../../data/layout.ts";

// The pause menu's full-screen map (art/map.md): the screen's header, tools, fog and fit
// (MAP_SCREEN), the place panel (MAP_PANEL) and the place symbols (MAP_SYMBOL), in logical px, and
// the projection, fit, zoom and pan that place them. Projected units are the flight's projection
// of world units; a view's scale is logical px per projected unit.

const HUD_ACTION_WIDTH = Math.max(...Object.values(MAP_HUD_LABEL_WIDTHS)) + 2 * TEXT_BUTTON.inset;

export const MAP_SCREEN = {
  ...MAP_SCREEN_LAYOUT,
  /** The charting disc minScale fits (model/map.ts CHARTING_RADIUS). */
  chartRadius: CHARTING_RADIUS,
  header: {
    ...MAP_SCREEN_LAYOUT.header,
    height: TYPE.heading.lineHeight + 2 * SPACING.rowGap + TYPE.body.lineHeight + SPACING.gap,
    rowHeight: TYPE.heading.lineHeight + 2 * SPACING.rowGap,
  },
  hudRow: {
    close: { width: HUD_ACTION_WIDTH },
    galaxies: { width: HUD_ACTION_WIDTH },
    gap: BUTTON_GAP,
    height: TEXT_BUTTON.height,
    quests: { width: HUD_ACTION_WIDTH },
    right: 0,
  },
  toolRow: {
    gap: HUD_BUTTON.gap,
    height: HUD_BUTTON.target,
    width: 3 * HUD_BUTTON.target + 2 * HUD_BUTTON.gap,
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

/** The compact tools, left to right, with their glyphs. */
export const MAP_TOOLS = [
  { glyph: "map-zoom-out", id: "zoomOut" },
  { glyph: "map-zoom-in", id: "zoomIn" },
  { glyph: "map-recentre", id: "recentre" },
] as const;
export type MapTool = (typeof MAP_TOOLS)[number]["id"];

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A map view: logical px per projected unit, and the projected point at the inner centre. */
export interface MapView {
  readonly worldSide?: number;
  readonly centre: Point;
  readonly scale: number;
}

/** The flight's projection of a world position: x - y across, half x + y down. */
export function mapProjection(world: Point): Point {
  return { x: world.x - world.y, y: (world.x + world.y) / 2 };
}

/** The map's geometry stays clear of the top header and bottom navigation. */
export interface MapRegion extends Rect {
  readonly zoomHeight?: number;
}

export function fitRegion(insets: Insets, view: Size): MapRegion {
  const page = safeRect(insets, SPACING.pageInset, view);
  const top = page.y + MAP_SCREEN.header.height + SPACING.gap;
  const bottom = mapCloseRect(insets, view).y - SPACING.gap;
  return { height: bottom - top, width: page.width, x: page.x, y: top, zoomHeight: page.height };
}

export function mapRowTop(insets: Insets, view: Size): number {
  return safeRect(insets, SPACING.pageInset, view).y;
}

/** The left of the horizontal tool row, retained for existing geometry consumers. */
export function toolColumnLeft(insets: Insets, view: Size): number {
  const page = safeRect(insets, SPACING.pageInset, view);
  return page.x + page.width - MAP_SCREEN.toolRow.width;
}

export function mapCloseRect(insets: Insets, view: Size): Rect {
  const page = safeRect(insets, SPACING.pageInset, view);
  const { close, height } = MAP_SCREEN.hudRow;
  return {
    height,
    width: close.width,
    x: page.x + page.width - close.width,
    y: page.y + page.height - height,
  };
}

export function mapGalaxiesRect(insets: Insets, view: Size): Rect {
  const close = mapCloseRect(insets, view);
  const { galaxies, gap, height } = MAP_SCREEN.hudRow;
  return { height, width: galaxies.width, x: close.x - gap - galaxies.width, y: close.y };
}

export function mapQuestsRect(insets: Insets, view: Size): Rect {
  const galaxies = mapGalaxiesRect(insets, view);
  const { gap, height, quests } = MAP_SCREEN.hudRow;
  return { height, width: quests.width, x: galaxies.x - gap - quests.width, y: galaxies.y };
}

/** The selected destination stays left of the entire footer action group. */
export function panelMaxWidth(insets: Insets, view: Size): number {
  const page = safeRect(insets, SPACING.pageInset, view);
  return Math.max(0, mapQuestsRect(insets, view).x - SPACING.gap - page.x);
}

export function mapHeaderCap(insets: Insets, view: Size): number {
  return toolColumnLeft(insets, view) - SPACING.gap - safeRect(insets, SPACING.pageInset, view).x;
}

/** One equal gap spans both outer edges and each pair of adjacent ink segments. */
export function mapHeaderGeometry(
  nameWidth: number,
  percentWidth: number,
  pips: number,
  noteWidth = 0,
  pixelUnit = 1,
) {
  const { divider, padding, pip, pipPitch } = MAP_SCREEN.header;
  const pipRow =
    pips > 0 ? Math.round((pips - 1) * pipPitch * pixelUnit) + Math.round(pip * pixelUnit) : 0;
  const ink =
    Math.round(nameWidth * pixelUnit) +
    Math.round(divider.width * pixelUnit) +
    Math.round(percentWidth * pixelUnit) +
    pipRow;
  const gaps = pips > 0 ? 5 : 4;
  const minimum = Math.max(
    ink + gaps * Math.round(SPACING.gap * pixelUnit),
    Math.ceil(noteWidth * pixelUnit) + 2 * Math.round(padding * pixelUnit),
  );
  const gap = Math.ceil((minimum - ink) / gaps);
  return { gap: gap / pixelUnit, width: (ink + gaps * gap) / pixelUnit };
}

export function mapHeaderWidth(
  nameWidth: number,
  percentWidth: number,
  pips: number,
  noteWidth = 0,
): number {
  return mapHeaderGeometry(nameWidth, percentWidth, pips, noteWidth).width;
}

/** The fit region inset by fitMargin on every side. */
export function innerRegion(fit: MapRegion): MapRegion {
  const margin = MAP_SCREEN.fitMargin;
  return {
    height: fit.height - 2 * margin,
    width: fit.width - 2 * margin,
    x: fit.x + margin,
    y: fit.y + margin,
    ...(fit.zoomHeight === undefined ? {} : { zoomHeight: fit.zoomHeight - 2 * margin }),
  };
}

/** The zoom range: minScale fits the charting disc, maxScale the minimum box. */
export function scaleLimits(inner: MapRegion): { readonly max: number; readonly min: number } {
  const { chartRadius, minBox } = MAP_SCREEN;
  return {
    max: Math.min(inner.width / minBox.width, (inner.zoomHeight ?? inner.height) / minBox.height),
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

/** The nearest periodic image to the current view, or the unchanged legacy point. */
export function mapImage(view: MapView, world: Point): Point {
  return view.worldSide === undefined
    ? world
    : nearestImage(view.worldSide, mapWorld(view.centre), world).point;
}

function mapWorld(projected: Point): Point {
  return { x: projected.y + projected.x / 2, y: projected.y - projected.x / 2 };
}

/** A world position's place on screen, in logical px. */
export function toScreen(inner: Rect, view: MapView, world: Point): Point {
  const projected = mapProjection(mapImage(view, world));
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
  if (view.worldSide !== undefined) {
    const { max, min } = scaleLimits(inner);
    return {
      ...view,
      centre: mapProjection(wrapPoint(view.worldSide, mapWorld(view.centre))),
      scale: clamp(min, max, view.scale),
    };
  }
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
    ...view,
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
      ...view,
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
    ...view,
    centre: { x: view.centre.x - delta.x / view.scale, y: view.centre.y - delta.y / view.scale },
    scale: view.scale,
  });
}

/** Pans so Ada sits at the inner centre, at the same scale. */
export function recentreView(inner: Rect, limit: Rect, player: Point, view: MapView): MapView {
  return clampView(inner, limit, { ...view, centre: mapProjection(player) });
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
