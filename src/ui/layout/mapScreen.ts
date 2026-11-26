import { clamp } from "@andornaut/game-kit/runtime/numbers";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { MapSymbol } from "../../data/destinations.ts";
import {
  HUD_BUTTON,
  MAP_HUD_LABEL_WIDTHS,
  MAP_SCREEN_LAYOUT,
  MAP_SYMBOL,
  SPACING,
  TEXT_BUTTON,
} from "../../data/layout.ts";
import { TASK_COLORS } from "../../data/taskCategories.ts";
import { CHARTING_ORIGIN, CHARTING_RADIUS } from "../../model/map.ts";
import { wrapPoint } from "../../model/worldGeometry.ts";
import { CARD_CLOSE } from "./cardFrame.ts";
import { COLOURS, UNLISTED_COLOURS } from "./colours.ts";
import { hudRect, type Insets, safeRect, type Size, STATUS_PILL } from "./playView.ts";
import { BUTTON_GAP, TYPE } from "./tokens.ts";
export { MAP_PANEL, MAP_SYMBOL } from "../../data/layout.ts";

// The pause menu's full-screen map (art/map.md): the screen's header, tools, fog and fit
// (MAP_SCREEN), the place panel (MAP_PANEL) and the place symbols (MAP_SYMBOL), in logical px, and
// the projection, fit, zoom and pan that place them. Projected units are the flight's projection
// of world units; a view's scale is logical px per projected unit.

export const COMPACT_MAP_HEADER_TOP = 1;

const HUD_ACTION_WIDTH = Math.max(...Object.values(MAP_HUD_LABEL_WIDTHS)) + 2 * TEXT_BUTTON.inset;

export const MAP_SCREEN = {
  ...MAP_SCREEN_LAYOUT,
  /** The charting disc minScale fits (model/map.ts CHARTING_RADIUS). */
  chartRadius: CHARTING_RADIUS,
  header: {
    ...MAP_SCREEN_LAYOUT.header,
    height: TYPE.heading.lineHeight + 2 * SPACING.rowGap + TYPE.body.lineHeight + SPACING.gap,
    /** The pip row's width: 78. */
    pipRow:
      (MAP_SCREEN_LAYOUT.header.pips - 1) * MAP_SCREEN_LAYOUT.header.pipPitch +
      MAP_SCREEN_LAYOUT.header.pip,
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
  canopy: COLOURS.adaBlue,
  cream: TASK_COLORS.generic,
  divider: COLOURS.divider,
  hull: COLOURS.white,
  ink: COLOURS.ink,
  objective: UNLISTED_COLOURS.mapPointOfInterest,
  supporting: COLOURS.supporting,
} as const;

/**
 * Each symbol's chip face. A held job's own spot keeps the job's orange, as does any place that is
 * the job's target (the faces of gameplay/quests.md's job marks).
 */
const STATION_FACE = UNLISTED_COLOURS.mapPointOfInterest;

export const MAP_FACES: Readonly<Record<MapSymbol | "hostileStation", string>> = {
  beacon: COLOURS.cream,
  destination: TASK_COLORS.story,
  growers: UNLISTED_COLOURS.mapGrowers,
  holodisk: COLOURS.holodisk,
  hostileStation: STATION_FACE,
  job: TASK_COLORS.job,
  nebula: COLOURS.cream,
  salvagers: TASK_COLORS.project,
  station: STATION_FACE,
  workshop: UNLISTED_COLOURS.mapWorkshop,
  wreck: COLOURS.cream,
};
export const MAP_JOB_FACE = MAP_FACES.job;

/** Each symbol's glyph: Art's map-*.svg masks (art/tools/map-icons.ts), including the generic job spot. */
export const MAP_GLYPHS: Readonly<Record<MapSymbol | "hostileStation", string | null>> = {
  beacon: "map-beacon",
  destination: "map-destination",
  growers: "map-growers",
  holodisk: "map-holodisk",
  hostileStation: "map-hostile-station",
  job: "map-job",
  nebula: "map-nebula",
  salvagers: "map-salvagers",
  station: "map-station",
  workshop: "map-workshop",
  wreck: "map-wreck",
};

/** Native hostile-station art keeps its authored extent; other Map glyphs retain their size. */
export function mapGlyphSize(symbol: keyof typeof MAP_GLYPHS): number {
  return symbol === "hostileStation" ? MAP_SYMBOL.hostileStationGlyph : MAP_SYMBOL.glyph;
}

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

/**
 * A map view: logical px per projected unit, the projected point at the inner centre, and the
 * side of the square flight wraps positions into, which bounds it.
 */
export interface MapView {
  readonly worldSide: number;
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
  return page.x + page.width - MAP_SCREEN.toolRow.width - CARD_CLOSE.hit.width;
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
export function panelMaxWidth(
  insets: Insets,
  view: Size,
  navigationWidth = MAP_SCREEN.hudRow.close.width +
    MAP_SCREEN.hudRow.galaxies.width +
    MAP_SCREEN.hudRow.quests.width +
    2 * MAP_SCREEN.hudRow.gap,
): number {
  const page = safeRect(insets, SPACING.pageInset, view);
  return Math.max(0, page.width - navigationWidth - SPACING.gap);
}

/**
 * The header's left takes the status pill's rule: SPACING.gap right of the pause press area, 62.75
 * at the 720 base and 93.75 with phone insets. The navigation disc always shows over the map
 * (src/input/controls.ts syncNavigationEntry), so art/map.md's page-left case for a hidden pause
 * button does not arise here.
 */
export function mapHeaderLeft(insets: Insets, view: Size): number {
  return hudRect(insets, view).x + STATUS_PILL.x;
}

/** The header ends SPACING.gap left of the tools, which sit left of the close target. */
export function mapHeaderCap(insets: Insets, view: Size): number {
  return Math.max(0, toolColumnLeft(insets, view) - SPACING.gap - mapHeaderLeft(insets, view));
}

/** Filled survey pips: one per whole tenth of the header's displayed percent. */
export function filledPips(percent: number): number {
  return clamp(0, MAP_SCREEN.header.pips, Math.floor(percent / 10));
}

/**
 * One equal gap spans both outer edges and each pair of adjacent ink segments: the name, the
 * divider, the percent and the full-size pip row. The note sets the minimum width.
 */
export function mapHeaderGeometry(
  nameWidth: number,
  percentWidth: number,
  noteWidth = 0,
  pixelUnit = 1,
) {
  const { divider, padding, pip, pipPitch, pips } = MAP_SCREEN.header;
  const pipRow = Math.round((pips - 1) * pipPitch * pixelUnit) + Math.round(pip * pixelUnit);
  const ink =
    Math.round(nameWidth * pixelUnit) +
    Math.round(divider.width * pixelUnit) +
    Math.round(percentWidth * pixelUnit) +
    pipRow;
  const gaps = 5;
  const minimum = Math.max(
    ink + gaps * Math.round(SPACING.gap * pixelUnit),
    Math.ceil(noteWidth * pixelUnit) + 2 * Math.round(padding * pixelUnit),
  );
  const gap = Math.ceil((minimum - ink) / gaps);
  return { gap: gap / pixelUnit, width: (ink + gaps * gap) / pixelUnit };
}

export function mapHeaderWidth(nameWidth: number, percentWidth: number, noteWidth = 0): number {
  return mapHeaderGeometry(nameWidth, percentWidth, noteWidth).width;
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

/** The square's projection: a diamond 2 side across and side down, centred on the origin. */
function squareExtent(side: number): Size {
  return { height: side, width: 2 * side };
}

/**
 * The zoom range: maxScale fits the minimum box; minScale is the tighter of the charting-disc fit
 * and the scale at which the field spans the square's projected extent on its limiting axis.
 */
export function scaleLimits(
  inner: MapRegion,
  field: Size,
  side: number,
): { readonly max: number; readonly min: number } {
  const { chartRadius, minBox } = MAP_SCREEN;
  const square = squareExtent(side);
  return {
    max: Math.min(inner.width / minBox.width, (inner.zoomHeight ?? inner.height) / minBox.height),
    min: Math.max(
      Math.min(
        inner.width / (2 * Math.SQRT2 * chartRadius),
        inner.height / (Math.SQRT2 * chartRadius),
      ),
      Math.max(field.width / square.width, field.height / square.height),
    ),
  };
}

const centreOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/** The position the map draws: the canonical point inside the square flight wraps into. */
export function mapImage(view: Pick<MapView, "worldSide">, world: Point): Point {
  return wrapPoint(view.worldSide, world);
}

function projectedToScreen(inner: Rect, view: MapView, projected: Point): Point {
  const middle = centreOf(inner);
  return {
    x: middle.x + (projected.x - view.centre.x) * view.scale,
    y: middle.y + (projected.y - view.centre.y) * view.scale,
  };
}

/** A world position's place on screen, in logical px. */
export function toScreen(inner: Rect, view: MapView, world: Point): Point {
  return projectedToScreen(inner, view, mapProjection(mapImage(view, world)));
}

/** The four unwrapped tips of the playable square's projection, in screen order. */
export function mapWorldDiamond(inner: Rect, view: MapView): readonly [Point, Point, Point, Point] {
  const centre = projectedToScreen(inner, view, { x: 0, y: 0 });
  const { height, width } = squareExtent(view.worldSide);
  const dx = (width * view.scale) / 2;
  const dy = (height * view.scale) / 2;
  return [
    { x: centre.x, y: centre.y - dy },
    { x: centre.x + dx, y: centre.y },
    { x: centre.x, y: centre.y + dy },
    { x: centre.x - dx, y: centre.y },
  ];
}

/** The canonical survey oval in logical screen coordinates. */
export function mapSurveyEllipse(inner: Rect, view: MapView) {
  const centre = toScreen(inner, view, CHARTING_ORIGIN);
  const rx = CHARTING_RADIUS * Math.SQRT2 * view.scale;
  return { ...centre, rx, ry: rx / 2 };
}

/** A projected bounding box. */
function bounds(points: readonly Point[]): Rect {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { height: Math.max(...ys) - y, width: Math.max(...xs) - x, x, y };
}

/** a x + b y <= c. */
type HalfPlane = readonly [a: number, b: number, c: number];

/** A convex polygon cut by a half-plane (Sutherland-Hodgman). */
function cut(polygon: readonly Point[], [a, b, c]: HalfPlane): Point[] {
  const kept: Point[] = [];
  polygon.forEach((p, index) => {
    const q = polygon[(index + 1) % polygon.length]!;
    const fp = a * p.x + b * p.y - c;
    const fq = a * q.x + b * q.y - c;
    if (fp <= 0) {
      kept.push(p);
    }
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      kept.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  });
  return kept;
}

/** The point of segment a-b nearest to point. */
function nearestOnSegment(a: Point, b: Point, point: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : clamp(0, 1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** The seams' half-planes: the diamond |x| / 2 + |y| <= side / 2. */
const seams = (side: number): HalfPlane[] => [
  [1, 2, side],
  [1, -2, side],
  [-1, 2, side],
  [-1, -2, side],
];

/** A view's allowed centres: a box of centres cut by the seams' half-planes. */
interface CentreRegion {
  readonly box: {
    readonly x0: number;
    readonly x1: number;
    readonly y0: number;
    readonly y1: number;
  };
  readonly seams: readonly HalfPlane[];
}

/**
 * The centres a view may take at its scale: the view's edge stays inside the square's projected
 * extent, so it stops at each of the diamond's tips, and its centre stays inside the diamond, so
 * it stops at each seam.
 */
function centreRegion(inner: Rect, field: Rect, side: number, scale: number): CentreRegion {
  const middle = centreOf(inner);
  const { height, width } = squareExtent(side);
  // Within rounding at minScale the field spans the extent exactly: hold the axis' midpoint.
  const span = (low: number, high: number): [number, number] =>
    low <= high ? [low, high] : [(low + high) / 2, (low + high) / 2];
  const [x0, x1] = span(
    -width / 2 + (middle.x - field.x) / scale,
    width / 2 - (field.x + field.width - middle.x) / scale,
  );
  const [y0, y1] = span(
    -height / 2 + (middle.y - field.y) / scale,
    height / 2 - (field.y + field.height - middle.y) / scale,
  );
  return { box: { x0, x1, y0, y1 }, seams: seams(side) };
}

/** The nearest allowed centre to `point`: itself when it is allowed. */
function nearestInside({ box, seams: planes }: CentreRegion, point: Point): Point {
  if (
    point.x >= box.x0 &&
    point.x <= box.x1 &&
    point.y >= box.y0 &&
    point.y <= box.y1 &&
    planes.every(([a, b, c]) => a * point.x + b * point.y <= c)
  ) {
    return point;
  }
  const polygon = planes.reduce(cut, [
    { x: box.x0, y: box.y0 },
    { x: box.x1, y: box.y0 },
    { x: box.x1, y: box.y1 },
    { x: box.x0, y: box.y1 },
  ]);
  // At a minScale where the field spans both axes, the held midpoints can miss the diamond.
  const region =
    polygon.length > 0 ? polygon : [{ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }];
  let best = region[0]!;
  let gap = Infinity;
  region.forEach((a, index) => {
    const candidate = nearestOnSegment(a, region[(index + 1) % region.length]!, point);
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < gap) {
      best = candidate;
      gap = distance;
    }
  });
  return best;
}

/** Keep part of the oval past the field edge at maximum zoom-out. */
function keepSurveyVisible(inner: Rect, field: Rect, region: CentreRegion, view: MapView): Point {
  const { rx, ry, x, y } = mapSurveyEllipse(inner, view);
  // Test the nearest point of a one-logical-pixel inset field in ellipse space. This requires
  // real overlap at corners and leaves a margin against a tangent that paints no visible arc.
  const inset = Math.min(1, field.width / 4, field.height / 4);
  const overlaps = (centre: Point): boolean => {
    const cx = x + (view.centre.x - centre.x) * view.scale;
    const cy = y + (view.centre.y - centre.y) * view.scale;
    const dx = clamp(field.x + inset, field.x + field.width - inset, cx) - cx;
    const dy = clamp(field.y + inset, field.y + field.height - inset, cy) - cy;
    return Math.hypot(dx / rx, dy / ry) < 1;
  };
  if (overlaps(view.centre)) {
    return view.centre;
  }
  const middle = centreOf(field);
  const aligned = nearestInside(region, {
    x: view.centre.x + (x - middle.x) / view.scale,
    y: view.centre.y + (y - middle.y) / view.scale,
  });
  // The segment stays in the convex square bounds. Bisect it to retain the furthest admissible
  // centre along the requested pan, testing the actual ellipse at each step.
  let inside = aligned;
  let outside = view.centre;
  for (let step = 0; step < 32; step++) {
    const next = { x: (inside.x + outside.x) / 2, y: (inside.y + outside.y) / 2 };
    if (overlaps(next)) {
      inside = next;
    } else {
      outside = next;
    }
  }
  return inside;
}

/**
 * A view with its scale clamped to the zoom range and its centre to the least pan that keeps it
 * inside the square (centreRegion). At minScale the survey oval also stays partly in the field.
 */
export function clampView(inner: MapRegion, field: Rect, view: MapView): MapView {
  const { max, min } = scaleLimits(inner, field, view.worldSide);
  const scale = clamp(min, max, view.scale);
  const region = centreRegion(inner, field, view.worldSide, scale);
  const clamped = { ...view, centre: nearestInside(region, view.centre), scale };
  return scale === min
    ? { ...clamped, centre: keepSurveyVisible(inner, field, region, clamped) }
    : clamped;
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
 * The opening fit: the bounding box of Ada and every place at their positions in the square,
 * grown about its centre to at least minBox, at the scale that fits it, clamped to the zoom range,
 * its centre at the inner centre. When minScale clamps it (a discovered station far outside the
 * disc), pan to bring Ada inside the inner region where the square and survey bounds allow it.
 */
export function openingView(
  inner: MapRegion,
  field: Rect,
  side: number,
  places: readonly Point[],
  player: Point,
): MapView {
  const box = bounds([player, ...places].map((point) => mapProjection(wrapPoint(side, point))));
  const width = Math.max(box.width, MAP_SCREEN.minBox.width);
  const height = Math.max(box.height, MAP_SCREEN.minBox.height);
  const { max, min } = scaleLimits(inner, field, side);
  const fitted = Math.min(inner.width / width, inner.height / height);
  const scale = clamp(min, max, fitted);
  const view = { centre: centreOf(box), scale, worldSide: side };
  const opened = fitted < min ? panInside(inner, toScreen(inner, view, player), view) : view;
  return clampView(inner, field, opened);
}

/**
 * Zooms by factor about a screen point, clamped to the zoom range and the square. Refused when
 * the scale is already at the limit the zoom heads for.
 */
export function zoomView(
  inner: MapRegion,
  field: Rect,
  factor: number,
  anchor: Point,
  view: MapView,
): { readonly refused: boolean; readonly view: MapView } {
  const { max, min } = scaleLimits(inner, field, view.worldSide);
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
    view: clampView(inner, field, {
      ...view,
      centre: {
        x: projected.x - (anchor.x - middle.x) / scale,
        y: projected.y - (anchor.y - middle.y) / scale,
      },
      scale,
    }),
  };
}

/** Pans by a screen delta: the map follows the pointer, inside the square. */
export function panView(inner: MapRegion, field: Rect, delta: Point, view: MapView): MapView {
  return clampView(inner, field, {
    ...view,
    centre: { x: view.centre.x - delta.x / view.scale, y: view.centre.y - delta.y / view.scale },
    scale: view.scale,
  });
}

/** Pans so Ada sits at the inner centre, at the same scale, as far as the square allows. */
export function recentreView(inner: MapRegion, field: Rect, player: Point, view: MapView): MapView {
  return clampView(inner, field, { ...view, centre: mapProjection(mapImage(view, player)) });
}

/**
 * Keep clear: the least pan that puts a selected chip and its ring inside the fit region and at
 * least SPACING.gap above the panel's top (or the fit region's bottom without a panel), as far as
 * the square allows.
 */
export function keepClear(
  fit: Rect,
  inner: MapRegion,
  field: Rect,
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
  return clampView(inner, field, panInside(clear, toScreen(inner, view, place), view));
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
