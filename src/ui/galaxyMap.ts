import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";
import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { type GalaxyMapArt, jetLayerPass, jetOccluderRegions, jetsInFront } from "../art/index.ts";
import { GALAXY_COUNT, type RoutePosition } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import { TASK_COLORS } from "../data/taskCategories.ts";
import type { RouteFlight } from "../model/game.ts";
import {
  ADA_ACTION_HOLD_MS,
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { registerForegroundSurface } from "./foregroundInput.ts";
import {
  type GalaxyPanelGroup,
  type GalaxyPanelLeaf,
  type GalaxyPanelSchema,
  galaxyPanelTree,
} from "./galaxyPanelTree.ts";
import { COLOURS, UNLISTED_COLOURS } from "./layout/colours.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { BUTTON_SLICE, CARD_SLICE } from "./layout/controls.ts";
import {
  COMPACT_VIEWPORT,
  font,
  fromAreaLeft,
  fromAreaTop,
  pixels,
  safeEdge,
  slice,
  units,
} from "./layout/css.ts";
import {
  easeInOutSine,
  GALAXY_MAP,
  GALAXY_MAP_ACTIONS,
  GALAXY_MAP_LEGS,
  GALAXY_MAP_MOVE,
  GALAXY_MAP_PANEL,
  GALAXY_MAP_SKY,
  GALAXY_MAP_SKY_LEFT,
  pathStamps,
  type Point,
  restingTangent,
  routeDistance,
  routeHeading,
  routePoint,
  type Stamp,
  unlockFlightSeconds,
} from "./layout/galaxyMap.ts";
import { SAFE_MARGIN } from "./layout/playView.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { mapCloseActionStyle } from "./mapCloseAction.ts";
import { BUTTON_FACE, MODAL_LAYER, TEXT_TOKENS } from "./modal.ts";
import { createStandardCloseAction } from "./modalClose.ts";
import { invalidatePressScope } from "./pressScope.ts";
import { refuse } from "./refusal.ts";
import { drawShipJets } from "./shipJetCanvas.ts";
import { createShipTailView } from "./shipTailView.ts";
import { createStandardTextAction } from "./standardTextAction.ts";
import { setStoryScenePreview } from "./story/index.ts";

// The galaxy map (art/layout.md "Galaxy selector"), after Chibi's MapScene: the route sky and
// ground, the chart's legs, markers, labels and Ada's ship, the panel for the chosen galaxy, Earth's
// marker and the single destination action (Jump to the selected galaxy or Earth, Stay in the
// galaxy Ada is flying in, or Stay on Earth at boarding). The close X and Escape go one step back.
// The model holds the ship's galaxy, a locked galaxy viewed in the panel and the unlock flight;
// this draws the selected position and animates progression unlocks.

export interface GalaxyMapLabels {
  readonly back?: string;
  readonly close: string;
  /** A placeholder galaxy's line under its flavour line. */
  readonly development: string;
  /** The Earth panel's text. */
  readonly earthDescription: string;
  /** The Earth panel's kicker. */
  readonly earthKicker: string;
  /** Earth's marker label and panel title. */
  readonly earthTitle: string;
  readonly home: string;
  readonly jump: string;
  /** The destination action on Earth when Ada is away from it. */
  readonly jumpEarth: string;
  /** "Jump to {galaxy}". */
  readonly jumpTo: string;
  readonly locked: string;
  readonly lockedAction: string;
  /** "Galaxy {number}". */
  readonly number: string;
  /** Jump's label on the galaxy Ada is flying in, opened in flight. */
  readonly stay: string;
  /** The destination action on Earth at boarding. */
  readonly stayEarth: string;
  /** "Stay in {galaxy}": the destination action on the galaxy Ada is flying in. */
  readonly stayIn: string;
}

/** One route position's galaxy, in route order. */
export interface GalaxyMapEntry {
  readonly flavor: string;
  /** Its marker's main hue (galaxies.json `marker`). */
  readonly hue: string;
  readonly name: string;
  /** A placeholder galaxy, whose panel adds the development line. */
  readonly placeholder: boolean;
  /** Its preview in its own field, and the locked greyscale; empty where none exists yet. */
  readonly preview: { readonly locked: string; readonly open: string };
  readonly unlocked: boolean;
}

export interface GalaxyMapView {
  /** The existing boarding selector is at Earth; an in-flight selector is not. */
  readonly atEarth?: boolean;
  readonly flight: RouteFlight | null;
  /** Every galaxy, in route order. */
  readonly galaxies: readonly GalaxyMapEntry[];
  /** The route position the panel shows: the ship's, or a locked galaxy viewed. */
  readonly panel: RoutePosition;
  /** The route position the ship is on. */
  readonly ship: RoutePosition;
  /** Whether Jump reads Stay here: in flight, the panel on the galaxy Ada is flying in. */
  readonly stay: boolean;
}

export type { GalaxyMapArt } from "../art/index.ts";

export interface GalaxyMapOptions {
  readonly labels: GalaxyMapLabels;
  /** The clock the unlock flight starts on, in milliseconds. */
  readonly now: () => number;
  /** X, Back, Escape and Stay return to where the galaxy map opened from. */
  readonly onClose: () => void;
  /** Earth: Ada's room. */
  readonly onEarth: () => void;
  /** The unlock flight ended or was skipped. */
  readonly onFlightEnd: () => void;
  readonly onJump: () => void;
  /** Right (1) and Left (-1). */
  readonly onStep: (delta: 1 | -1) => void;
  /** A tap or focus on a marker. */
  readonly onView: (position: RoutePosition) => void;
  readonly reducedMotion: () => boolean;
}

export function destinationAction(
  labels: Pick<GalaxyMapLabels, "jumpEarth" | "jumpTo" | "lockedAction" | "stayEarth" | "stayIn">,
  earth: boolean,
  view: GalaxyMapView,
): string {
  if (earth) {
    return view.atEarth ? labels.stayEarth : labels.jumpEarth;
  }
  const galaxy = view.galaxies[view.panel - 1]!;
  if (!galaxy.unlocked) {
    return labels.lockedAction;
  }
  return (view.stay ? labels.stayIn : labels.jumpTo).replace("{galaxy}", galaxy.name);
}

const { colors, label, marker, path, ship: SHIP } = GALAXY_MAP;
const POSITIONS = Array.from({ length: GALAXY_COUNT }, (_, i) => (i + 1) as RoutePosition);

// The labels stay below the route controls in paint order and outside their hit areas.
const labelCue = (state: string) =>
  [...POSITIONS, "earth"]
    .map(
      (position) =>
        `.ada-controls .ada-route-chart:has(> [data-position="${position}"]${state})` +
        ` > [data-route-label="${position}"]`,
    )
    .join(",\n");
const SELECTED_LABEL = labelCue("[data-selected]");
const FOCUSED_LABEL = labelCue(":focus-visible");
const PRESSED_LABEL = labelCue(":active");

// Ink at an alpha, as a colour rather than opacity, so the backing stays under the disc it backs.
const inkAt = (alpha: number) =>
  `${colors.ink}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;

export const GALAXY_MAP_STYLE = `
.ada-controls .ada-route{
  position:absolute;
  inset:0;
  z-index:${MODAL_LAYER};
  overflow:hidden;
  background:${GALAXY_MAP_SKY.top};
  pointer-events:auto
}
.ada-controls .ada-route > .ada-close{
  top:${safeEdge("top", SPACING.pageInset)};
  right:${safeEdge("right", SPACING.pageInset)};
  z-index:1
}
${mapCloseActionStyle(".ada-controls .ada-route > .ada-close")}
.ada-controls .ada-route-sky,
.ada-controls .ada-route-ground{
  position:absolute;
  left:${fromAreaLeft(GALAXY_MAP_SKY_LEFT)};
  width:${units(GALAXY_MAP_SKY.sky.width)};
  background:center / 100% 100% no-repeat
}
.ada-controls .ada-route-sky{
  top:${fromAreaTop(0)};
  height:${units(GALAXY_MAP_SKY.sky.height)}
}
.ada-controls .ada-route-ground{
  bottom:0;
  height:${units(GALAXY_MAP_SKY.ground.height)}
}
.ada-controls .ada-route-figure{
  position:absolute;
  background:center / 100% 100% no-repeat;
  image-rendering:pixelated
}
/* The available rect preserves the page insets without a surrounding frame. */
.ada-controls .ada-route-rules{
  position:absolute;
  top:${safeEdge("top", SAFE_MARGIN.page)};
  right:${safeEdge("right", SAFE_MARGIN.page)};
  bottom:${safeEdge("bottom", SAFE_MARGIN.page)};
  left:${safeEdge("left", SAFE_MARGIN.page)};
  pointer-events:none
}
/* The chart, in play-view px from the game area's top-left. */
.ada-controls .ada-route-chart{
  position:absolute;
  top:${fromAreaTop(0)};
  left:${fromAreaLeft(0)};
  width:${units(SCREEN.width)};
  height:${units(SCREEN.height)};
  pointer-events:none
}
.ada-controls .ada-route-legs{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  shape-rendering:crispEdges
}
.ada-controls .ada-route-marker{
  position:absolute;
  width:${units(GALAXY_MAP.press)};
  height:${units(GALAXY_MAP.press)};
  min-width:${pixels(GALAXY_MAP.press)};
  min-height:${pixels(GALAXY_MAP.press)};
  margin:0;
  padding:0;
  border:0;
  font:inherit;
  color:inherit;
  background:transparent;
  display:grid;
  place-items:center;
  cursor:pointer;
  pointer-events:auto;
  --hue:${colors.grey}
}
.ada-controls .ada-route-marker > span{
  grid-area:1 / 1;
  border-radius:50%;
  box-sizing:border-box
}
.ada-controls .ada-route-backing{
  width:${units(2 * marker.backing.radius)};
  height:${units(2 * marker.backing.radius)};
  background:${inkAt(marker.backing.alpha)}
}
.ada-controls .ada-route-marker[data-earth] .ada-route-disc{
  background:${UNLISTED_COLOURS.earthOcean};
  background-image:
    radial-gradient(ellipse at 30% 30%,${UNLISTED_COLOURS.earthLand} 0 23%,transparent 25%),
    radial-gradient(ellipse at 70% 65%,${UNLISTED_COLOURS.earthLand} 0 26%,transparent 28%)
}
.ada-controls .ada-route-marker:focus-visible{
  outline:none;
  box-shadow:none
}
.ada-controls .ada-route-disc{
  width:${units(2 * marker.disc)};
  height:${units(2 * marker.disc)};
  border:${units(marker.edge)} solid ${colors.ink};
  background:var(--hue);
  display:grid;
  place-items:center;
  font:${font(TYPE.label)};
  color:${colors.ink};
  transition:background-color ${GALAXY_MAP_MOVE.unlock.fade}s ease-out
}
/* The larger backing overlaps the face to avoid a seam at fractional scales. */
.ada-controls .ada-route-marker[data-selected]:not([data-earth]) > .ada-route-backing{
  width:${units(2 * marker.selectedBackingRadius)};
  height:${units(2 * marker.selectedBackingRadius)};
  background:${TASK_COLORS.story}
}
.ada-controls .ada-route-marker[data-selected]:not([data-earth]) > .ada-route-disc{
  border-color:var(--hue)
}
.ada-controls .ada-route-pulse{
  position:absolute;
  box-sizing:border-box;
  border-radius:50%;
  border:${units(GALAXY_MAP_MOVE.unlock.pulse.width)} solid var(--hue);
  pointer-events:none
}
.ada-controls .ada-route-label{
  position:absolute;
  box-sizing:border-box;
  height:${units(label.height)};
  padding:0 ${units(label.padding)};
  transform:translateX(-50%);
  border-radius:${units(label.radius)};
  background:${inkAt(label.alpha)};
  font:${font(TYPE.label)};
  color:${colors.cream};
  white-space:nowrap
}
/* The ellipsis has no cap band. Centre its ink within the unchanged pill. */
.ada-controls .ada-route-label[data-locked]{
  line-height:${units(label.height - 2 * label.lockedInkLift + 1)};
  color:${colors.grey}
}
@media ${COMPACT_VIEWPORT}{
  .ada-controls .ada-route-label:not([data-locked]){line-height:${units(label.height + 2)}}
  .ada-controls .ada-route-label[data-locked]{line-height:${units(label.height - 2 * label.lockedInkLift)}}
}
${SELECTED_LABEL}{
  background-color:${colors.cream};
  color:${colors.ink}
}
${FOCUSED_LABEL}{
  background-color:${colors.grey};
  color:${colors.ink}
}
${PRESSED_LABEL}{
  background-color:${TEXT_TOKENS.title};
  color:${colors.ink}
}
@media (forced-colors:active){
  /* Keep the ink backing, map hue and Earth artwork in forced colours. */
  .ada-controls .ada-route-backing,
  .ada-controls .ada-route-disc{
    forced-color-adjust:none
  }
  ${SELECTED_LABEL}{
    forced-color-adjust:none;
    background-color:ButtonText;
    color:ButtonFace
  }
  ${FOCUSED_LABEL}{
    forced-color-adjust:none;
    background-color:Highlight;
    color:HighlightText
  }
  ${PRESSED_LABEL}{
    forced-color-adjust:none;
    background-color:HighlightText;
    color:Highlight
  }
}
.ada-controls .ada-route-ship{
  position:absolute;
  width:${units(SHIP.size)};
  height:${units(SHIP.size)};
  background:center / 100% 100% no-repeat;
  transition:opacity ${GALAXY_MAP_MOVE.reduced.fade / 1000}s linear
}
/* The panel: a card face 614 by 112 centred on the play view, a gap above the actions. */
.ada-controls .ada-route-panel{
  position:absolute;
  box-sizing:border-box;
  left:${fromAreaLeft((SCREEN.width - GALAXY_MAP_PANEL.width) / 2)};
  bottom:calc(${safeEdge("bottom", SAFE_MARGIN.page)} + ${units(GALAXY_MAP_ACTIONS.height + SPACING.gap)});
  width:${units(GALAXY_MAP_PANEL.width)};
  height:${units(GALAXY_MAP_PANEL.height)};
  padding:${units(GALAXY_MAP_PANEL.padding - CARD_SLICE)};
  display:flex;
  align-items:flex-start;
  gap:${units(
    GALAXY_MAP_PANEL.text.left -
      GALAXY_MAP_PANEL.padding -
      GALAXY_MAP_PANEL.capture.width -
      2 * GALAXY_MAP_PANEL.capture.frame,
  )};
  background:${COLOURS.cardFace};
  border:${slice(CARD_SLICE)} solid ${COLOURS.cardRim};
  border-image:url('/art/ui/sprites/ui-settings-card.png') ${CARD_SLICE} fill / ${slice(CARD_SLICE)} stretch;
  image-rendering:pixelated;
  pointer-events:auto
}
.ada-controls .ada-route-panel .ada-galaxy-shot{
  position:relative;
  overflow:hidden;
  flex:none;
  box-sizing:content-box;
  width:${units(GALAXY_MAP_PANEL.capture.width)};
  height:${units(GALAXY_MAP_PANEL.capture.height)};
  border:${slice(GALAXY_MAP_PANEL.capture.frame)} solid ${GALAXY_MAP_PANEL.capture.frameColor};
  background:${colors.ink} center / 100% 100% no-repeat
}
.ada-controls .ada-route-text{
  flex:none;
  width:${units(GALAXY_MAP_PANEL.text.width)};
  display:flex;
  flex-direction:column;
  gap:${units(GALAXY_MAP_PANEL.rowGap)};
  font:${font(TYPE.body)};
  color:${GALAXY_MAP_PANEL.colors.flavor}
}
.ada-controls .ada-route-text h2{
  margin:0;
  font:${font(TYPE.body)};
  color:${GALAXY_MAP_PANEL.colors.number}
}
.ada-controls .ada-route-text .ada-route-name{
  margin:0;
  font:${font(TYPE.heading)};
  color:${GALAXY_MAP_PANEL.colors.name}
}
.ada-controls .ada-route-text p{
  margin:0
}
.ada-controls .ada-route-text[data-locked] .ada-route-name,
.ada-controls .ada-route-text[data-locked] p,
.ada-controls .ada-route-development{
  color:${GALAXY_MAP_PANEL.colors.development}
}
.ada-controls .ada-route-flight-actions{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  bottom:${safeEdge("bottom", SAFE_MARGIN.page)};
  display:flex;
  gap:${units(SPACING.panelPadding)};
  width:max-content;
  max-width:${units(GALAXY_MAP_PANEL.width)}
}
.ada-controls .ada-route-action.ui-standard-button:focus-visible{
  outline:none;
  box-shadow:none
}
.ada-controls .ada-route-action.ui-standard-button:focus-visible:not([aria-disabled]){
  background-color:${BUTTON_FACE.primary};
  background-image:linear-gradient(${TEXT_TOKENS.label},${TEXT_TOKENS.label});
  background-clip:padding-box;
  border-image-slice:${BUTTON_SLICE.top} ${BUTTON_SLICE.right} ${BUTTON_SLICE.bottom} ${BUTTON_SLICE.left};
  color:${TEXT_TOKENS.buttonLabel}
}
.ada-controls .ada-route-action.ui-standard-button[aria-disabled=true]:focus-visible{
  background-color:${BUTTON_FACE.disabled};
  color:var(--ada-unavailable-focus-ink);
  forced-color-adjust:auto
}
@media (forced-colors:active){
  .ada-controls .ada-route-action.ui-standard-button:focus-visible:not([aria-disabled]){
    forced-color-adjust:none;
    background-color:ButtonFace;
    background-image:linear-gradient(Highlight,Highlight);
    color:HighlightText
  }
}
/* A quantum jump from the map: the panel and the destination action go, then the warp ship covers
   Ada's. */
.ada-controls .ada-route[data-jumping] .ada-route-panel,
.ada-controls .ada-route[data-jumping] .ada-route-action,
.ada-controls .ada-route[data-ship-covered] .ada-route-ship{
  visibility:hidden
}
`;

/** A leg's open and locked stamps in play-view px, and where each sits along the route. */
interface LegStamps {
  readonly locked: readonly Stamp[];
  readonly open: readonly Stamp[];
  readonly start: number;
}

const LEG_STAMPS: readonly LegStamps[] = GALAXY_MAP_LEGS.map((curve, index) => ({
  locked: pathStamps(path.step, path.locked, path.trim, curve),
  open: pathStamps(path.step, path.open, path.trim, curve),
  start: routeDistance((index + 1) as RoutePosition),
}));

const SVG = "http://www.w3.org/2000/svg";

function stampGroup(color: string, stamps: readonly Stamp[]): SVGGElement {
  const group = document.createElementNS(SVG, "g");
  group.setAttribute("fill", color);
  for (const stamp of stamps) {
    const rect = document.createElementNS(SVG, "rect");
    rect.setAttribute("x", String(stamp.x));
    rect.setAttribute("y", String(stamp.y));
    rect.setAttribute("width", String(stamp.width));
    rect.setAttribute("height", String(stamp.height));
    group.append(rect);
  }
  return group;
}

/** The ship's place `distance` along the route: its frame's top-left and its direction. */
function shipPlace(distance: number): { at: Point; tangent: Point } {
  const { point, tangent } = routePoint(distance);
  return {
    at: { x: point.x - SHIP.size / 2, y: point.y - SHIP.lift - SHIP.size / 2 },
    tangent,
  };
}

export function createGalaxyMap(root: HTMLElement, options: GalaxyMapOptions) {
  const { labels } = options;
  let viewingEarth = false;
  let view: GalaxyMapView | null = null;
  let disposed = false;
  const bindings: { dispose(): void }[] = [];
  const current = () =>
    !disposed && view !== null && unlock === null && !("jumping" in screen.dataset);
  const leaveFocus: (() => void)[] = [];
  const register = (element: HTMLElement, run: () => void) => {
    bindings.push(
      bindAdaAction(
        {
          click: { availability: () => ({ kind: "available" }), run },
          current,
          slopPx: () => SCROLL.dragThreshold * readViewUnit(element),
        },
        element,
      ),
    );
  };
  const screen = document.createElement("div");
  screen.className = "ada-route";
  screen.dataset.dialog = "galaxies";
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.hidden = true;
  const sky = document.createElement("div");
  sky.className = "ada-route-sky";
  const rules = document.createElement("div");
  rules.className = "ada-route-rules";
  const ground = document.createElement("div");
  ground.className = "ada-route-ground";
  const chart = document.createElement("div");
  chart.className = "ada-route-chart";
  const legs = document.createElementNS(SVG, "svg");
  legs.classList.add("ada-route-legs");
  legs.setAttribute("viewBox", `0 0 ${SCREEN.width} ${SCREEN.height}`);
  legs.setAttribute("aria-hidden", "true");
  const legGroups = LEG_STAMPS.map(({ locked, open }) => {
    const dashes = stampGroup(colors.grey, locked);
    const line = stampGroup(colors.cream, open);
    legs.append(dashes, line);
    return { dashes, line };
  });
  chart.append(legs);
  const markers = POSITIONS.map((position) => {
    const selectGalaxy = () => {
      if (!view || unlock || (!viewingEarth && view.panel === position)) {
        return;
      }
      viewingEarth = false;
      options.onView(position);
      drawPanel();
      drawChart();
    };
    const kit = createButton(document, {
      appearance: { layout: "caller" },
      content: { kind: "text", label: String(position) },
      getAction: () => binding,
      getState: (button) => ({
        availability: button.hidden
          ? { kind: "omitted" }
          : button.disabled
            ? { kind: "disabled" }
            : { kind: "available" },
      }),
      rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: SCROLL.dragThreshold },
    });
    const button = kit.element;
    const binding = bindAdaAction(
      {
        click: { availability: () => ({ kind: "available" }), run: () => selectGalaxy() },
        current: () => current(),
        nativeClickOwner: "factory",
        slopPx: () => SCROLL.dragThreshold * readViewUnit(button),
      },
      button,
    );
    bindings.push({
      dispose() {
        binding.dispose();
        kit.dispose();
      },
    });
    // The chart supplies the marker's face and focus cue.
    button.className = "ada-route-marker";
    button.dataset.position = String(position);
    const centre = GALAXY_MAP.centres[position - 1]!;
    button.style.left = units(centre.x - GALAXY_MAP.press / 2);
    button.style.top = units(centre.y - GALAXY_MAP.press / 2);
    const backing = document.createElement("span");
    backing.className = "ada-route-backing";
    const disc = document.createElement("span");
    disc.className = "ada-route-disc";
    disc.textContent = String(position);
    button.replaceChildren(backing, disc);
    button.addEventListener("focus", selectGalaxy);
    leaveFocus.push(() => button.removeEventListener("focus", selectGalaxy));
    const name = document.createElement("span");
    name.className = "ada-route-label";
    name.dataset.routeLabel = String(position);
    name.style.left = units(centre.x);
    name.style.top = units(centre.y + label.top);
    return { button, name };
  });
  const shipSprite = document.createElement("div");
  shipSprite.className = "ada-route-ship";
  // The under-hull layers' canvas stays below the hull; the plume canvas rises above it when its
  // jets draw in front.
  const shipCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      height: "100%",
      inset: "0",
      position: "absolute",
      width: "100%",
    });
    return canvas;
  };
  const haloCanvas = shipCanvas();
  const jetCanvas = shipCanvas();
  const jetCanvases = [haloCanvas, jetCanvas];
  const shipHull = document.createElement("div");
  Object.assign(shipHull.style, {
    background: "center / 100% 100% no-repeat",
    inset: "0",
    position: "absolute",
  });
  const tail = createShipTailView(SHIP.size);
  Object.assign(tail.root.style, {
    height: "100%",
    inset: "0",
    pointerEvents: "none",
    position: "absolute",
    width: "100%",
    zIndex: "2",
  });
  shipSprite.append(haloCanvas, jetCanvas, shipHull, tail.root);
  let shipFrameUrl = "";
  const pulse = document.createElement("div");
  pulse.className = "ada-route-pulse";
  pulse.hidden = true;
  chart.append(
    ...markers.map(({ name }) => name),
    pulse,
    ...markers.map(({ button }) => button),
    shipSprite,
  );
  const panel = document.createElement("section");
  panel.className = "ada-route-panel";
  const shot = document.createElement("div");
  shot.className = "ada-galaxy-shot";
  const text = document.createElement("div");
  text.className = "ada-route-text";
  const number = document.createElement("h2");
  const name = document.createElement("p");
  name.className = "ada-route-name";
  const flavor = document.createElement("p");
  const development = document.createElement("p");
  development.className = "ada-route-development";
  development.textContent = labels.development;
  const earth = markers[0]!.button.cloneNode(true) as HTMLButtonElement;
  earth.dataset.position = "earth";
  earth.dataset.earth = "";
  earth.setAttribute("aria-label", labels.earthTitle);
  earth.style.left = units(
    (GALAXY_MAP.centres[0]!.x + GALAXY_MAP.centres.at(-1)!.x) / 2 - GALAXY_MAP.press / 2,
  );
  earth.querySelector(".ada-route-disc")!.textContent = "";
  const earthName = markers[0]!.name.cloneNode(true) as HTMLElement;
  earthName.dataset.routeLabel = "earth";
  earthName.textContent = labels.earthTitle;
  earthName.style.left = units((GALAXY_MAP.centres[0]!.x + GALAXY_MAP.centres.at(-1)!.x) / 2);
  chart.append(earth, earthName);
  const jumpAction = createStandardTextAction(root, labels.jump, {
    availability: () =>
      !view
        ? { kind: "omitted" }
        : viewingEarth || view.galaxies[view.panel - 1]?.unlocked
          ? { kind: "available" }
          : { kind: "unavailable", reason: labels.lockedAction },
    current,
    refuse: () => refuse(jumpAction.element, reduced()),
    run: () => {
      if (viewingEarth) {
        options.onEarth();
      } else if (view?.stay) {
        options.onClose();
      } else {
        options.onJump();
      }
    },
  });
  const jump = jumpAction.element;
  jump.classList.add("ada-primary", "ada-route-action");
  setButtonRole("primary", jump);
  bindings.push(jumpAction);
  jump.dataset.action = "galaxy-jump";
  const flightActions = document.createElement("div");
  flightActions.className = "ada-route-flight-actions";
  const closeXAction = createStandardCloseAction(root, "galaxy-close-x", labels.close, {
    current,
    run: () => options.onClose(),
    slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
    slopThreshold: SCROLL.dragThreshold,
  });
  bindings.push(closeXAction);
  const closeX = closeXAction.element;
  screen.append(sky, rules, ground, chart, closeX);
  const panelGroups: Readonly<Record<GalaxyPanelGroup, HTMLElement>> = {
    footer: flightActions,
    panel,
    screen,
    text,
  };
  const panelLeaves: Readonly<Record<GalaxyPanelLeaf, HTMLElement>> = {
    development,
    flavor,
    jump,
    name,
    number,
    shot,
  };

  let art: GalaxyMapArt | null = null;
  // The ship's route distance, current art frame and optional unlock flight.
  let distance = 0;
  let frame = -1;
  // The unlock under way, and the positions it opens that still draw locked.
  let unlock: { readonly flight: RouteFlight; readonly start: number } | null = null;
  let drawnLocked: ReadonlySet<number> = new Set();
  // The compatibility click from a pointer press that skipped the unlock.
  let skippedPointer: number | null = null;
  let skippedSpace = false;
  let animation = 0;
  let shown = "";

  const reduced = () => options.reducedMotion();

  function drawShip(thrust: boolean, direction?: Point): void {
    const { at, tangent } = shipPlace(distance);
    shipSprite.style.left = units(at.x);
    shipSprite.style.top = units(at.y);
    const heading = routeHeading(direction ?? tangent);
    const key = (thrust ? 1 : 0) * 100 + heading;
    if (art) {
      frame = key;
      const url = art.ship(thrust)[heading] || art.ship(false)[heading] || "";
      if (url !== shipFrameUrl) {
        shipFrameUrl = url;
        shipHull.style.backgroundImage = url ? `url('${url}')` : "none";
      }
    }
    const jets = thrust && !reduced() ? art?.jets?.() : undefined;
    const tailRegions = jetOccluderRegions(
      jets,
      { displayHeight: SHIP.size, displayWidth: SHIP.size, pivot: { x: 0.5, y: 0.5 } },
      heading,
    );
    tail.set(
      shipFrameUrl,
      tailRegions.map((region) =>
        region.map(({ x, y }) => `${SHIP.size / 2 + x},${SHIP.size / 2 + y}`).join(" "),
      ),
    );
    jetCanvas.style.zIndex = jetsInFront(jets, heading) ? "1" : "";
    for (const canvas of jetCanvases) {
      canvas.hidden = !jets;
    }
    if (jets) {
      const side = Math.max(
        1,
        Math.ceil(SHIP.size * readViewUnit(root) * (window.devicePixelRatio || 1)),
      );
      for (const [canvas, underHull] of [
        [haloCanvas, true],
        [jetCanvas, false],
      ] as const) {
        if (canvas.width !== side || canvas.height !== side) {
          canvas.width = side;
          canvas.height = side;
        }
        const context = canvas.getContext("2d");
        if (context) {
          context.setTransform(side / SHIP.size, 0, 0, side / SHIP.size, 0, 0);
          context.clearRect(0, 0, SHIP.size, SHIP.size);
          drawShipJets(
            context,
            jetLayerPass(underHull, jets),
            {
              displayHeight: SHIP.size,
              displayWidth: SHIP.size,
              pivot: { x: 0.5, y: 0.5 },
            },
            heading,
            { x: SHIP.size / 2, y: SHIP.size / 2 },
          );
        }
      }
    }
  }

  function restShip(position: RoutePosition): void {
    distance = routeDistance(position);
    drawShip(false, restingTangent(position));
  }

  // Each marker, label and leg in its face: a position the unlock has yet to open draws locked,
  // and the unlock draws its own legs on.
  function drawChart(): void {
    if (!view) {
      return;
    }
    for (const [index, { button, name: tag }] of markers.entries()) {
      const position = (index + 1) as RoutePosition;
      const galaxy = view.galaxies[index]!;
      const open = galaxy.unlocked && !drawnLocked.has(position);
      button.style.setProperty("--hue", open ? galaxy.hue : (art?.locked ?? colors.grey));
      tag.textContent = open ? galaxy.name : labels.locked;
      tag.toggleAttribute("data-locked", !open);
      button.setAttribute(
        "aria-label",
        `${labels.number.replace("{number}", String(position))}, ${open ? galaxy.name : labels.locked}`,
      );
      button.toggleAttribute("data-selected", !unlock && !viewingEarth && position === view.panel);
    }
    earth.toggleAttribute("data-selected", viewingEarth);
    for (const [index, group] of legGroups.entries()) {
      const destination = (index + 2) as RoutePosition;
      if (unlock?.flight.opened.includes(destination) && !reduced()) {
        continue;
      }
      const open = view.galaxies[destination - 1]!.unlocked && !drawnLocked.has(destination);
      group.dashes.style.display = open ? "none" : "";
      group.line.style.display = open ? "" : "none";
    }
  }

  function drawPanel(): void {
    if (!view) {
      return;
    }
    jumpAction.setLabel(destinationAction(labels, viewingEarth, view));
    jumpAction.refresh();
    if (viewingEarth) {
      number.textContent = labels.earthKicker;
      name.textContent = labels.earthTitle;
      flavor.textContent = labels.earthDescription;
      development.hidden = true;
      text.removeAttribute("data-locked");
      screen.setAttribute("aria-label", labels.earthTitle);
      setStoryScenePreview(art?.homeScene, art?.homePreview, shot);
      return;
    }
    const galaxy = view.galaxies[view.panel - 1]!;
    const title = labels.number.replace("{number}", String(view.panel));
    number.textContent = title;
    screen.setAttribute("aria-label", title);
    text.toggleAttribute("data-locked", !galaxy.unlocked);
    name.textContent = galaxy.unlocked ? galaxy.name : labels.locked;
    flavor.textContent = galaxy.unlocked ? galaxy.flavor : labels.locked;
    development.hidden = !(galaxy.unlocked && galaxy.placeholder);
    const preview = galaxy.unlocked ? galaxy.preview.open : galaxy.preview.locked;
    setStoryScenePreview(undefined, preview, shot);
  }

  function stop(): void {
    cancelAnimationFrame(animation);
    animation = 0;
  }

  function frameLoop(now: number): void {
    animation = 0;
    if (!view || !unlock) {
      return;
    }
    stepUnlock(now);
    if (unlock) {
      startLoop();
    }
  }

  function startLoop(): void {
    if (!animation) {
      animation = requestAnimationFrame(frameLoop);
    }
  }

  // The unlock's steps (GALAXY_MAP_MOVE.unlock): the new markers and legs open over 300 ms, a ring
  // pulses on the farthest, then at 400 ms the ship flies there; reduced motion fades the ship
  // out, switches the markers at 150 ms and fades it in at the new galaxy.
  function stepUnlock(now: number): void {
    const { flight, start } = unlock!;
    const elapsed = (now - start) / 1000;
    if (reduced()) {
      const fade = GALAXY_MAP_MOVE.reduced.fade / 1000;
      shipSprite.style.opacity = elapsed < fade ? "0" : "1";
      if (elapsed >= fade && drawnLocked.size > 0) {
        drawnLocked = new Set();
        restShip(flight.to);
        drawChart();
      }
      if (elapsed >= 2 * fade) {
        endFlight();
      }
      return;
    }
    const { depart, fade, pulse: ring } = GALAXY_MAP_MOVE.unlock;
    const from = routeDistance(flight.from);
    const to = routeDistance(flight.to);
    // The new legs draw along the route from the ship's marker.
    const drawn = from + (to - from) * Math.min(1, elapsed / fade);
    for (const [index, { open, start: legStart }] of LEG_STAMPS.entries()) {
      if (!flight.opened.includes((index + 2) as RoutePosition)) {
        continue;
      }
      const group = legGroups[index]!;
      group.line.style.display = "";
      for (const [at, rect] of [...group.line.children].entries()) {
        (rect as SVGElement).style.display = legStart + open[at]!.distance <= drawn ? "" : "none";
      }
      if (elapsed >= fade) {
        group.dashes.style.display = "none";
      }
    }
    const p = Math.min(1, elapsed / depart);
    const radius = ring.from + (ring.to - ring.from) * p;
    const centre = GALAXY_MAP.centres[flight.to - 1]!;
    pulse.hidden = p >= 1;
    pulse.style.left = units(centre.x - radius);
    pulse.style.top = units(centre.y - radius);
    pulse.style.width = units(2 * radius);
    pulse.style.height = units(2 * radius);
    pulse.style.opacity = String(ring.alpha * (1 - p));
    if (elapsed < depart) {
      return;
    }
    const seconds = unlockFlightSeconds(Math.abs(to - from));
    const t = (elapsed - depart) / seconds;
    distance = from + (to - from) * easeInOutSine(t);
    drawShip(true);
    if (t >= 1) {
      endFlight();
    }
  }

  function beginUnlock(flight: RouteFlight): void {
    invalidatePressScope(root);
    unlock = { flight, start: options.now() };
    screen.dataset.flight = "";
    closeX.hidden = true;
    drawnLocked = new Set(flight.opened);
    restShip(flight.from);
    earth.toggleAttribute("data-selected", viewingEarth);
    for (const [index, group] of legGroups.entries()) {
      if (flight.opened.includes((index + 2) as RoutePosition)) {
        group.dashes.style.display = "";
        group.line.style.display = "none";
      }
    }
    drawChart();
    pulse.style.setProperty("--hue", view!.galaxies[flight.to - 1]!.hue);
    // The new markers crossfade to their hues from the next frame.
    if (!reduced()) {
      requestAnimationFrame(() => {
        if (unlock?.flight === flight) {
          drawnLocked = new Set();
          drawChart();
        }
      });
    }
    startLoop();
  }

  // The arrival: the idle frame, selection and panel on the new galaxy, focus on Jump.
  function endFlight(): void {
    if (!unlock) {
      return;
    }
    const { flight } = unlock;
    invalidatePressScope(root);
    unlock = null;
    delete screen.dataset.flight;
    closeX.hidden = false;
    drawnLocked = new Set();
    pulse.hidden = true;
    shipSprite.style.opacity = "1";
    for (const group of legGroups) {
      for (const rect of group.line.children) {
        (rect as SVGElement).style.display = "";
      }
    }
    restShip(flight.to);
    drawChart();
    options.onFlightEnd();
    panel.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: GALAXY_MAP_MOVE.arrival.panel });
    focusTarget(jump);
  }

  // During the unlock, a tap, key or button press jumps to the arrived state and does nothing
  // else.
  screen.addEventListener(
    "pointerdown",
    (event) => {
      if (unlock) {
        skippedPointer = event.pointerId;
        event.preventDefault();
        event.stopPropagation();
        endFlight();
      } else if (skippedPointer === event.pointerId) {
        skippedPointer = null;
      }
    },
    true,
  );
  screen.addEventListener(
    "keydown",
    (event) => {
      const space = event.key === " ";
      if (space && !event.repeat) {
        skippedSpace = false;
      }
      if (!unlock && !(space && skippedSpace)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (unlock) {
        skippedSpace = space;
        endFlight();
      }
    },
    true,
  );
  screen.addEventListener(
    "keyup",
    (event) => {
      // Space activates on keyup, even though a cancelled keydown can prevent its click.
      if (event.key === " " && skippedSpace) {
        skippedSpace = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
  screen.addEventListener(
    "click",
    (event) => {
      if (event.detail !== 0 && event.pointerId === skippedPointer) {
        skippedPointer = null;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  const selectEarth = () => {
    if (!view || unlock) {
      return;
    }
    viewingEarth = true;
    drawPanel();
    drawChart();
  };
  register(earth, selectEarth);
  earth.addEventListener("focus", selectEarth);
  leaveFocus.push(() => earth.removeEventListener("focus", selectEarth));
  // The chart owns horizontal route steps and the unlock cutscene's input.
  const ownsChartKey = (event: KeyboardEvent) =>
    event.target instanceof Node &&
    screen.contains(event.target) &&
    (unlock !== null || event.key === "ArrowRight" || event.key === "ArrowLeft");
  screen.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      viewingEarth = false;
      options.onStep(event.key === "ArrowRight" ? 1 : -1);
      drawPanel();
      drawChart();
    }
  });
  const releaseActions = () => {
    for (const binding of bindings) {
      binding.dispose();
    }
    for (const leave of leaveFocus) {
      leave();
    }
  };
  let panelLayout: ReturnType<typeof mountLayout<GalaxyPanelSchema>> | undefined;
  try {
    // The native chart already contains its markers. The Jump leaf joins the screen at mount.
    assertAdaActionMetadata(screen);
    assertAdaActionMetadata(jump);
    panelLayout = mountLayout<GalaxyPanelSchema>(
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
            create: (name) => ({
              dispose() {},
              element: panelLeaves[name],
              slots: {},
              update() {},
            }),
            slots: [],
          },
        },
        host: root,
      },
      galaxyPanelTree(),
    );
    assertAdaActionBindings(screen);
  } catch (error) {
    releaseActions();
    panelLayout?.dispose();
    screen.remove();
    throw error;
  }
  const leaveForeground = registerForegroundSurface({
    dismiss: () => ({
      activate: options.onClose,
      available: () => !screen.hidden,
      element: screen,
    }),
    preserveKey: ownsChartKey,
    root: screen,
    tabTargets: () => [...markers.map(({ button }) => button), earth, jump, closeX],
  });
  return {
    /** The warp ship now draws over Ada's, which hides until the map closes. */
    coverShip(): void {
      screen.dataset.shipCovered = "";
    },
    dispose(): void {
      disposed = true;
      leaveForeground();
      releaseActions();
      stop();
      panelLayout.dispose();
    },
    isOpen: () => view !== null,
    /** A quantum jump begins: the panel and the destination action hide until the map closes. */
    jump(): void {
      invalidatePressScope(root);
      screen.dataset.jumping = "";
      closeX.hidden = true;
    },
    /** The sky, ground, figures and ship frames, once loaded. */
    setArt(next: GalaxyMapArt): void {
      art = next;
      sky.style.backgroundImage = `url('${art.sky}')`;
      ground.style.backgroundImage = `url('${art.ground}')`;
      ground.replaceChildren(
        ...art.figures.map((figure) => {
          const element = document.createElement("div");
          element.className = "ada-route-figure";
          element.style.left = units(figure.x);
          element.style.top = units(figure.y);
          element.style.width = units(figure.width);
          element.style.height = units(figure.height);
          element.style.backgroundImage = `url('${figure.url}')`;
          return element;
        }),
      );
      drawPanel();
      frame = -1;
      if (view && !unlock) {
        restShip(view.ship);
      }
    },
    /** Ada's heading frame as drawn: at rest, the galaxy's rest heading. */
    shipHeading(): number | null {
      if (frame >= 0) {
        return frame % 100;
      }
      return view ? routeHeading(restingTangent(view.ship)) : null;
    },
    show(next: GalaxyMapView | null): void {
      const signature = JSON.stringify(next);
      if (signature === shown) {
        return;
      }
      shown = signature;
      const previous = view;
      if ((previous === null) !== (next === null)) {
        invalidatePressScope(root);
      }
      view = next;
      screen.hidden = view === null;
      if (!view) {
        viewingEarth = false;
        skippedPointer = null;
        skippedSpace = false;
        stop();
        unlock = null;
        delete screen.dataset.flight;
        delete screen.dataset.jumping;
        closeX.hidden = false;
        delete screen.dataset.shipCovered;
        drawnLocked = new Set();
        return;
      }
      drawPanel();
      if (!previous) {
        if (view.flight) {
          beginUnlock(view.flight);
        } else {
          restShip(view.ship);
          drawChart();
        }
        focusTarget(jump);
        return;
      }
      if (unlock) {
        return;
      }
      if (previous.ship !== view.ship) {
        restShip(view.ship);
      }
      drawChart();
    },
  };
}
