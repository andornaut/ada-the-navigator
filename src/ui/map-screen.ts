import type { Rect } from "@andornaut/game-kit/rect";
import { HIT_RULE, hitAround, type PressArea, pressedArea } from "@andornaut/game-kit/ui/hitAreas";

import JOBS from "../../public/art/jobs.json" with { type: "json" };
import { readMapArea } from "../game/job-art.ts";
import {
  type GalaxyMap,
  type MapPlace,
  type MapPlaceType,
  placeType,
  type QuestLine,
} from "../model/map.ts";
import type { Vec } from "../model/types.ts";
import { CARD_SLICE, FOCUS_RING, TEXT_BUTTON } from "./layout/controls.ts";
import { font, fromHudEdge, safeEdge, slice, units, VIEW_PROPERTIES } from "./layout/css.ts";
import {
  adaAngle,
  chipRect,
  clampView,
  fitRegion,
  fogBlur,
  fogReveal,
  innerRegion,
  keepClear,
  MAP_COLORS,
  MAP_FACES,
  MAP_GLYPHS,
  MAP_JOB_FACE,
  MAP_PANEL,
  MAP_SCREEN,
  MAP_SYMBOL,
  MAP_TOOLS,
  type MapTool,
  type MapView,
  openingView,
  panelMaxWidth,
  panLimit,
  panView,
  type Point,
  readingOrder,
  recentreView,
  toScreen,
  zoomView,
} from "./layout/mapScreen.ts";
import { HUD_ROW, SAFE_MARGIN } from "./layout/playView.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, createCard, isTap, TEXT_TOKENS } from "./modal.ts";
import { galaxiesAvailable, mapShowsEmpty } from "./pause.ts";
import { refuse } from "./refusal.ts";
import { hudDiscStyle } from "./weapons.ts";

// The pause menu's full-screen map (art/map.md): the galaxy's field under its fog, a chip per
// discovered place, Ada's arrow, the header, the tool column and the place panel. It takes input
// exclusively while it shows; the Paused card and its dim hide under it.

const ICONS = "/art/ui/icons/";

export interface MapScreenLabels {
  /** The recentre tool's accessible label. */
  readonly centerOnAda: string;
  readonly close: string;
  /** "{distance} light-years", and the distance that rounds to 1. */
  readonly distance: string;
  readonly distanceOne: string;
  /** "Job: {objective}", under the held job's target's type line. */
  readonly jobObjective: string;
  readonly map: string;
  /** "{percent}% mapped". */
  readonly galaxies: string;
  readonly mapPercent: string;
  readonly quests: string;
  readonly questsEmpty: string;
  readonly questsJobBoards: string;
  readonly questsStoryComplete: string;
  readonly towTravel: string;
  readonly carryTravel: string;
  readonly travelEmpty: string;
  readonly travelHere: string;
  readonly travelUnavailable: string;
  /** "{type} · {distance}". */
  readonly typeLine: string;
  /** Each place type's name on the type line. */
  readonly types: Readonly<Record<MapPlaceType, string>>;
  readonly zoomIn: string;
  readonly zoomOut: string;
}

/** The map's labels from the player strings (gameplay/player-copy.md "Map"). */
export function mapScreenLabels(strings: Readonly<Record<string, string>>): MapScreenLabels {
  const label = (key: string) => strings[key] ?? "";
  return {
    carryTravel: label("carryTravel"),
    centerOnAda: label("mapCenterOnAda"),
    close: label("close"),
    distance: label("mapDistance"),
    distanceOne: label("mapDistanceOne"),
    galaxies: label("galaxies"),
    jobObjective: label("jobObjective"),
    map: label("map"),
    mapPercent: label("mapPercent"),
    quests: label("quests"),
    questsEmpty: label("questsEmpty"),
    questsJobBoards: label("questsJobBoards"),
    questsStoryComplete: label("questsStoryComplete"),
    towTravel: label("towTravel"),
    travelEmpty: label("travelEmpty"),
    travelHere: label("travelHere"),
    travelUnavailable: label("travelUnavailable"),
    typeLine: label("mapTypeLine"),
    types: {
      beacon: label("mapKindBeacon"),
      holodisk: label("mapKindHolodisk"),
      nebula: label("mapKindNebula"),
      outpost: label("mapKindOutpost"),
      station: label("mapKindStation"),
      story: label("mapKindStory"),
      wreck: label("mapKindWreck"),
    },
    zoomIn: label("mapZoomIn"),
    zoomOut: label("mapZoomOut"),
  };
}

/** The galaxy's field: its name, background and fog colours. */
export interface MapField {
  readonly background: string;
  readonly fog: string;
  readonly name: string;
}

export interface MapScreenState {
  readonly field: MapField | null;
  readonly inDanger: boolean;
  /** The held station job's objective, or null without one. */
  readonly job: string | null;
  readonly map: GalaxyMap;
  readonly towing: boolean;
  /** A job item is aboard, which refuses Travel here as towing does. */
  readonly carrying: boolean;
}

export interface MapScreenOptions {
  readonly labels: MapScreenLabels;
  readonly onClose: () => void;
  /** Galaxies: the galaxy map; refused in danger, never while towing (pause.ts galaxiesAvailable). */
  readonly onGalaxies: () => void;
  readonly onTravel: (destination: string) => void;
  readonly reducedMotion: () => boolean;
}

/**
 * Travel here for a place: offered only by destinations and stations, refused in danger, while
 * towing and while carrying a job item, with the one reason line that shows. The danger reason
 * shows in every state, since Galaxies refuses in danger too; the others only beside Travel here.
 */
export function travelState(
  inDanger: boolean,
  towing: boolean,
  carrying: boolean,
  place: Pick<MapPlace, "travel"> | null,
): { readonly offered: boolean; readonly reason: "carrying" | "danger" | "towing" | null } {
  const offered = Boolean(place?.travel);
  return {
    offered,
    reason: inDanger
      ? "danger"
      : offered && towing
        ? "towing"
        : offered && carrying
          ? "carrying"
          : null,
  };
}

/**
 * A distance in world units as the type line's light-years of 1000 units: one decimal below 10,
 * whole numbers from 10, en-US grouping, and the singular when it rounds to 1.
 */
export function mapDistance(
  labels: Pick<MapScreenLabels, "distance" | "distanceOne">,
  units: number,
): string {
  const tenths = Math.round(units / 100);
  if (tenths === 10) {
    return labels.distanceOne;
  }
  const value =
    tenths < 100
      ? (tenths / 10).toLocaleString("en-US", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })
      : Math.round(units / 1000).toLocaleString("en-US");
  return labels.distance.replace("{distance}", value);
}

/**
 * The panel's text block under a place's name: its type line with the distance from Ada, then the
 * held job's line when the place is the job's target. A job's own spot is named by the job and
 * has neither.
 */
export function placeLines(
  labels: Pick<MapScreenLabels, "distance" | "distanceOne" | "jobObjective" | "typeLine" | "types">,
  from: Vec,
  job: string | null,
  place: MapPlace,
): string[] {
  const type = placeType(place);
  if (type === null) {
    return [];
  }
  const distance = mapDistance(labels, Math.hypot(place.x - from.x, place.y - from.y));
  const lines = [
    labels.typeLine.replace("{type}", labels.types[type]).replace("{distance}", distance),
  ];
  if (place.job && job !== null) {
    lines.push(labels.jobObjective.replace("{objective}", job));
  }
  return lines;
}

/** The panel's height holding the empty note, and the reason below it while one shows: 52 or 80. */
export function emptyPanelHeight(reason: boolean): number {
  const { padding, reasonGap } = MAP_PANEL;
  const line = TYPE.body.lineHeight;
  return 2 * padding + line + (reason ? reasonGap + line : 0);
}

/**
 * The panel's height: its row, which grows past 48 for a third text line, and the reason line
 * while one shows. lines counts the name; 0 is the reason-only panel, with no row (52).
 */
export function panelHeight(reason: boolean, lines = 2): number {
  const { padding, reasonGap, row, textTop } = MAP_PANEL;
  const reasonLine = reason ? TYPE.body.lineHeight : 0;
  if (lines === 0) {
    return 2 * padding + reasonLine;
  }
  const text = 2 * textTop + lines * TYPE.body.lineHeight;
  return 2 * padding + Math.max(row, text) + (reason ? reasonGap + reasonLine : 0);
}

export const MAP_SCREEN_STYLE = `
.ada-controls .ada-map-screen{
  position:absolute;
  inset:0;
  overflow:hidden;
  pointer-events:auto;
  touch-action:none;
  background:var(--map-field,#101010)
}
.ada-controls .ada-map-screen[hidden]{
  display:none
}
.ada-controls .ada-map-fog{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  pointer-events:none
}
/* Draw order: field, fog, chips, Ada, then the header, tools and panel. Each layer is its own
   stacking context, so a selected chip's raise never reaches above Ada or the chrome. */
.ada-controls .ada-map-places,
.ada-controls .ada-map-ada{
  position:absolute;
  inset:0;
  pointer-events:none
}
.ada-controls .ada-map-places{
  z-index:0
}
.ada-controls .ada-map-ada{
  z-index:1
}
.ada-controls .ada-map-hud-row,
.ada-controls .ada-map-tools,
.ada-controls .ada-map-panel{
  z-index:2
}

/* A place's chip: its face, an ink edge inside it and its ink glyph; the press area is the
   screen's (pressedArea), so the button itself takes no pointer. */
.ada-controls .ada-map-screen .ada-map-place{
  position:absolute;
  box-sizing:border-box;
  width:${units(MAP_SYMBOL.chip)};
  height:${units(MAP_SYMBOL.chip)};
  min-width:0;
  min-height:0;
  margin:0;
  padding:0;
  display:grid;
  place-items:center;
  border:0;
  border-radius:50%;
  background:var(--face);
  box-shadow:inset 0 0 0 ${units(MAP_SYMBOL.edge)} ${MAP_COLORS.ink};
  color:${MAP_COLORS.ink};
  pointer-events:none
}
.ada-controls .ada-map-screen .ada-map-place::before{
  content:"";
  width:${units(MAP_SYMBOL.glyph)};
  height:${units(MAP_SYMBOL.glyph)};
  background:currentColor;
  -webkit-mask:var(--glyph) center / 100% 100% no-repeat;
  mask:var(--glyph) center / 100% 100% no-repeat
}
/* A held activity's own spot has no job type: its orange chip carries no glyph. */
.ada-controls .ada-map-screen .ada-map-place[data-kind="job"]:not([data-job-type])::before{
  content:none
}
/* Selected: the cream ring with an ink fringe on each side, outside the face. */
.ada-controls .ada-map-screen .ada-map-place[aria-pressed="true"]::after{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:${units(2 * (MAP_SYMBOL.ring.radius + MAP_SYMBOL.ring.band / 2))};
  height:${units(2 * (MAP_SYMBOL.ring.radius + MAP_SYMBOL.ring.band / 2))};
  box-sizing:border-box;
  transform:translate(-50%, -50%);
  border:${units(MAP_SYMBOL.ring.band)} solid ${MAP_COLORS.cream};
  border-radius:50%;
  box-shadow:0 0 0 ${units(MAP_SYMBOL.ring.fringe)} ${MAP_COLORS.ink},inset 0 0 0 ${units(
    MAP_SYMBOL.ring.fringe,
  )} ${MAP_COLORS.ink}
}
.ada-controls .ada-map-screen .ada-map-place[aria-pressed="true"]{
  z-index:2
}
.ada-controls .ada-map-screen .ada-map-place:focus-visible{
  outline:${units(FOCUS_RING.band)} solid ${MAP_COLORS.cream};
  outline-offset:${units(FOCUS_RING.fringe)}
}
.ada-controls .ada-map-screen .ada-map-objective{
  position:absolute;
  left:50%;
  top:50%;
  width:${units(MAP_SYMBOL.objective.box.width)};
  height:${units(MAP_SYMBOL.objective.box.height)};
  transform:translate(-50%, ${units(-MAP_SYMBOL.objective.box.top)});
  overflow:visible;
  pointer-events:none
}
.ada-controls .ada-map-ada svg{
  position:absolute;
  transform-origin:50% 50%;
  width:${units(MAP_SYMBOL.ada.size)};
  height:${units(MAP_SYMBOL.ada.size)};
  overflow:visible
}

/* The HUD row, on the tool targets' row box (layout/mapScreen.ts mapRowTop), from the HUD rect's
   left to SMALL_BUTTON_GAP short of the close tool's disc (mapEarthRect): the header on its left,
   SPACING.gap from Quests, which caps it (mapHeaderCap), then Quests and Galaxies,
   secondary text buttons MAP_SCREEN.hudRow sets, hudRow.gap apart, on its right. */
.ada-controls .ada-map-hud-row{
  position:absolute;
  left:var(${VIEW_PROPERTIES.hud("left")});
  top:${fromHudEdge("top", -HUD_ROW.reach)};
  right:${fromHudEdge("right", MAP_SCREEN.hudRow.right)};
  height:${units(MAP_SCREEN.header.height)};
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:${units(SPACING.gap)};
  pointer-events:none
}
.ada-controls .ada-map-hud-row .ada-button{
  flex:none;
  box-sizing:border-box;
  height:${units(MAP_SCREEN.hudRow.height)};
  padding-left:0;
  padding-right:0;
  white-space:nowrap;
  pointer-events:auto
}
.ada-controls .ada-map-hud-row [data-action="map-quests"]{
  margin-left:auto;
  width:${units(MAP_SCREEN.hudRow.quests.width)}
}
.ada-controls .ada-map-hud-row [data-action="map-galaxies"]{
  margin-left:${units(MAP_SCREEN.hudRow.gap - SPACING.gap)};
  width:${units(MAP_SCREEN.hudRow.earth.width)}
}

/* The header: one ink panel with the galaxy name, a divider, then the column of one pip per
   landmark over the percent mapped. It takes no input. */
.ada-controls .ada-map-header{
  min-width:0;
  overflow:hidden;
  box-sizing:border-box;
  height:${units(MAP_SCREEN.header.height)};
  padding:0 ${units(MAP_SCREEN.header.padding)};
  display:flex;
  align-items:center;
  border-radius:${units(MAP_SCREEN.header.radius)};
  background:rgba(24,20,37,${MAP_SCREEN.header.alpha});
  pointer-events:none;
  white-space:nowrap
}
.ada-controls .ada-map-galaxy{
  font:${font(TYPE.heading)};
  color:${TEXT_TOKENS.title}
}
.ada-controls .ada-map-divider{
  width:${units(MAP_SCREEN.header.divider.width)};
  height:${units(MAP_SCREEN.header.divider.height)};
  margin:0 ${units(MAP_SCREEN.header.dividerGap)};
  background:${MAP_COLORS.divider}
}
/* The column tops at stackTop, the pips stackGap over the percent; with no landmarks the percent
   alone tops at labelTop. */
.ada-controls .ada-map-column{
  align-self:flex-start;
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:${units(MAP_SCREEN.header.stackGap)};
  padding-top:${units(MAP_SCREEN.header.stackTop)}
}
.ada-controls .ada-map-column:has(.ada-map-pips:empty){
  padding-top:${units(MAP_SCREEN.header.labelTop)}
}
.ada-controls .ada-map-percent{
  font:${font(TYPE.label)};
  color:${MAP_COLORS.cream}
}
.ada-controls .ada-map-pips{
  display:flex;
  gap:${units(MAP_SCREEN.header.pipPitch - MAP_SCREEN.header.pip)}
}
.ada-controls .ada-map-pips:empty{
  display:none
}
.ada-controls .ada-map-pip{
  box-sizing:border-box;
  width:${units(MAP_SCREEN.header.pip)};
  height:${units(MAP_SCREEN.header.pip)};
  border-radius:50%;
  border:${units(MAP_SCREEN.header.pipRing)} solid ${MAP_COLORS.supporting}
}
.ada-controls .ada-map-pip[data-charted]{
  border-color:${MAP_COLORS.cream};
  background:${MAP_COLORS.cream}
}

/* The tools: HUD disc buttons in a column on the HUD rect's top-right corner, reaching
   HUD_ROW.reach past it so the discs' drawn right edges and the top disc's drawn top sit on it. */
.ada-controls .ada-map-tools{
  position:absolute;
  right:${fromHudEdge("right", -HUD_ROW.reach)};
  top:${fromHudEdge("top", -HUD_ROW.reach)};
  display:flex;
  flex-direction:column;
  gap:${units(MAP_SCREEN.tools.pitch - TEXT_BUTTON.height)}
}
${hudDiscStyle(".ada-controls .ada-map-tool", ".ada-disc")}
.ada-controls .ada-map-tool[data-tool="close"]{
  color:${MAP_COLORS.cream}
}

/* The Quests modal (art/map.md "Quests modal"): the standard card under the modal dim, which
   covers the whole map. Its lines stack lineGap apart across the inner width: a mapped line is a
   secondary button with its target's chip, overhanging the label's line box, markGap before the
   label; a plain line is supporting prose from the text column, with a hollow ring in the chip
   slot while its target is unmapped; with no lines, the centred empty note. */
.ada-controls .ada-map-quests{
  z-index:3
}
.ada-controls .ada-map-quest-lines{
  align-self:stretch;
  display:flex;
  flex-direction:column;
  gap:${units(MAP_SCREEN.quests.lineGap)}
}
.ada-controls .ada-map-quest-lines .ada-button.ada-map-quest{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:${units(MAP_SCREEN.quests.markGap)};
  text-align:left;
  white-space:normal;
  font:${font(TYPE.label)}
}
.ada-controls .ada-map-quest .ada-map-place{
  position:relative;
  flex:none;
  margin:${units(-MAP_SCREEN.quests.overhang)} 0
}
.ada-controls .ada-map-quest-text,
.ada-controls .ada-map-quest-empty{
  position:relative;
  margin:0;
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.supporting}
}
.ada-controls .ada-map-quest-text{
  padding-left:${units(MAP_SCREEN.quests.textColumn)}
}
.ada-controls .ada-map-quest-text[data-ring]::before{
  content:"";
  position:absolute;
  left:${units(TEXT_BUTTON.inset)};
  top:50%;
  box-sizing:border-box;
  width:${units(MAP_SCREEN.quests.chip)};
  height:${units(MAP_SCREEN.quests.chip)};
  transform:translateY(-50%);
  border:${units(MAP_SCREEN.quests.ring)} solid ${MAP_COLORS.supporting};
  border-radius:50%
}
.ada-controls .ada-map-quest-empty{
  text-align:center
}

/* The place panel: a card face with no close X, centred in the page safe rect on its bottom. */
.ada-controls .ada-map-panel{
  position:absolute;
  left:calc((${safeEdge("left", SAFE_MARGIN.page)} + 100% - ${safeEdge(
    "right",
    SAFE_MARGIN.page,
  )}) / 2);
  bottom:${safeEdge("bottom", SAFE_MARGIN.page)};
  transform:translateX(-50%);
  box-sizing:border-box;
  /* Its own text width: shrink-to-fit would stop at the half view right of a centred left. */
  width:max-content;
  min-width:${units(MAP_PANEL.minWidth)};
  padding:calc(${units(MAP_PANEL.padding)} - ${slice(CARD_SLICE)});
  display:grid;
  gap:${units(MAP_PANEL.reasonGap)};
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.supporting};
  background:#3b3850;
  border:${slice(CARD_SLICE)} solid #6b6685;
  border-image:url('/art/ui/sprites/ui-settings-card.png') ${CARD_SLICE} fill / ${slice(
    CARD_SLICE,
  )} stretch;
  image-rendering:pixelated;
  pointer-events:auto
}
.ada-controls .ada-map-panel[hidden]{
  display:none
}
.ada-controls .ada-map-row{
  min-height:${units(MAP_PANEL.row)};
  display:flex;
  align-items:center;
  gap:${units(MAP_PANEL.markGap)}
}
/* The reason-only and empty panels hold no row. */
.ada-controls .ada-map-row[hidden]{
  display:none
}
.ada-controls .ada-map-row .ada-map-place{
  position:relative;
  flex:none
}
.ada-controls .ada-map-text{
  flex:1;
  min-width:0;
  display:grid;
  padding:${units(MAP_PANEL.textTop)} 0;
  margin-right:${units(MAP_PANEL.actionGap - MAP_PANEL.markGap)}
}
.ada-controls .ada-map-name{
  font:${font(TYPE.label)};
  color:${MAP_COLORS.cream}
}
.ada-controls .ada-map-row .ada-button{
  flex:none
}
/* Every reason shares one cell, so the panel keeps the widest reason's width in every state. */
.ada-controls .ada-map-reason{
  display:grid;
  text-align:left
}
.ada-controls .ada-map-reason > span{
  grid-area:1 / 1
}
.ada-controls .ada-map-reason > span:not([data-shown]){
  visibility:hidden
}
.ada-controls .ada-map-reason:not(:has([data-shown])){
  display:none
}
.ada-controls .ada-map-empty{
  margin:0;
  text-align:center
}
`;

// The objective's indicator, in px around the chip centre: the flight's arrow pointing down at
// the chip, and its circle above it (art/map.md "Symbols").
function objectiveIndicator(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "ada-map-objective");
  svg.setAttribute("viewBox", "-8 -48 16 28");
  svg.setAttribute("aria-hidden", "true");
  const { ink, stroke, tip } = MAP_SYMBOL.objective;
  for (const [color, width] of [
    [MAP_COLORS.ink, ink],
    [MAP_COLORS.objective, stroke],
  ] as const) {
    const arrow = document.createElementNS(ns, "path");
    arrow.setAttribute("d", `M0 ${-tip} L5 -36 L-5 -36 Z`);
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "-44");
    circle.setAttribute("r", "3");
    for (const shape of [arrow, circle]) {
      shape.setAttribute("fill", "none");
      shape.setAttribute("stroke", color);
      shape.setAttribute("stroke-width", String(width));
      shape.setAttribute("stroke-linejoin", "round");
      svg.append(shape);
    }
  }
  return svg;
}

// Ada's arrow in its 28 box, nose toward +x: the white hull over its ink keyline and the canopy.
function adaArrow(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 28 28");
  svg.setAttribute("aria-hidden", "true");
  const hull = document.createElementNS(ns, "path");
  hull.setAttribute("d", "M24.5 14 L5.5 4.2 L9.6 14 L5.5 23.8 Z");
  hull.setAttribute("fill", MAP_COLORS.hull);
  hull.setAttribute("stroke", MAP_COLORS.ink);
  hull.setAttribute("stroke-width", String(2 * MAP_SYMBOL.ada.keyline));
  hull.setAttribute("stroke-linejoin", "round");
  hull.setAttribute("paint-order", "stroke");
  const canopy = document.createElementNS(ns, "ellipse");
  canopy.setAttribute("cx", "15.2");
  canopy.setAttribute("cy", "14");
  canopy.setAttribute("rx", "4.2");
  canopy.setAttribute("ry", "2.7");
  canopy.setAttribute("fill", MAP_COLORS.canopy);
  canopy.setAttribute("stroke", MAP_COLORS.ink);
  canopy.setAttribute("stroke-width", "0.8");
  svg.append(hull, canopy);
  return svg;
}

// A place's chip node: its face, glyph, kind and marks.
/** A chip's face colour: main's orange for a held job's target or spot, else its symbol's face. */
export function chipFace(place: Pick<MapPlace, "job" | "symbol">): string {
  return place.job ? MAP_JOB_FACE : MAP_FACES[place.symbol];
}

/** A chip's glyph: a held job's own spot takes its job type's, every other place its symbol's. */
export function chipGlyph(place: Pick<MapPlace, "jobType" | "symbol">): string | null {
  return place.jobType ? `map-job-${place.jobType}` : MAP_GLYPHS[place.symbol];
}

function dressChip(chip: HTMLElement, place: MapPlace): void {
  chip.className = "ada-map-place";
  chip.dataset.place = place.id;
  chip.dataset.kind = place.kind;
  chip.dataset.symbol = place.symbol;
  chip.style.setProperty("--face", chipFace(place));
  // A held job's own spot takes its job type's glyph (art/map.md "Symbols").
  const glyph = chipGlyph(place);
  if (place.jobType) {
    chip.dataset.jobType = place.jobType;
  } else {
    delete chip.dataset.jobType;
  }
  if (glyph) {
    chip.style.setProperty("--glyph", `url('${ICONS}${glyph}.svg')`);
  } else {
    chip.style.removeProperty("--glyph");
  }
  chip.toggleAttribute("data-job", place.job);
  chip.toggleAttribute("data-objective", place.objective);
}

// The Map's search area tokens (art/map.md "Search area"), from public/art/jobs.json.
const MAP_AREA = readMapArea(JOBS);

/**
 * A held hunt's search area: the 900-unit world circle projected to an ellipse, an orange dash over
 * an ink dash on the same path, over the fog and under every chip, hidden while it is smaller than
 * the selection ring. Sizes are logical px, `px` canvas px each.
 */
function drawSearchArea(
  context: CanvasRenderingContext2D,
  inner: Parameters<typeof toScreen>[0],
  view: MapView,
  map: Pick<GalaxyMap, "searchArea">,
  px: number,
): void {
  const area = map.searchArea;
  if (!area || !MAP_AREA) {
    return;
  }
  const rx = area.radius * Math.SQRT2 * view.scale;
  if (rx < MAP_AREA.minRadius) {
    return;
  }
  const at = toScreen(inner, view, area);
  context.save();
  context.setLineDash(MAP_AREA.dash.map((length) => length * px));
  context.lineCap = "butt";
  for (const [width, colour] of [
    [MAP_AREA.ink, MAP_COLORS.ink],
    [MAP_AREA.width, MAP_AREA.colour],
  ] as const) {
    context.lineWidth = width * px;
    context.strokeStyle = colour;
    context.beginPath();
    context.ellipse(at.x * px, at.y * px, rx * px, (rx / 2) * px, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

export function createMapScreen(root: HTMLElement, options: MapScreenOptions) {
  const { labels } = options;
  const screen = document.createElement("div");
  screen.className = "ada-map-screen";
  screen.dataset.dialog = "map";
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-label", labels.map);
  screen.hidden = true;
  const fog = document.createElement("canvas");
  fog.className = "ada-map-fog";
  fog.setAttribute("aria-hidden", "true");
  const placesLayer = document.createElement("div");
  placesLayer.className = "ada-map-places";
  const adaLayer = document.createElement("div");
  adaLayer.className = "ada-map-ada";
  const ada = adaArrow();
  adaLayer.append(ada);
  // The header.
  const header = document.createElement("div");
  header.className = "ada-map-header";
  const galaxy = document.createElement("span");
  galaxy.className = "ada-map-galaxy";
  const divider = document.createElement("span");
  divider.className = "ada-map-divider";
  divider.setAttribute("aria-hidden", "true");
  const percent = document.createElement("span");
  percent.className = "ada-map-percent";
  const pips = document.createElement("span");
  pips.className = "ada-map-pips";
  pips.setAttribute("aria-hidden", "true");
  const column = document.createElement("span");
  column.className = "ada-map-column";
  column.append(pips, percent);
  header.append(galaxy, divider, column);
  // The tools.
  const tools = document.createElement("div");
  tools.className = "ada-map-tools";
  const toolLabels: Record<MapTool, string> = {
    close: labels.close,
    recentre: labels.centerOnAda,
    zoomIn: labels.zoomIn,
    zoomOut: labels.zoomOut,
  };
  const toolButtons = new Map<MapTool, HTMLButtonElement>();
  for (const { glyph, id } of MAP_TOOLS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ada-map-tool";
    button.dataset.tool = id;
    button.dataset.action = `map-${id}`;
    button.setAttribute("aria-label", toolLabels[id]);
    const disc = document.createElement("span");
    disc.className = "ada-disc";
    disc.style.setProperty("--glyph", `url('${ICONS}${glyph}.svg')`);
    button.append(disc);
    toolButtons.set(id, button);
    tools.append(button);
  }
  // The place panel.
  const panel = document.createElement("div");
  panel.className = "ada-map-panel";
  panel.hidden = true;
  const row = document.createElement("div");
  row.className = "ada-map-row";
  const panelChip = document.createElement("span");
  panelChip.setAttribute("aria-hidden", "true");
  const text = document.createElement("div");
  text.className = "ada-map-text";
  const name = document.createElement("span");
  name.className = "ada-map-name";
  const detail = [document.createElement("span"), document.createElement("span")];
  for (const line of detail) {
    line.className = "ada-map-detail";
  }
  text.append(name, ...detail);
  const travel = createButton(labels.travelHere, "primary");
  travel.dataset.action = "map-travel";
  row.append(panelChip, text, travel);
  const reason = document.createElement("div");
  reason.className = "ada-map-reason";
  const reasons = {
    carrying: document.createElement("span"),
    danger: document.createElement("span"),
    towing: document.createElement("span"),
  };
  reasons.danger.textContent = labels.travelUnavailable;
  reasons.towing.textContent = labels.towTravel;
  reasons.carrying.textContent = labels.carryTravel;
  reason.append(reasons.danger, reasons.towing, reasons.carrying);
  const empty = document.createElement("p");
  empty.className = "ada-map-empty";
  empty.textContent = labels.travelEmpty;
  panel.append(row, reason, empty);
  // Quests, then Galaxies, on the HUD row; Galaxies opens the galaxy map with no confirm, as for
  // Travel here.
  const hudRow = document.createElement("div");
  hudRow.className = "ada-map-hud-row";
  const questsButton = createButton(labels.quests, "secondary");
  questsButton.dataset.action = "map-quests";
  questsButton.setAttribute("aria-haspopup", "dialog");
  const galaxies = createButton(labels.galaxies, "secondary");
  galaxies.dataset.action = "map-galaxies";
  galaxies.setAttribute("aria-haspopup", "dialog");
  hudRow.append(header, questsButton, galaxies);
  // The Quests modal over the whole map.
  const questsModal = document.createElement("div");
  questsModal.className = "ada-modal ada-map-quests";
  questsModal.hidden = true;
  const questsCard = createCard({
    closeAction: "close-quests",
    closeLabel: labels.close,
    title: labels.quests,
  });
  questsCard.card.dataset.dialog = "quests";
  const questLines = document.createElement("div");
  questLines.className = "ada-map-quest-lines";
  questLines.dataset.inkTop = "0";
  questsCard.body.append(questLines);
  questsModal.append(questsCard.frame);
  screen.append(fog, placesLayer, adaLayer, hudRow, tools, panel, questsModal);
  root.append(screen);

  let state: MapScreenState | null = null;
  let view: MapView | null = null;
  let selected: string | null = null;
  const chips = new Map<string, HTMLButtonElement>();
  let order = "";

  // The logical view and insets the screen lays out against.
  const layout = () => {
    const unit = readViewUnit(screen);
    const style = getComputedStyle(screen);
    const inset = (side: "bottom" | "left" | "right" | "top") =>
      (parseFloat(style.getPropertyValue(VIEW_PROPERTIES.safe(side))) || 0) / unit;
    const insets = {
      bottom: inset("bottom"),
      left: inset("left"),
      right: inset("right"),
      top: inset("top"),
    };
    const size = { height: screen.clientHeight / unit, width: screen.clientWidth / unit };
    const fit = fitRegion(insets, size);
    return { fit, inner: innerRegion(fit), insets, size, unit };
  };
  const places = () => state?.map.places ?? [];
  const selectedPlace = () => places().find(({ id }) => id === selected) ?? null;
  const travelNow = () =>
    travelState(
      state?.inDanger ?? false,
      state?.towing ?? false,
      state?.carrying ?? false,
      selectedPlace(),
    );
  const detailLines = (place: MapPlace) =>
    state ? placeLines(labels, state.map.player, state.job, place) : [];
  // The panel shows for a selected place, with nothing mapped, or for a reason alone.
  const panelShown = () =>
    selectedPlace() !== null || mapShowsEmpty(places()) || travelNow().reason !== null;
  // The panel's top, while it shows: the page safe rect's bottom less its height, as rendered
  // once its text is in, so a wrapped name or Job line counts; panelHeight before it lays out.
  const panelTop = (
    size: { height: number },
    insets: { bottom: number },
    unit: number,
  ): number | null => {
    if (!panelShown()) {
      return null;
    }
    const bottom = size.height - Math.max(SAFE_MARGIN.page, insets.bottom);
    const measured = panel.hidden ? 0 : panel.offsetHeight / unit;
    if (measured > 0) {
      return bottom - measured;
    }
    const place = selectedPlace();
    const reason = travelNow().reason !== null;
    if (!place && mapShowsEmpty(places())) {
      return bottom - emptyPanelHeight(reason);
    }
    return bottom - panelHeight(reason, place ? 1 + detailLines(place).length : 0);
  };

  const drawFog = (inner: Rect, unit: number, current: MapView) => {
    const map = state?.map;
    const context = fog.getContext("2d");
    const width = Math.round(screen.clientWidth * devicePixelRatio);
    const height = Math.round(screen.clientHeight * devicePixelRatio);
    if (fog.width !== width || fog.height !== height) {
      fog.width = width;
      fog.height = height;
    }
    if (!context || !map) {
      return;
    }
    context.clearRect(0, 0, width, height);
    const px = unit * devicePixelRatio;
    // No explored record: the plain field and no fog.
    if (map.explored.length > 0 && state?.field) {
      fogOver(context, inner, current, map, px, state.field.fog, width, height);
    }
    drawSearchArea(context, inner, current, map, px);
  };

  // The fog over the field, with every explored centre, place and Ada revealed.
  const fogOver = (
    context: CanvasRenderingContext2D,
    inner: Parameters<typeof toScreen>[0],
    current: MapView,
    map: GalaxyMap,
    px: number,
    colour: string,
    width: number,
    height: number,
  ) => {
    const { rx, ry, sigma } = fogReveal(current.scale);
    context.globalCompositeOperation = "source-over";
    context.filter = "none";
    context.fillStyle = colour;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-out";
    context.filter = fogBlur(sigma * px);
    context.fillStyle = "#000";
    for (const point of [...map.explored, ...map.places, map.player]) {
      const at = toScreen(inner, current, point);
      context.beginPath();
      context.ellipse(at.x * px, at.y * px, rx * px, ry * px, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.globalCompositeOperation = "source-over";
    context.filter = "none";
  };

  const render = () => {
    if (!state || screen.hidden) {
      return;
    }
    const { inner, unit } = layout();
    if (!view) {
      view = openingView(inner, places(), state.map.player);
    }
    const current = view;
    screen.style.setProperty("--map-field", state.field?.background ?? "");
    // Header.
    galaxy.textContent = state.field?.name ?? "";
    percent.textContent = labels.mapPercent.replace("{percent}", String(state.map.mapped));
    const { charted, total } = state.map.landmarks;
    if (pips.childElementCount !== total || pips.dataset.charted !== String(charted)) {
      pips.dataset.charted = String(charted);
      pips.replaceChildren(
        ...Array.from({ length: total }, (_, index) => {
          const pip = document.createElement("span");
          pip.className = "ada-map-pip";
          pip.toggleAttribute("data-charted", index < charted);
          return pip;
        }),
      );
    }
    // Chips, kept by id and placed in reading order so Tab follows it.
    const shown = places().map((place) => ({ place, ...toScreen(inner, current, place) }));
    const ids = new Set(shown.map(({ place }) => place.id));
    for (const [id, chip] of chips) {
      if (!ids.has(id)) {
        chip.remove();
        chips.delete(id);
      }
    }
    for (const { place, x, y } of shown) {
      let chip = chips.get(place.id);
      if (!chip) {
        chip = document.createElement("button");
        chip.type = "button";
        const id = place.id;
        chip.addEventListener("click", () => select(id));
        chip.addEventListener("focus", () => {
          if (view && state) {
            const target = places().find((entry) => entry.id === id);
            const { fit: region, inner: room, insets, size, unit } = layout();
            if (target) {
              view = keepClear(region, room, panelTop(size, insets, unit), target, view);
              render();
            }
          }
        });
        chips.set(id, chip);
      }
      dressChip(chip, place);
      chip.setAttribute("aria-label", place.label);
      chip.setAttribute("aria-pressed", String(place.id === selected));
      chip.style.left = units(x - MAP_SYMBOL.chip / 2);
      chip.style.top = units(y - MAP_SYMBOL.chip / 2);
      // Landmarks draw under the other chips; later places in the map's order draw on top.
      chip.style.zIndex = place.kind === "landmark" ? "0" : "1";
      const indicator = chip.querySelector(".ada-map-objective");
      if (place.objective && !indicator) {
        chip.append(objectiveIndicator());
      } else if (!place.objective && indicator) {
        indicator.remove();
      }
    }
    const reading = readingOrder(shown).map(({ place }) => place.id);
    if (reading.join("\n") !== order) {
      order = reading.join("\n");
      placesLayer.replaceChildren(...reading.map((id) => chips.get(id)!));
    }
    // Ada.
    const at = toScreen(inner, current, state.map.player);
    ada.style.left = units(at.x - MAP_SYMBOL.ada.size / 2);
    ada.style.top = units(at.y - MAP_SYMBOL.ada.size / 2);
    ada.style.transform = `rotate(${adaAngle(state.map.facing)}rad)`;
    dressPanel();
    drawFog(inner, unit, current);
  };

  // The panel's content and width for the selection.
  const dressPanel = () => {
    const { insets, size } = layout();
    panel.style.maxWidth = units(panelMaxWidth(insets, size));
    const place = selectedPlace();
    const travelling = travelNow();
    panel.hidden = !panelShown();
    row.hidden = place === null;
    empty.hidden = place !== null || !mapShowsEmpty(places());
    if (place) {
      dressChip(panelChip, place);
      name.textContent = place.label;
      const lines = detailLines(place);
      detail.forEach((line, index) => {
        line.textContent = lines[index] ?? "";
        line.hidden = lines[index] === undefined;
      });
      travel.hidden = !travelling.offered;
      travel.classList.toggle("ada-unavailable", travelling.reason !== null);
      if (travelling.reason === null) {
        travel.removeAttribute("aria-disabled");
      } else {
        travel.setAttribute("aria-disabled", "true");
      }
    }
    reasons.danger.toggleAttribute("data-shown", travelling.reason === "danger");
    reasons.towing.toggleAttribute("data-shown", travelling.reason === "towing");
    reasons.carrying.toggleAttribute("data-shown", travelling.reason === "carrying");
    const galaxiesShown = galaxiesAvailable(state?.inDanger ?? false);
    galaxies.classList.toggle("ada-unavailable", !galaxiesShown);
    if (galaxiesShown) {
      galaxies.removeAttribute("aria-disabled");
    } else {
      galaxies.setAttribute("aria-disabled", "true");
    }
  };

  // Selecting pans the chip clear of the panel at once; an empty press clears the selection.
  const select = (id: string | null) => {
    selected = id;
    const place = selectedPlace();
    if (place && view) {
      // The panel takes the new place's text first, so the pan clears its rendered height.
      dressPanel();
      const { fit, inner, insets, size, unit } = layout();
      view = keepClear(fit, inner, panelTop(size, insets, unit), place, view);
    }
    render();
  };

  const limit = () => panLimit(places());
  const zoom = (factor: number, anchor: Point, button?: HTMLButtonElement) => {
    if (!view) {
      return;
    }
    const { inner } = layout();
    const zoomed = zoomView(inner, limit(), factor, anchor, view);
    if (zoomed.refused) {
      if (button) {
        refuse(button, options.reducedMotion());
      }
      return;
    }
    view = zoomed.view;
    render();
  };
  const fitCentre = (): Point => {
    const { fit } = layout();
    return { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 };
  };
  toolButtons.get("close")!.addEventListener("click", () => options.onClose());
  toolButtons
    .get("zoomIn")!
    .addEventListener("click", () =>
      zoom(MAP_SCREEN.zoomStep, fitCentre(), toolButtons.get("zoomIn")),
    );
  toolButtons
    .get("zoomOut")!
    .addEventListener("click", () =>
      zoom(1 / MAP_SCREEN.zoomStep, fitCentre(), toolButtons.get("zoomOut")),
    );
  toolButtons.get("recentre")!.addEventListener("click", () => {
    if (view && state) {
      view = recentreView(layout().inner, limit(), state.map.player, view);
      render();
    }
  });
  travel.addEventListener("click", () => {
    const place = selectedPlace();
    const now = travelNow();
    if (!place || !now.offered) {
      return;
    }
    if (now.reason !== null) {
      refuse(travel, options.reducedMotion());
      return;
    }
    options.onTravel(place.id);
  });
  // The Quests modal: each line, built as it opens; a mapped line's press centres and selects its
  // chip. The X, an outside tap, back and Escape close it, leaving the view and selection.
  const questsOpen = () => !questsModal.hidden;
  const questText = (line: QuestLine): string => {
    if (line.kind === "job") {
      return labels.jobObjective.replace("{objective}", line.text);
    }
    if (line.kind === "story") {
      return line.text;
    }
    return line.kind === "jobBoards" ? labels.questsJobBoards : labels.questsStoryComplete;
  };
  const closeQuests = () => {
    if (questsOpen()) {
      questsModal.hidden = true;
      questsButton.focus();
    }
  };
  const goTo = (place: MapPlace) => {
    closeQuests();
    if (view) {
      view = recentreView(layout().inner, limit(), place, view);
    }
    select(place.id);
    chips.get(place.id)?.focus();
  };
  const openQuests = () => {
    const lines = state?.map.quests ?? [];
    questLines.replaceChildren(
      ...lines.map((line) => {
        const target =
          "target" in line && line.target !== null
            ? places().find(({ id }) => id === line.target)
            : undefined;
        if (target) {
          const button = createButton("", "secondary");
          button.classList.add("ada-map-quest");
          button.dataset.target = target.id;
          const chip = document.createElement("span");
          dressChip(chip, target);
          chip.setAttribute("aria-hidden", "true");
          const label = document.createElement("span");
          label.textContent = questText(line);
          button.replaceChildren(chip, label);
          button.addEventListener("click", () => goTo(target));
          return button;
        }
        const text = document.createElement("p");
        text.className = "ada-map-quest-text ada-prose";
        text.textContent = questText(line);
        text.toggleAttribute("data-ring", "target" in line);
        return text;
      }),
    );
    if (lines.length === 0) {
      const note = document.createElement("p");
      note.className = "ada-map-quest-empty ada-prose";
      note.textContent = labels.questsEmpty;
      questLines.append(note);
    }
    questsModal.hidden = false;
    questsCard.fit();
    (questLines.querySelector<HTMLButtonElement>("button") ?? questsCard.close).focus();
  };
  questsButton.addEventListener("click", openQuests);
  questsCard.close.addEventListener("click", closeQuests);
  // A full outside tap closes it.
  let outside: Point | undefined;
  questsModal.addEventListener("pointerdown", (event) => {
    outside = event.target === questsModal ? { x: event.clientX, y: event.clientY } : undefined;
  });
  questsModal.addEventListener("click", (event) => {
    if (
      outside &&
      event.target === questsModal &&
      isTap(readViewUnit(questsModal), outside, { x: event.clientX, y: event.clientY })
    ) {
      closeQuests();
    }
    outside = undefined;
  });
  galaxies.addEventListener("click", () => {
    if (!galaxiesAvailable(state?.inDanger ?? false)) {
      refuse(galaxies, options.reducedMotion());
      return;
    }
    options.onGalaxies();
  });

  // Field presses: a press within dragThreshold selects what pressedArea gives; more pans; two
  // pointers pinch. The header, tools and panel take their own presses first.
  const pointers = new Map<number, Point>();
  let press: { readonly at: Point; moved: boolean } | null = null;
  let pinch: { distance: number; mid: Point } | null = null;
  const local = (event: PointerEvent | WheelEvent): Point => {
    const box = screen.getBoundingClientRect();
    const unit = readViewUnit(screen);
    return { x: (event.clientX - box.left) / unit, y: (event.clientY - box.top) / unit };
  };
  const onChrome = (event: Event) =>
    event.target instanceof Element &&
    event.target.closest(
      ".ada-map-tools,.ada-map-hud-row .ada-button,.ada-map-panel,.ada-map-quests",
    ) !== null;
  const pinchOf = (): { distance: number; mid: Point } | null => {
    const [a, b] = [...pointers.values()];
    return a && b
      ? {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        }
      : null;
  };
  screen.addEventListener("pointerdown", (event) => {
    if (onChrome(event)) {
      return;
    }
    const at = local(event);
    pointers.set(event.pointerId, at);
    screen.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1) {
      press = { at, moved: false };
    } else {
      press = null;
      pinch = pinchOf();
    }
  });
  screen.addEventListener("pointermove", (event) => {
    const before = pointers.get(event.pointerId);
    if (!before || !view) {
      return;
    }
    const at = local(event);
    pointers.set(event.pointerId, at);
    const { inner } = layout();
    if (pointers.size >= 2) {
      const next = pinchOf();
      if (pinch && next && pinch.distance > 0) {
        const zoomed = zoomView(inner, limit(), next.distance / pinch.distance, next.mid, view);
        view = panView(
          inner,
          limit(),
          { x: next.mid.x - pinch.mid.x, y: next.mid.y - pinch.mid.y },
          zoomed.view,
        );
        render();
      }
      pinch = next;
      return;
    }
    if (
      press &&
      !press.moved &&
      Math.hypot(at.x - press.at.x, at.y - press.at.y) > MAP_SCREEN.dragThreshold
    ) {
      press.moved = true;
    }
    if (press?.moved) {
      view = panView(inner, limit(), { x: at.x - before.x, y: at.y - before.y }, view);
      render();
    }
  });
  const release = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) {
      return;
    }
    if (pointers.size < 2) {
      pinch = null;
    }
    if (event.type === "pointerup" && press && !press.moved && pointers.size === 0 && view) {
      const { inner } = layout();
      const current = view;
      const areas: PressArea<string>[] = places().map((place) => {
        const art = chipRect(toScreen(inner, current, place));
        return { art, hit: hitAround(HIT_RULE, art), key: place.id };
      });
      // Exact ties go to the chip drawn on top: the later one in the map's order.
      select(pressedArea([...areas].reverse(), press.at) ?? null);
    }
    if (pointers.size === 0) {
      press = null;
    }
  };
  screen.addEventListener("pointerup", release);
  screen.addEventListener("pointercancel", release);
  screen.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      if (questsOpen()) {
        return;
      }
      const delta =
        event.deltaMode === 1 ? (event.deltaY * MAP_SCREEN.wheelStep) / 3 : event.deltaY;
      zoom(MAP_SCREEN.zoomStep ** (-delta / MAP_SCREEN.wheelStep), local(event));
    },
    { passive: false },
  );
  // Tab stays on the screen in art/map.md's order: the tools, Quests, Galaxies, the places
  // in reading order, then Travel here; on the Quests card, its line buttons then its X. It wraps
  // at either end.
  screen.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }
    const order = questsOpen()
      ? [...questLines.querySelectorAll<HTMLButtonElement>("button"), questsCard.close]
      : [
          ...tools.querySelectorAll<HTMLButtonElement>("button"),
          questsButton,
          galaxies,
          ...placesLayer.querySelectorAll<HTMLButtonElement>("button"),
          travel,
        ];
    const targets = order.filter((button) => !button.closest("[hidden]") && !button.hidden);
    if (targets.length === 0) {
      return;
    }
    event.preventDefault();
    const at = targets.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.shiftKey ? -1 : 1;
    const next = at < 0 ? (event.shiftKey ? targets.length - 1 : 0) : at + step;
    targets[(next + targets.length) % targets.length]!.focus();
  });
  const refit = () => {
    if (!screen.hidden && view) {
      const { inner } = layout();
      view = clampView(inner, limit(), view);
      render();
    }
  };
  window.addEventListener("resize", refit);

  return {
    close(): void {
      questsModal.hidden = true;
      screen.hidden = true;
      selected = null;
      view = null;
      pointers.clear();
      press = null;
    },
    /** Closes the Quests modal, back to the map. */
    closeQuests,
    dispose(): void {
      window.removeEventListener("resize", refit);
      questsCard.dispose();
      screen.remove();
    },
    element: screen,
    /** Focuses Galaxies, as the galaxy map it opened closes back to the local map. */
    focusGalaxies(): void {
      galaxies.focus();
    },
    isOpen: () => !screen.hidden,
    /** Opens at the opening fit with nothing selected, focus on close. */
    open(): void {
      screen.hidden = false;
      selected = null;
      view = null;
      render();
      toolButtons.get("close")!.focus();
    },
    questsOpen,
    setState(next: MapScreenState): void {
      state = next;
      if (selected !== null && !places().some(({ id }) => id === selected)) {
        selected = null;
      }
      render();
    },
  };
}
