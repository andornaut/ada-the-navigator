import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import {
  HIT_RULE,
  hitAround,
  type PressArea,
  pressedArea,
} from "@andornaut/game-kit/runtime/ui/hitAreas";
import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import JOBS from "../../public/art/jobs.json" with { type: "json" };
import { readMapArea } from "../art/index.ts";
import { BALANCE, HUD_BUTTON } from "../data/layout.ts";
import { canAffordMapJump, MAP_JUMP_COST, travelState } from "../data/mapJump.ts";
import { TASK_COLORS } from "../data/taskCategories.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "../model/flightTopology.ts";
import { type LocalMap, type MapPlace, type MapPlaceType, placeType } from "../model/map.ts";
import { shipHeading } from "../model/nose.ts";
import type { Vec } from "../model/types.ts";
import { nearestImage } from "../model/worldGeometry.ts";
import {
  type AdaActionOptions,
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { COLOURS, UNLISTED_COLOURS } from "./layout/colours.ts";
import { BUTTON_SLICE, CARD_SLICE } from "./layout/controls.ts";
import {
  COMPACT_VIEWPORT,
  font,
  pixels,
  safeEdge,
  slice,
  units,
  VIEW_PROPERTIES,
} from "./layout/css.ts";
import { frameBoxIn, framePoint, frameSize, turnOf } from "./layout/frameBox.ts";
import {
  chipRect,
  clampView,
  COMPACT_MAP_HEADER_TOP,
  filledPips,
  fitRegion,
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
  mapGlyphSize,
  mapHeaderGeometry,
  mapHeaderLeft,
  mapHeaderWidthForView,
  type MapTool,
  type MapView,
  mapWorldDiamond,
  openingView,
  panelMaxWidth,
  panView,
  type Point,
  readingOrder,
  recentreView,
  selectedPanelMaxHeight,
  toScreen,
  zoomView,
} from "./layout/mapScreen.ts";
import { SAFE_MARGIN, safeRect } from "./layout/playView.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import {
  type MapChromeGroup,
  type MapChromeLeaf,
  type MapChromeSchema,
  mapChromeTrees,
} from "./mapChromeTree.ts";
import { mapCloseActionStyle } from "./mapCloseAction.ts";
import { drawMapFog as fogOver } from "./mapFog.ts";
import {
  type MapPanelGroup,
  type MapPanelLeaf,
  type MapPanelSchema,
  mapPanelTree,
} from "./mapPanelTree.ts";
import {
  createMapPresentationRevision,
  createMapRenderQueue,
  mapPresentationContext,
} from "./mapRenderQueue.ts";
import { drawMapSurveyOutline } from "./mapSurveyOutline.ts";
import { BUTTON_FACE, MODAL_LAYER, TEXT_TOKENS } from "./modal.ts";
import { createStandardCloseAction } from "./modalClose.ts";
import { galaxiesAvailable, mapShowsEmpty } from "./pause.ts";
import { inCurrentView, invalidatePressScope } from "./pressScope.ts";
import { refuse } from "./refusal.ts";
import { createStandardTextAction } from "./standardTextAction.ts";
import { HUD_DISC_STATES, hudDiscStyle } from "./weapons.ts";

export { travelState } from "../data/mapJump.ts";

// The pause menu's full-screen map (art/map.md): the galaxy's field under its fog, a chip per
// discovered place, Ada's arrow, the header, the tool column and the place panel. It takes input
// exclusively while it shows; the Paused card and its dim hide under it.

export interface MapScreenLabels {
  /** The recentre tool's accessible label. */
  readonly centerOnAda: string;
  readonly close: string;
  /** "{distance} light-years", and the distance that rounds to 1. */
  readonly distance: string;
  readonly distanceOne: string;
  /** "Job: {objective}", under the held job's target's type line. */
  readonly jobObjective: string;
  readonly jobsProjects: string;
  readonly map: string;
  /** "{percent}% mapped". */
  readonly galaxies: string;
  readonly mapPercent: string;
  readonly mapSurveyInfo?: string;
  readonly optionalEncounter: string;
  readonly quests: string;
  readonly previous: string;
  readonly next: string;
  readonly page: string;
  readonly questsStoryHeading?: string;
  readonly questsJobsHeading?: string;
  readonly questFrom?: string;
  readonly questTo?: string;
  readonly questReward?: string;
  readonly questOutcome?: string;
  readonly questLocate?: string;
  readonly questExplore?: string;
  readonly questBack?: string;
  readonly questOtherQuests?: string;
  readonly questProgressLabel?: string;
  readonly questObjective?: string;
  readonly questNextAction?: string;
  readonly questStoryProgress?: string;

  readonly questsEmpty: string;
  readonly towTravel: string;
  readonly carryTravel: string;
  readonly travelCost: string;
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
  const questLabels = Object.fromEntries(
    [
      "questBack",
      "questOtherQuests",
      "questProgressLabel",
      "questObjective",
      "questNextAction",
      "questStoryProgress",
      "questExplore",
      "questFrom",
      "questLocate",
      "questOutcome",
      "questReward",
      "questTo",
      "questsJobsHeading",
      "questsStoryHeading",
    ]
      .filter((key) => Boolean(strings[key]))
      .map((key) => [key, strings[key]]),
  );
  return {
    ...questLabels,
    carryTravel: label("carryTravel"),
    centerOnAda: label("mapCenterOnAda"),
    close: label("close"),
    distance: label("mapDistance"),
    distanceOne: label("mapDistanceOne"),
    galaxies: label("galaxies"),
    jobObjective: label("jobObjective"),
    jobsProjects: label("jobsProjects"),
    map: label("map"),
    mapPercent: label("mapPercent"),
    ...(strings.mapSurveyInfo ? { mapSurveyInfo: strings.mapSurveyInfo } : {}),
    next: label("next"),
    optionalEncounter: label("mapOptionalEncounter"),
    page: label("achievementsPage"),
    previous: label("previous"),

    quests: label("quests"),
    questsEmpty: label("questsEmpty"),
    towTravel: label("towTravel"),
    travelCost: label("stardustAmount").replace("{amount}", String(MAP_JUMP_COST)),
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
  readonly map: LocalMap;
  readonly stardust: number | null;
  readonly towing: boolean;
  /** A job item is aboard, which refuses Travel here as towing does. */
  readonly carrying: boolean;
}

export interface MapScreenOptions {
  readonly shipFrame?: (heading: number) => string | undefined;
  /** Caller-owned dismissal label; standalone maps retain Close. */
  readonly closeLabel?: string;
  /** Quests: the caller opens the shared Quests list (questsScreen.ts) over the map. */
  readonly onQuests: () => void;
  readonly labels: MapScreenLabels;
  readonly onClose: () => void;
  /** Galaxies: the galaxy map; refused in danger, never while towing (pause.ts galaxiesAvailable). */
  readonly onGalaxies: () => void;
  readonly onTravel: (destination: string) => void;
  readonly reducedMotion: () => boolean;
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
  labels: Pick<
    MapScreenLabels,
    | "distance"
    | "distanceOne"
    | "jobObjective"
    | "jobsProjects"
    | "optionalEncounter"
    | "typeLine"
    | "types"
  >,
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
  const cues: string[] = [];
  if (place.job && job !== null) {
    cues.push(labels.jobObjective.replace("{objective}", job));
  }
  if (place.pendingJobLead) {
    cues.push(labels.jobsProjects);
  }
  if (place.optionalEncounter) {
    cues.push(labels.optionalEncounter.replace("{ship}", place.label));
  }
  if (cues.length) {
    lines.push(cues.join(" · "));
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
/* The full-screen Map covers the HUD. Its Quests and Galaxies dialogs stack above it. */
.ada-controls .ada-map-screen{
  position:absolute;
  inset:0;
  z-index:${MODAL_LAYER - 2};
  overflow:hidden;
  pointer-events:auto;
  touch-action:none;
  background:var(--map-field,${UNLISTED_COLOURS.pageBackground})
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
  box-shadow:inset 0 0 0 ${units(MAP_SYMBOL.edge)} var(--map-place-rim,${MAP_COLORS.ink});
  font:inherit;
  color:${MAP_COLORS.ink};
  pointer-events:none
}
.ada-controls .ada-map-screen .ada-map-place::before{
  content:"";
  width:var(--map-glyph-size, ${units(MAP_SYMBOL.glyph)});
  height:var(--map-glyph-size, ${units(MAP_SYMBOL.glyph)});
  background:currentColor;
  -webkit-mask:var(--glyph) center / 100% 100% no-repeat;
  mask:var(--glyph) center / 100% 100% no-repeat
}
/* A held activity's own spot has no job type: its orange chip carries no glyph. */
.ada-controls .ada-map-screen .ada-map-place[data-kind="job"]:not([data-job-type])::before{
  content:none
}
/* Keep the place hue in all states, including a job spot with no glyph. */
.ada-controls .ada-map-screen .ada-map-place[aria-pressed="true"]{
  background:color-mix(in srgb,var(--face) 35%,${MAP_COLORS.ink});
  color:${MAP_COLORS.cream};
  z-index:2
}
.ada-controls .ada-map-screen .ada-map-place:focus-visible{
  outline:none;
  background:color-mix(in srgb,var(--face) 65%,${MAP_COLORS.hull})
}
.ada-controls .ada-map-screen .ada-map-place[aria-pressed="true"]:focus-visible{
  background:color-mix(in srgb,var(--face) 48%,${MAP_COLORS.ink});
  color:${MAP_COLORS.hull}
}
@media (forced-colors:active){
  .ada-controls .ada-map-screen button.ada-map-place{
    forced-color-adjust:none;
    --map-place-rim:ButtonText;
    background:ButtonFace;
    color:ButtonText
  }
  .ada-controls .ada-map-screen button.ada-map-place[aria-pressed="true"]{
    background:ButtonText;
    color:ButtonFace
  }
  .ada-controls .ada-map-screen button.ada-map-place:focus-visible{
    background:Highlight;
    color:HighlightText
  }
  .ada-controls .ada-map-screen button.ada-map-place[aria-pressed="true"]:focus-visible{
    background:color-mix(in srgb,ButtonFace 55%,Highlight);
    color:ButtonText
  }
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
.ada-controls .ada-map-ada > .ada-map-ship{
  position:absolute;
  width:${units(MAP_SYMBOL.ada.size)};
  height:${units(MAP_SYMBOL.ada.size)};
  overflow:visible
}
.ada-controls .ada-map-ship img{
  width:100%;
  height:100%;
  display:block;
  pointer-events:none;
  filter:drop-shadow(0 0 ${units(MAP_SYMBOL.ada.keyline)} ${MAP_COLORS.ink})
}


/* The shared bottom-right navigation leaves the selected destination on the left. */
.ada-controls .ada-map-navigation{
  position:absolute;
  right:${safeEdge("right", SPACING.pageInset)};
  bottom:${safeEdge("bottom", SPACING.pageInset)};
  display:flex;
  align-items:center;
  max-width:calc(100% - ${safeEdge("left", SPACING.pageInset)} -
    ${safeEdge("right", SPACING.pageInset)});
  gap:${units(MAP_SCREEN.hudRow.gap)};
  pointer-events:auto
}
.ada-controls .ada-map-navigation .ada-button{
  flex:0 1 auto
}
/* The selected-place button uses the footer's secondary face and keeps the refusal label cue. */
.ada-controls .ada-map-screen .ui-standard-button[data-action="map-travel"]:focus-visible{
  outline:none;
  box-shadow:none
}
.ada-controls .ada-map-screen .ui-standard-button[data-action="map-travel"]:focus-visible:not([aria-disabled]){
  background-color:${BUTTON_FACE.secondary};
  background-image:linear-gradient(${TEXT_TOKENS.label},${TEXT_TOKENS.label});
  background-clip:padding-box;
  border-image-slice:${BUTTON_SLICE.top} ${BUTTON_SLICE.right} ${BUTTON_SLICE.bottom} ${BUTTON_SLICE.left};
  color:${TEXT_TOKENS.buttonLabel}
}
.ada-controls .ada-map-screen .ui-standard-button[aria-disabled=true]:focus-visible{
  background-color:${BUTTON_FACE.disabled};
  color:var(--ada-unavailable-focus-ink);
  forced-color-adjust:auto
}
@media (forced-colors:active){
  .ada-controls .ada-map-screen .ui-standard-button[data-action="map-travel"]:focus-visible:not([aria-disabled]){
    forced-color-adjust:none;
    background-color:ButtonFace;
    background-image:linear-gradient(Highlight,Highlight);
    color:HighlightText
  }
}
.ada-controls .ada-map-header{
  position:absolute;
  left:${safeEdge("left", SPACING.pageInset)};
  top:${safeEdge("top", SPACING.pageInset)};
  box-sizing:border-box;
  height:${units(MAP_SCREEN.header.height)};
  display:grid;
  grid-template-rows:${units(MAP_SCREEN.header.rowHeight)} ${units(TYPE.body.lineHeight)};
  padding-bottom:${units(SPACING.gap)};
  border-radius:${units(MAP_SCREEN.header.radius)};
  background:rgba(24,20,37,${MAP_SCREEN.header.alpha});
  pointer-events:none;
  white-space:nowrap;
  z-index:2
}
@media ${COMPACT_VIEWPORT}{
  .ada-controls .ada-map-header{
    padding-top:${units(COMPACT_MAP_HEADER_TOP)};
    padding-bottom:${units(SPACING.gap - COMPACT_MAP_HEADER_TOP)}
  }
}
.ada-controls .ada-map-header-row{
  display:flex;
  align-items:center;
  gap:var(--map-header-gap);
  padding:0 var(--map-header-gap)
}
.ada-controls .ada-map-galaxy{
  font:${font(TYPE.heading)};
  color:${TEXT_TOKENS.title}
}
.ada-controls .ada-map-galaxy,.ada-controls .ada-map-percent{
  flex:none;
  position:relative
}
.ada-controls .ada-map-ink{display:inline-block;white-space:nowrap}
.ada-controls .ada-map-divider{
  flex:none;
  width:${units(MAP_SCREEN.header.divider.width)};
  height:${units(MAP_SCREEN.header.divider.height)};
  background:${TEXT_TOKENS.supporting}
}
.ada-controls .ada-map-percent{
  font:${font(TYPE.label)};
  color:${MAP_COLORS.cream}
}
.ada-controls .ada-map-pips{
  flex:none;
  display:flex;
  align-items:center;
  gap:${units(MAP_SCREEN.header.pipPitch - MAP_SCREEN.header.pip)}
}
.ada-controls .ada-map-pip{
  box-sizing:border-box;
  width:${units(MAP_SCREEN.header.pip)};
  height:${units(MAP_SCREEN.header.pip)};
  border-radius:50%;
  border:${units(MAP_SCREEN.header.pipRing)} solid ${MAP_COLORS.supporting}
}
.ada-controls .ada-map-pip[data-filled]{
  border-color:${MAP_COLORS.cream};
  background:${MAP_COLORS.cream}
}
.ada-controls .ada-map-survey-info{
  display:flex;
  box-sizing:border-box;
  margin:0;
  padding:0 ${units(MAP_SCREEN.header.padding)};
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.supporting};
  white-space:nowrap;
  pointer-events:none
}
.ada-controls .ada-map-survey-info[hidden]{display:none}
.ada-controls .ada-map-tools{
  position:absolute;
  right:calc(${safeEdge("right", SPACING.pageInset)} + ${units(CARD_CLOSE.hit.width)});
  top:${safeEdge("top", SPACING.pageInset)};
  display:flex;
  gap:${units(MAP_SCREEN.toolRow.gap)}
}
.ada-controls .ada-map-screen > .ada-close{
  top:${safeEdge("top", SPACING.pageInset)};
  right:${safeEdge("right", SPACING.pageInset)};
  z-index:2
}
${mapCloseActionStyle(".ada-controls .ada-map-screen > .ada-close", HUD_DISC_STATES.idle.face)}
${hudDiscStyle(".ada-controls .ada-map-tool", ".ada-disc")}
.ada-controls .ada-map-tool:focus-visible{
  --map-tool-face:${TEXT_TOKENS.label};
  color:${TEXT_TOKENS.buttonLabel}
}
.ada-controls .ada-map-tool:active{
  --map-tool-face:${MAP_COLORS.ink};
  color:${TEXT_TOKENS.title}
}
.ada-controls .ada-map-tool .ada-disc{
  background:var(--map-tool-face,${HUD_DISC_STATES.idle.face})
}
.ada-controls .ada-map-tool:focus-visible .ada-disc{
  background:var(--map-tool-face,${HUD_DISC_STATES.idle.face});
  --disc-focus-glyph:currentColor;
  outline:none;
  box-shadow:inset 0 0 0 var(--disc-edge) ${MAP_COLORS.ink}
}
@media (forced-colors:active){
  .ada-controls .ada-map-tool{
    forced-color-adjust:none;
    --map-tool-face:ButtonFace;
    color:ButtonText
  }
  .ada-controls .ada-map-tool .ada-disc,
  .ada-controls .ada-map-tool:focus-visible .ada-disc{
    box-shadow:inset 0 0 0 ${units(HUD_BUTTON.edge)} currentColor
  }
  .ada-controls .ada-map-tool:focus-visible{
    --map-tool-face:Highlight;
    color:HighlightText
  }
  .ada-controls .ada-map-tool:active{
    --map-tool-face:ButtonText;
    color:ButtonFace
  }
}

/* The place panel hugs its content, capped at the footer's left edge. */
.ada-controls .ada-map-panel{
  position:absolute;
  left:${safeEdge("left", SAFE_MARGIN.page)};
  bottom:${safeEdge("bottom", SAFE_MARGIN.page)};
  box-sizing:border-box;
  width:max-content;
  padding:calc(${units(MAP_PANEL.padding)} - ${slice(CARD_SLICE)});
  display:grid;
  gap:${units(MAP_PANEL.reasonGap)};
  overflow-y:auto;
  overscroll-behavior:contain;
  touch-action:pan-y;
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.supporting};
  background:${COLOURS.cardFace};
  border:${slice(CARD_SLICE)} solid ${COLOURS.cardRim};
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
  flex-wrap:wrap;
  align-items:center;
  gap:${units(MAP_PANEL.markGap)} ${units(MAP_PANEL.actionGap)}
}
/* The reason-only and empty panels hold no row. */
.ada-controls .ada-map-row[hidden]{
  display:none
}
.ada-controls .ada-map-place-content{
  display:flex;
  align-items:center;
  gap:${units(MAP_PANEL.markGap)};
  flex:1 1 max-content;
  min-width:0
}
.ada-controls .ada-map-row .ada-map-place{
  position:relative;
  flex:none
}
.ada-controls .ada-map-text{
  flex:1;
  min-width:0;
  display:grid;
  padding:${units(MAP_PANEL.textTop)} 0
}
.ada-controls .ada-map-text,.ada-controls .ada-map-reason{
  overflow-wrap:anywhere
}
.ada-controls .ada-map-name{
  font:${font(TYPE.label)};
  color:${MAP_COLORS.cream}
}
.ada-controls .ada-map-row .ada-button{
  flex:none;
  min-width:max-content;
  white-space:nowrap
}
.ada-controls .ada-map-travel-cost{
  display:inline-flex;
  flex:none;
  align-items:center;
  gap:${units(BALANCE.markGap)}
}
.ada-controls .ada-map-travel-cost::before{
  content:"";
  width:${units(BALANCE.icon)};
  height:${units(BALANCE.icon)};
  background:url('${uiIconUrl("icon-stardust-20")}') center / 100% 100% no-repeat
}
.ada-controls .ada-map-reason{
  text-align:left
}
.ada-controls .ada-map-reason > span:not([data-shown]){
  display:none
}
.ada-controls .ada-map-reason:not(:has([data-shown])){
  display:none
}
.ada-controls .ada-map-empty{
  margin:0;
  text-align:center
}
/* In danger with no places the danger line follows the empty note, centred as it is. */
.ada-controls .ada-map-empty:not([hidden]) ~ .ada-map-reason{
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

/** Decode only requested canonical headings, retaining the last ready frame during loading. */
export function createMapShipMarker(
  source: (heading: number) => string | undefined,
  image: () => HTMLImageElement = () => new Image(),
) {
  const element = document.createElement("div");
  element.className = "ada-map-ship";
  element.setAttribute("aria-hidden", "true");
  const ready = new Set<number>();
  const frames = new Map<number, HTMLImageElement>();
  let wanted = 0;
  let shown: number | null = null;
  let disposed = false;
  const show = () => {
    if (disposed || !ready.has(wanted) || shown === wanted) {
      return;
    }
    element.replaceChildren(frames.get(wanted)!);
    element.dataset.heading = String(wanted);
    shown = wanted;
  };
  const request = (heading: number) => {
    if (frames.has(heading)) {
      return;
    }
    const url = source(heading);
    if (!url) {
      return;
    }
    const frame = image();
    frame.alt = "";
    frame.draggable = false;
    frame.loading = "eager";
    frames.set(heading, frame);
    frame.src = url;
    void frame
      .decode()
      .then(() => {
        if (disposed) {
          return;
        }
        ready.add(heading);
        show();
      })
      .catch(() => {});
  };
  return {
    dispose() {
      disposed = true;
      element.replaceChildren();
    },
    element,
    setFacing(facing: Vec) {
      if (disposed) {
        return;
      }
      wanted = shipHeading(facing);
      request(wanted);
      show();
    },
  };
}

// A place's chip node: its face, glyph, kind and marks.
/** A chip's face colour: main's orange for a held job's target or spot, else its symbol's face. */
export function chipFace(
  place: Pick<MapPlace, "job" | "pendingJobLead" | "taskCategory"> & {
    readonly symbol: keyof typeof MAP_FACES;
  },
): string {
  return place.taskCategory
    ? TASK_COLORS[place.taskCategory]
    : place.job || place.pendingJobLead
      ? MAP_JOB_FACE
      : MAP_FACES[place.symbol];
}

/** A chip's glyph: a held job's own spot takes its job type's, every other place its symbol's. */
export function chipGlyph(
  place: Pick<MapPlace, "jobType"> & { readonly symbol: keyof typeof MAP_GLYPHS },
): string | null {
  return place.jobType ? `map-job-${place.jobType}` : MAP_GLYPHS[place.symbol];
}

function dressChip(chip: HTMLElement, place: MapPlace): void {
  chip.className = "ada-map-place";
  chip.dataset.place = place.id;
  chip.dataset.kind = place.kind;
  chip.dataset.symbol = place.symbol;
  chip.style.setProperty("--face", chipFace(place));
  chip.style.setProperty("--map-glyph-size", units(mapGlyphSize(place.symbol)));
  // A held job's own spot takes its job type's glyph (art/map.md "Symbols").
  const glyph = chipGlyph(place);
  if (place.jobType) {
    chip.dataset.jobType = place.jobType;
  } else {
    delete chip.dataset.jobType;
  }
  if (glyph) {
    chip.style.setProperty("--glyph", `url('${uiIconUrl(glyph)}')`);
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
  map: Pick<LocalMap, "searchArea">,
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
  let disposed = false;
  let state: MapScreenState | null = null;
  let selected: string | null = null;
  const places = () => state?.map.places ?? [];
  const selectedPlace = () => places().find(({ id }) => id === selected) ?? null;
  const travelNow = () =>
    travelState(
      state?.inDanger ?? false,
      state?.towing ?? false,
      state?.carrying ?? false,
      selectedPlace(),
    );
  type ActionDisposer = { dispose(): void };
  const actionBindings = new Set<ActionDisposer>();
  const buttonAvailability = (element: HTMLElement): ControlAvailability =>
    element.matches(":disabled") || element.closest("[hidden], [inert]")
      ? { kind: "omitted" }
      : { kind: "available" };
  const actionCurrent = (element: HTMLElement) =>
    !disposed && !screen.hidden && inCurrentView(root, element);
  const actionSlop = () => MAP_SCREEN.dragThreshold * readViewUnit(screen);
  const registerAction = (
    action: Pick<
      AdaActionOptions,
      "beforeClick" | "hitTarget" | "nativeClickOwner" | "resolvePointerTarget"
    > & { readonly run: () => void },
    element: HTMLElement,
  ) => {
    const { run, ...routing } = action;
    const binding = bindAdaAction(
      {
        ...routing,
        click: { availability: () => buttonAvailability(element), run },
        current: () => actionCurrent(element),
        slopPx: actionSlop,
      },
      element,
    );
    actionBindings.add(binding);
    return binding;
  };
  const createMapButton = ({
    actionId,
    beforeClick,
    run,
  }: {
    readonly actionId?: string;
    readonly beforeClick?: AdaActionOptions["beforeClick"];
    readonly run: (button: HTMLButtonElement) => void;
  }) => {
    const button = document.createElement("button");
    button.type = "button";
    const binding = bindAdaAction(
      {
        beforeClick: (event) => beforeClick?.(event),
        click: { availability: () => buttonAvailability(button), run: () => run(button) },
        current: () => actionCurrent(button),
        slopPx: () => actionSlop(),
      },
      button,
    );
    if (actionId !== undefined) {
      button.dataset.action = actionId;
    }
    return { binding: { dispose: () => binding.dispose() }, button };
  };
  const forgetAction = (binding: ActionDisposer | undefined) => {
    if (binding) {
      binding.dispose();
      actionBindings.delete(binding);
    }
  };
  const chipBindings = new Map<string, ActionDisposer>();
  const fog = document.createElement("canvas");
  fog.className = "ada-map-fog";
  fog.setAttribute("aria-hidden", "true");
  const placesLayer = document.createElement("div");
  placesLayer.className = "ada-map-places";
  const adaLayer = document.createElement("div");
  adaLayer.className = "ada-map-ada";
  const shipMarker = createMapShipMarker((heading) => options.shipFrame?.(heading));
  const ada = shipMarker.element;
  adaLayer.append(ada);
  // The header.
  const header = document.createElement("div");
  header.className = "ada-map-header";
  const galaxy = document.createElement("span");
  galaxy.className = "ada-map-galaxy";
  const dividers = Array.from({ length: MAP_SCREEN.header.dividerCount }, () => {
    const divider = document.createElement("span");
    divider.className = "ada-map-divider";
    divider.setAttribute("aria-hidden", "true");
    return divider;
  });
  const percent = document.createElement("span");
  percent.className = "ada-map-percent";
  const pips = document.createElement("span");
  pips.className = "ada-map-pips";
  pips.setAttribute("aria-hidden", "true");
  pips.append(
    ...Array.from({ length: MAP_SCREEN.header.pips }, () => {
      const pip = document.createElement("span");
      pip.className = "ada-map-pip";
      return pip;
    }),
  );
  const headerRow = document.createElement("div");
  headerRow.className = "ada-map-header-row";
  const surveyInfo = document.createElement("p");
  surveyInfo.className = "ada-map-survey-info";
  surveyInfo.setAttribute("role", "note");
  surveyInfo.textContent = labels.mapSurveyInfo ?? "";
  surveyInfo.hidden = !labels.mapSurveyInfo;
  const galaxyInk = document.createElement("span");
  const percentInk = document.createElement("span");
  const noteInk = document.createElement("span");
  for (const ink of [galaxyInk, percentInk, noteInk]) {
    ink.className = "ada-map-ink";
  }
  galaxy.append(galaxyInk);
  percent.append(percentInk);
  noteInk.textContent = surveyInfo.textContent;
  surveyInfo.replaceChildren(noteInk);
  // The tools.
  const tools = document.createElement("div");
  tools.className = "ada-map-tools";
  const toolLabels: Record<MapTool, string> = {
    recentre: labels.centerOnAda,
    zoomIn: labels.zoomIn,
    zoomOut: labels.zoomOut,
  };
  const toolActions: Record<MapTool, (button: HTMLButtonElement) => void> = {
    recentre: () => {
      if (view && state) {
        cancelFieldAction();
        const { field, inner } = layout();
        view = recentreView(inner, field, state.map.player, view);
        render();
      }
    },
    zoomIn: (button) => zoom(MAP_SCREEN.zoomStep, fitCentre(), button),
    zoomOut: (button) => zoom(1 / MAP_SCREEN.zoomStep, fitCentre(), button),
  };
  const toolButtons = new Map<MapTool, HTMLButtonElement>();
  for (const { glyph, id } of MAP_TOOLS) {
    const { binding, button } = createMapButton({ actionId: `map-${id}`, run: toolActions[id] });
    actionBindings.add(binding);
    button.className = "ada-map-tool";
    button.dataset.tool = id;
    button.setAttribute("aria-label", toolLabels[id]);
    const disc = document.createElement("span");
    disc.className = "ada-disc";
    disc.style.setProperty("--glyph", `url('${uiIconUrl(glyph)}')`);
    button.append(disc);
    toolButtons.set(id, button);
  }
  // The place panel.
  const panel = document.createElement("div");
  panel.className = "ada-map-panel";
  panel.hidden = true;
  const row = document.createElement("div");
  row.className = "ada-map-row";
  const placeContent = document.createElement("div");
  placeContent.className = "ada-map-place-content";
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
  const reason = document.createElement("div");
  reason.className = "ada-map-reason";
  const reasons = {
    carrying: document.createElement("span"),
    danger: document.createElement("span"),
    towing: document.createElement("span"),
  };
  const travelReasons = {
    carrying: labels.carryTravel,
    danger: labels.travelUnavailable,
    towing: labels.towTravel,
  };
  for (const key of ["carrying", "danger", "towing"] as const) {
    reasons[key].textContent = travelReasons[key];
  }
  const travelAction = createStandardTextAction(root, labels.travelHere, {
    availability: () => {
      const { offered, reason } = travelNow();
      if (!offered) {
        return { kind: "omitted" };
      }
      if (!state || !canAffordMapJump(state.stardust)) {
        return { kind: "disabled" };
      }
      return reason === null
        ? { kind: "available" }
        : { kind: "unavailable", reason: travelReasons[reason] };
    },
    current: () => !disposed && !screen.hidden && inCurrentView(root, travelAction.element),
    refuse: () => refuse(travelAction.element, options.reducedMotion()),
    run: () => {
      const place = selectedPlace();
      if (place) {
        options.onTravel(place.id);
      }
    },
  });
  const travel = travelAction.element;
  travel.dataset.action = "map-travel";
  const travelCost = document.createElement("span");
  travelCost.className = "ada-map-travel-cost";
  travelCost.setAttribute("aria-hidden", "true");
  travelCost.textContent = String(MAP_JUMP_COST);
  travel.append(travelCost);
  travel.setAttribute("aria-label", `${labels.travelHere}, ${labels.travelCost}`);
  setButtonRole("secondary", travel);
  actionBindings.add(travelAction);
  const empty = document.createElement("p");
  empty.className = "ada-map-empty";
  empty.textContent = labels.travelEmpty;
  const panelGroups: Readonly<Record<MapPanelGroup, HTMLElement>> = {
    panel,
    place: placeContent,
    reason,
    row,
    text,
  };
  const panelLeaves: Readonly<Record<MapPanelLeaf, HTMLElement>> = {
    ...reasons,
    chip: panelChip,
    detail0: detail[0]!,
    detail1: detail[1]!,
    empty,
    name,
    travel,
  };
  const panelLayout = mountLayout<MapPanelSchema>(
    {
      components: {
        group: {
          create: (name) => ({
            dispose() {},
            element: panelGroups[name],
            slots: { content: panelGroups[name] },
            update() {},
          }),
          slots: ["content"],
        },
        leaf: {
          create: (name) => ({ dispose() {}, element: panelLeaves[name], slots: {}, update() {} }),
          slots: [],
        },
      },
      host: screen,
    },
    mapPanelTree(),
  );
  // Quests, then Galaxies, on the HUD row; Galaxies opens the galaxy map with no confirm, as for
  // Travel here.
  const hudRow = document.createElement("div");
  hudRow.className = "ada-map-hud-row ada-map-navigation";
  const navigationAction = (
    id: string,
    label: string,
    role: "primary" | "secondary",
    run: () => void,
  ) => {
    const action = createStandardTextAction(root, label, {
      availability: (button) => (button?.disabled ? { kind: "disabled" } : { kind: "available" }),
      current: () =>
        !disposed &&
        !screen.hidden &&
        !action.element.closest("[hidden], [inert]") &&
        inCurrentView(root, action.element),
      run,
    });
    const button = action.element;
    button.dataset.action = id;
    button.classList.toggle("ada-primary", role === "primary");
    setButtonRole(role, button);
    actionBindings.add(action);
    return button;
  };
  const questsButton = navigationAction("map-quests", labels.quests, "secondary", () =>
    options.onQuests(),
  );
  questsButton.setAttribute("aria-haspopup", "dialog");
  const galaxiesAction = createStandardTextAction(root, labels.galaxies, {
    availability: () =>
      galaxiesAvailable(state?.inDanger ?? false)
        ? { kind: "available" }
        : { kind: "unavailable", reason: labels.travelUnavailable },
    current: () => !disposed && !screen.hidden && inCurrentView(root, galaxiesAction.element),
    refuse: () => refuse(galaxiesAction.element, options.reducedMotion()),
    run: () => options.onGalaxies(),
  });
  const galaxies = galaxiesAction.element;
  setButtonRole("secondary", galaxies);
  actionBindings.add(galaxiesAction);
  galaxies.dataset.action = "map-galaxies";
  galaxies.setAttribute("aria-haspopup", "dialog");
  const closeButton = navigationAction(
    "map-close",
    options.closeLabel ?? labels.close,
    "primary",
    () => options.onClose(),
  );
  const closeXAction = createStandardCloseAction(root, "map-close-x", labels.close, {
    current: (button) => !disposed && !screen.hidden && inCurrentView(root, button),
    run: () => options.onClose(),
    slopPx: () => MAP_SCREEN.dragThreshold * readViewUnit(screen),
    slopThreshold: MAP_SCREEN.dragThreshold,
  });
  actionBindings.add(closeXAction);
  const closeX = closeXAction.element;
  const chromeGroups: Readonly<Record<MapChromeGroup, HTMLElement>> = {
    header,
    headerRow,
    navigation: hudRow,
    tools,
  };
  const chromeLeaves: Readonly<Record<MapChromeLeaf, HTMLElement>> = {
    close: closeButton,
    galaxies,
    galaxy,
    nameDivider: dividers[0]!,
    percent,
    pips,
    progressDivider: dividers[1]!,
    quests: questsButton,
    recentre: toolButtons.get("recentre")!,
    surveyInfo,
    zoomIn: toolButtons.get("zoomIn")!,
    zoomOut: toolButtons.get("zoomOut")!,
  };
  const chromeLayouts = mapChromeTrees(MAP_TOOLS.map(({ id }) => id)).map((tree) =>
    mountLayout<MapChromeSchema>(
      {
        components: {
          group: {
            create: (name) => ({
              dispose() {},
              element: chromeGroups[name],
              slots: { content: chromeGroups[name] },
              update() {},
            }),
            slots: ["content"],
          },
          leaf: {
            create: (name) => ({
              dispose() {},
              element: chromeLeaves[name],
              slots: {},
              update() {},
            }),
            slots: [],
          },
        },
        host: screen,
      },
      tree,
    ),
  );
  screen.append(fog, placesLayer, adaLayer, header, hudRow, tools, closeX, panel);

  let textMeasure: CanvasRenderingContext2D | null | undefined;
  const inkMeasurements = new Map<string, { offset: number; width: number }>();
  let view: MapView | null = null;
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
    const size = {
      height: screen.clientHeight / unit,
      width: screen.clientWidth / unit,
    };
    const fit = fitRegion(insets, size);
    // The field draws on the whole screen, so the view's edge is the screen's.
    const field = { height: size.height, width: size.width, x: 0, y: 0 };
    return { field, fit, inner: innerRegion(fit), insets, size, unit };
  };
  // The square flight wraps the galaxy into, which bounds the view.
  const worldSide = () => state?.map.worldSide ?? CURRENT_FLIGHT_TOPOLOGY.side;
  const detailLines = (place: MapPlace) => {
    if (!state) {
      return [];
    }
    // Distances run the short way, across the seam where it is nearer.
    return placeLines(labels, state.map.player, state.job, {
      ...place,
      ...nearestImage(worldSide(), state.map.player, place).point,
    });
  };
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
    if (!panel.hidden) {
      const measured = frameBoxIn(screen, panel);
      if (measured.height > 0) {
        return measured.y / unit;
      }
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
    drawMapSurveyOutline(context, inner, current, px);
    drawSearchArea(context, inner, current, map, px);
    // The field is the CSS background. Cover only the canvas outside the playable diamond,
    // after the fog and its reveals, while leaving the separate map content and chrome above it.
    const [top, ...tips] = mapWorldDiamond(inner, current);
    context.save();
    context.fillStyle = UNLISTED_COLOURS.mapOuterBackground;
    context.beginPath();
    context.rect(0, 0, width, height);
    context.moveTo(top.x * px, top.y * px);
    for (const tip of tips) {
      context.lineTo(tip.x * px, tip.y * px);
    }
    context.closePath();
    context.fill("evenodd");
    context.restore();
  };

  const presentation = createMapPresentationRevision();
  const addChips = (nextPlaces: readonly MapPlace[]) => {
    const pending = new Map<
      string,
      { readonly binding: ActionDisposer; readonly chip: HTMLButtonElement }
    >();
    try {
      for (const { id } of nextPlaces) {
        if (chips.has(id) || pending.has(id)) {
          continue;
        }
        const { binding, button: chip } = createMapButton({
          beforeClick(event) {
            // Spatial pointer gestures belong to the root. Enter and assistive clicks still use
            // this button's own target, even when it moved under keyboard focus.
            if (event.detail !== 0) {
              return false;
            }
            cancelFieldAction();
            return true;
          },
          run: () => select(id),
        });
        actionBindings.add(binding);
        pending.set(id, { binding, chip });
        assertAdaActionMetadata(chip);
        chip.addEventListener("focus", () => {
          if (view && state) {
            const target = places().find((entry) => entry.id === id);
            const { field, fit: region, inner: room, insets, size, unit } = layout();
            if (target) {
              view = keepClear(region, room, field, panelTop(size, insets, unit), target, view);
              render();
            }
          }
        });
      }
      if (pending.size === 0) {
        return;
      }
      placesLayer.append(...[...pending.values()].map(({ chip }) => chip));
      for (const { chip } of pending.values()) {
        assertAdaActionBindings(chip);
      }
    } catch (error) {
      for (const { binding, chip } of pending.values()) {
        forgetAction(binding);
        chip.remove();
      }
      throw error;
    }
    for (const [id, { binding, chip }] of pending) {
      chipBindings.set(id, binding);
      chips.set(id, chip);
    }
  };
  const renderQueue = createMapRenderQueue(window, () => render());
  const render = (refitSelection = false) => {
    renderQueue.cancel();
    if (!state || screen.hidden) {
      return;
    }
    const { field, fit, inner, insets, size, unit } = layout();
    if (!view) {
      view = openingView(inner, field, worldSide(), places(), state.map.player);
    }
    screen.style.setProperty("--map-field", state.field?.background ?? "");
    // Header.
    galaxyInk.textContent = state.field?.name ?? "";
    percentInk.textContent = labels.mapPercent.replace("{percent}", String(state.map.mapped));
    const filled = filledPips(state.map.mapped);
    if (pips.dataset.filled !== String(filled)) {
      pips.dataset.filled = String(filled);
      for (const [index, pip] of [...pips.children].entries()) {
        pip.toggleAttribute("data-filled", index < filled);
      }
    }
    const density = devicePixelRatio;
    const pixelUnit = unit * density;
    const measureInk = (box: HTMLElement, ink: HTMLElement) => {
      const measure = (textMeasure ??= document.createElement("canvas").getContext("2d"));
      if (!measure) {
        return frameSize(ink).width / unit;
      }
      const style = getComputedStyle(box);
      // Forced colors can leave the computed shorthand empty.
      const inkFont =
        style.font ||
        `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = ink.textContent ?? "";
      const key = `${inkFont}:${density}:${text}`;
      const cached = inkMeasurements.get(key);
      if (cached) {
        box.style.width = pixels(cached.width / density);
        ink.style.transform = `translateX(${pixels(cached.offset / density)})`;
        return cached.width / pixelUnit;
      }
      measure.font = inkFont;
      const em = parseFloat(style.fontSize);
      const metrics = measure.measureText(text);
      const advance = metrics.width;
      const origin = Math.ceil(em * density);
      measure.canvas.width = Math.ceil(advance * density) + 2 * origin;
      const baseline = Math.ceil(metrics.actualBoundingBoxAscent * density) + origin;
      const descent = Math.ceil(metrics.actualBoundingBoxDescent * density);
      measure.canvas.height = baseline + descent + origin;
      measure.scale(density, density);
      measure.font = inkFont;
      measure.fillStyle = "white";
      measure.fillText(text, origin / density, baseline / density);
      const raster = measure.getImageData(0, 0, measure.canvas.width, measure.canvas.height);
      let left = raster.width;
      let right = -1;
      for (let y = 0; y < raster.height; y++) {
        for (let x = 0; x < raster.width; x++) {
          if (raster.data[(y * raster.width + x) * 4 + 3]! >= 128) {
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
        }
      }
      const width = Math.max(0, right - left + 1);
      inkMeasurements.set(key, { offset: origin - left, width });
      box.style.width = pixels(width / density);
      ink.style.transform = `translateX(${pixels((origin - left) / density)})`;
      return width / pixelUnit;
    };
    const nameWidth = measureInk(galaxy, galaxyInk);
    const percentWidth = measureInk(percent, percentInk);
    const noteWidth = measureInk(noteInk, noteInk);
    const geometry = mapHeaderGeometry(nameWidth, percentWidth, noteWidth, pixelUnit);
    const headerWidth = mapHeaderWidthForView(insets, size, geometry.width, pixelUnit);
    const page = safeRect(insets, SPACING.pageInset, size);
    header.style.left = pixels(Math.ceil(mapHeaderLeft(insets, size) * pixelUnit) / density);
    header.style.top = pixels(Math.ceil(page.y * pixelUnit) / density);
    header.style.width = units(headerWidth);
    const gap = geometry.gap + (headerWidth - geometry.width) / MAP_SCREEN.header.gapCount;
    header.style.setProperty("--map-header-gap", units(gap));
    const dividerWidth = pixels(Math.round(MAP_SCREEN.header.divider.width * pixelUnit) / density);
    for (const divider of dividers) {
      divider.style.width = dividerWidth;
    }
    const diameter = Math.round(MAP_SCREEN.header.pip * pixelUnit);
    pips.style.position = "relative";
    pips.style.height = pixels(diameter / density);
    pips.style.width = pixels(
      (Math.round((MAP_SCREEN.header.pips - 1) * MAP_SCREEN.header.pipPitch * pixelUnit) +
        diameter) /
        density,
    );
    for (const [index, pip] of [...pips.children].entries()) {
      const style = (pip as HTMLElement).style;
      style.position = "absolute";
      style.left = pixels(Math.round(index * MAP_SCREEN.header.pipPitch * pixelUnit) / density);
      style.width = pixels(diameter / density);
      style.height = pixels(diameter / density);
      style.borderWidth = pixels(Math.round(MAP_SCREEN.header.pipRing * pixelUnit) / density);
    }
    const refittedPlace = refitSelection ? selectedPlace() : null;
    if (refittedPlace) {
      dressPanel();
      view = keepClear(fit, inner, field, panelTop(size, insets, unit), refittedPlace, view);
    }
    const current = view;
    // Chips, kept by id and placed in reading order so Tab follows it.
    const shown = places().map((place) => ({
      place,
      ...toScreen(inner, current, place),
    }));
    const ids = new Set(shown.map(({ place }) => place.id));
    for (const [id, chip] of chips) {
      if (!ids.has(id)) {
        if (fieldAction?.target === chip) {
          cancelFieldAction();
        }
        forgetAction(chipBindings.get(id));
        chipBindings.delete(id);
        chip.remove();
        chips.delete(id);
      }
    }
    for (const { place, x, y } of shown) {
      const chip = chips.get(place.id)!;
      dressChip(chip, place);
      chip.setAttribute(
        "aria-label",
        place.pendingJobLead ? `${place.label}. ${labels.jobsProjects}` : place.label,
      );
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
    shipMarker.setFacing(state.map.facing);
    if (!refittedPlace) {
      dressPanel();
    }
    drawFog(inner, unit, current);
  };

  // Constrain the selected panel before its top is measured for keep-clear.
  const dressPanel = () => {
    const { fit, insets, size } = layout();
    const navigation = frameSize(hudRow).width / readViewUnit(hudRow);
    const sideBySide = panelMaxWidth(insets, size, navigation || undefined);
    const place = selectedPlace();
    const travelling = travelNow();
    const bottom = size.height - Math.max(SAFE_MARGIN.page, insets.bottom);
    panel.style.maxWidth = units(sideBySide);
    panel.style.maxHeight = place ? units(selectedPanelMaxHeight(fit, bottom)) : "";
    panel.hidden = !panelShown();
    row.hidden = place === null;
    empty.hidden = place !== null || !mapShowsEmpty(places());
    if (place) {
      dressChip(panelChip, place);
      if (name.textContent !== place.label) {
        name.textContent = place.label;
      }
      const lines = detailLines(place);
      detail.forEach((line, index) => {
        line.textContent = lines[index] ?? "";
        line.hidden = lines[index] === undefined;
      });
    }
    travelAction.refresh();
    reasons.danger.toggleAttribute("data-shown", travelling.reason === "danger");
    reasons.towing.toggleAttribute("data-shown", travelling.reason === "towing");
    reasons.carrying.toggleAttribute("data-shown", travelling.reason === "carrying");
    galaxiesAction.refresh();
    if (place && panel.scrollHeight > panel.clientHeight) {
      panel.tabIndex = 0;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-label", place.label);
    } else {
      panel.removeAttribute("tabindex");
      panel.removeAttribute("role");
      panel.removeAttribute("aria-label");
    }
  };

  // Selecting pans the chip clear of the panel at once; an empty press clears the selection.
  const select = (id: string | null) => {
    if (selected !== id) {
      panel.scrollTop = 0;
    }
    selected = id;
    const place = selectedPlace();
    if (place && view) {
      // The panel takes the new place's text first, so the pan clears its rendered height.
      dressPanel();
      const { field, fit, inner, insets, size, unit } = layout();
      view = keepClear(fit, inner, field, panelTop(size, insets, unit), place, view);
    }
    render();
  };

  const zoom = (factor: number, anchor: Point, button?: HTMLButtonElement) => {
    cancelFieldAction();
    if (!view) {
      return;
    }
    const { field, inner } = layout();
    const zoomed = zoomView(inner, field, factor, anchor, view);
    if (zoomed.refused) {
      if (button) {
        refuse(button, options.reducedMotion());
      }
      return;
    }
    view = zoomed.view;
    renderQueue.schedule();
  };
  const fitCentre = (): Point => {
    const { fit } = layout();
    return { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 };
  };
  const goTo = (place: MapPlace) => {
    cancelFieldAction();
    if (view) {
      const { field, inner } = layout();
      view = recentreView(inner, field, place, view);
    }
    select(place.id);
    const chip = chips.get(place.id);
    if (chip) {
      focusTarget(chip);
    }
  };
  // The shared root owns field selection. Page listeners keep pan, pinch and capture bookkeeping.
  const pointers = new Map<number, Point>();
  let press: { readonly at: Point; moved: boolean } | null = null;
  let pinch: { distance: number; mid: Point } | null = null;
  let fieldAction: {
    readonly id: string | null;
    readonly pointerId: number;
    readonly target: HTMLElement;
  } | null = null;
  const cancelFieldAction = () => {
    if (fieldAction) {
      fieldAction = null;
      invalidatePressScope(root);
    }
  };
  const local = (event: PointerEvent | WheelEvent): Point => {
    const unit = readViewUnit(screen);
    const at = framePoint(turnOf(screen), screen.getBoundingClientRect(), {
      x: event.clientX,
      y: event.clientY,
    });
    return { x: at.x / unit, y: at.y / unit };
  };
  const onChrome = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest(".ada-map-tools,.ada-map-hud-row .ada-button,.ada-map-panel,.ada-close") !==
      null;
  const pinchOf = (): { distance: number; mid: Point } | null => {
    const [a, b] = [...pointers.values()];
    return a && b
      ? {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        }
      : null;
  };
  const resolveFieldPointer: NonNullable<AdaActionOptions["resolvePointerTarget"]> = (
    { physicalTarget },
    event,
  ) => {
    if (onChrome(physicalTarget)) {
      return undefined;
    }
    const current = view;
    if (!current) {
      return null;
    }
    if (fieldAction?.pointerId === event.pointerId) {
      const { id, target } = fieldAction;
      return id === null || chips.get(id) === target ? target : null;
    }
    if (event.type !== "pointerdown" || pointers.size !== 0) {
      return null;
    }
    // Captured by the root before bubbling, focus or selection can change the projection.
    const { inner } = layout();
    const areas: PressArea<string>[] = places().map((place) => {
      const art = chipRect(toScreen(inner, current, place));
      return { art, hit: hitAround(HIT_RULE, art), key: place.id };
    });
    // Exact ties go to the chip drawn on top: the later one in the map's order.
    const id = pressedArea(areas.reverse(), local(event)) ?? null;
    const target = id === null ? screen : chips.get(id);
    if (!target) {
      return null;
    }
    fieldAction = { id, pointerId: event.pointerId, target };
    return target;
  };
  registerAction(
    {
      hitTarget: "self",
      nativeClickOwner: "factory",
      resolvePointerTarget: resolveFieldPointer,
      run: () => select(null),
    },
    screen,
  );

  screen.addEventListener("pointerdown", (event) => {
    if (onChrome(event.target)) {
      return;
    }
    const at = local(event);
    pointers.set(event.pointerId, at);
    screen.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1) {
      press = { at, moved: false };
    } else {
      cancelFieldAction();
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
    const { field, inner } = layout();
    if (pointers.size >= 2) {
      const next = pinchOf();
      if (pinch && next && pinch.distance > 0) {
        const zoomed = zoomView(inner, field, next.distance / pinch.distance, next.mid, view);
        view = panView(
          inner,
          field,
          { x: next.mid.x - pinch.mid.x, y: next.mid.y - pinch.mid.y },
          zoomed.view,
        );
        renderQueue.schedule();
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
      cancelFieldAction();
    }
    if (press?.moved) {
      view = panView(inner, field, { x: at.x - before.x, y: at.y - before.y }, view);
      renderQueue.schedule();
    }
  });
  const release = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) {
      return;
    }
    if (pointers.size < 2) {
      pinch = null;
    }
    if (fieldAction?.pointerId === event.pointerId) {
      if (event.type === "pointerup") {
        fieldAction = null;
      } else {
        cancelFieldAction();
      }
    }
    if (pointers.size === 0) {
      press = null;
    }
  };
  screen.addEventListener("pointerup", release);
  screen.addEventListener("pointercancel", release);
  screen.addEventListener("lostpointercapture", release);
  screen.addEventListener(
    "wheel",
    (event) => {
      if (event.target instanceof Node && panel.contains(event.target)) {
        return;
      }
      event.preventDefault();
      const delta =
        event.deltaMode === 1 ? (event.deltaY * MAP_SCREEN.wheelStep) / 3 : event.deltaY;
      zoom(MAP_SCREEN.zoomStep ** (-delta / MAP_SCREEN.wheelStep), local(event));
    },
    { passive: false },
  );
  // Tab follows the Map order, with a stop before Travel here when the panel can scroll.
  screen.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }
    const order = [
      ...tools.querySelectorAll<HTMLButtonElement>("button"),
      closeX,
      ...placesLayer.querySelectorAll<HTMLButtonElement>("button"),
      ...(panel.tabIndex === 0 ? [panel] : []),
      travel,
      questsButton,
      galaxies,
      closeButton,
    ];
    const targets = order.filter((button) => !button.closest("[hidden]") && !button.hidden);
    if (targets.length === 0) {
      return;
    }
    event.preventDefault();
    const at = targets.findIndex((target) => target === document.activeElement);
    const step = event.shiftKey ? -1 : 1;
    const next = at < 0 ? (event.shiftKey ? targets.length - 1 : 0) : at + step;
    focusTarget(targets[(next + targets.length) % targets.length]!);
  });
  const refit = () => {
    cancelFieldAction();
    presentation.clear();
    if (!screen.hidden && view) {
      const { field, inner } = layout();
      view = clampView(inner, field, view);
      render(true);
    }
  };
  let checkedAttached = false;
  const map = {
    close(): void {
      cancelFieldAction();
      renderQueue.cancel();
      presentation.clear();
      screen.hidden = true;
      selected = null;
      view = null;
      pointers.clear();
      press = null;
      pinch = null;
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      cancelFieldAction();
      disposed = true;
      pointers.clear();
      press = null;
      pinch = null;
      for (const binding of actionBindings) {
        binding.dispose();
      }
      actionBindings.clear();
      chipBindings.clear();
      renderQueue.dispose();
      presentation.clear();
      document.fonts.removeEventListener("loadingdone", refit);
      window.removeEventListener(VIEW_SCALE_EVENT, refit);
      window.removeEventListener("resize", refit);
      for (const layout of chromeLayouts) {
        layout.dispose();
      }
      panelLayout.dispose();
      shipMarker.dispose();
      screen.remove();
    },
    element: screen,
    /** Focuses Galaxies, as the galaxy map it opened closes back to the local map. */
    focusGalaxies(): void {
      focusTarget(galaxies);
    },
    focusQuests(): void {
      focusTarget(questsButton);
    },
    isOpen: () => !screen.hidden,
    locate(id: string): void {
      const place = places().find((place) => place.id === id);
      if (place) {
        goTo(place);
      }
    },
    /** Opens at the opening fit with nothing selected, focus on close. */
    open(): void {
      if (!checkedAttached) {
        assertAdaActionBindings(screen);
        checkedAttached = true;
      }
      addChips(places());
      cancelFieldAction();
      screen.hidden = false;
      selected = null;
      view = null;
      render();
      focusTarget(closeButton);
    },
    setState(next: MapScreenState): void {
      if (!screen.hidden) {
        addChips(next.map.places);
      }
      if (state?.map.worldSide !== next.map.worldSide) {
        cancelFieldAction();
        view = null;
        presentation.clear();
      }
      state = next;
      if (selected !== null && !places().some(({ id }) => id === selected)) {
        selected = null;
      }
      if (screen.hidden) {
        presentation.clear();
        return;
      }
      if (presentation.changed(mapPresentationContext(screen), next)) {
        render();
      }
    },
  };
  try {
    // The completed panel includes Travel even while hidden.
    assertAdaActionMetadata(screen);
    root.append(screen);
    checkedAttached = screen.isConnected;
    if (checkedAttached) {
      assertAdaActionBindings(screen);
    }
  } catch (error) {
    map.dispose();
    throw error;
  }
  window.addEventListener(VIEW_SCALE_EVENT, refit);
  window.addEventListener("resize", refit);
  document.fonts.addEventListener("loadingdone", refit);
  return map;
}
