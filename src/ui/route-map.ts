import { GALAXY_COUNT, type RoutePosition } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import type { RouteFlight } from "../model/game.ts";
import { CARD_CLOSE } from "./layout/cardFrame.ts";
import { CARD_SLICE } from "./layout/controls.ts";
import { font, fromAreaLeft, fromHudEdge, safeEdge, slice, units } from "./layout/css.ts";
import { SAFE_MARGIN } from "./layout/playView.ts";
import {
  easeInOutSine,
  pathStamps,
  type Point,
  restingTangent,
  ROUTE_ACTIONS,
  ROUTE_LEGS,
  ROUTE_MAP,
  ROUTE_MOVE,
  ROUTE_PANEL,
  ROUTE_SKY,
  ROUTE_SKY_LEFT,
  routeDistance,
  routeHeading,
  routePoint,
  selectionSeconds,
  type Stamp,
  unlockFlightSeconds,
} from "./layout/routeMap.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createButton, FOCUS_STYLE, isTap, MODAL_LAYER } from "./modal.ts";
import { refuse } from "./refusal.ts";

// Galaxy selection as a route map (art/layout.md "Galaxy selector"), after Chibi's MapScene:
// the route sky and ground, the chart's legs, markers, labels and Ada's ship, the panel for the
// chosen galaxy, Earth and Jump, and the close X on the HUD rect's corner. The model holds the
// ship's galaxy, a locked galaxy viewed in the panel and the unlock flight; this draws them and
// animates the ship between them.

export interface RouteMapLabels {
  readonly close: string;
  /** A placeholder galaxy's line under its flavour line. */
  readonly development: string;
  readonly home: string;
  readonly jump: string;
  readonly locked: string;
  /** "Galaxy {number}". */
  readonly number: string;
}

/** One route position's galaxy, in route order. */
export interface RouteGalaxy {
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

export interface RouteMapView {
  readonly flight: RouteFlight | null;
  /** Every galaxy, in route order. */
  readonly galaxies: readonly RouteGalaxy[];
  /** The route position the panel shows: the ship's, or a locked galaxy viewed. */
  readonly panel: RoutePosition;
  /** The route position the ship is on. */
  readonly ship: RoutePosition;
}

/** The route sky, its ground and figures, and Ada's ship frames by heading. */
export interface RouteMapArt {
  readonly figures: readonly {
    readonly height: number;
    readonly url: string;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  }[];
  readonly ground: string;
  /** The shared locked grey (galaxies.json `marker.locked`). */
  readonly locked: string;
  /** The ship's 32 heading frames, idle or on thrust; empty strings where none loaded. */
  readonly ship: (thrust: boolean) => readonly string[];
  readonly sky: string;
}

export interface RouteMapOptions {
  readonly labels: RouteMapLabels;
  /** Earth, the close X and an outside tap: Ada's room, without a jump. */
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

const { colors, label, marker, path, ship: SHIP } = ROUTE_MAP;
const POSITIONS = Array.from({ length: GALAXY_COUNT }, (_, i) => (i + 1) as RoutePosition);

// Ink at an alpha, as a colour rather than opacity, so the backing stays under the disc it backs.
const inkAt = (alpha: number) =>
  `${colors.ink}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;

export const ROUTE_MAP_STYLE = `
.ada-controls .ada-route{
  position:absolute;
  inset:0;
  z-index:${MODAL_LAYER};
  overflow:hidden;
  background:${ROUTE_SKY.top};
  pointer-events:auto
}
.ada-controls .ada-route-sky,
.ada-controls .ada-route-ground{
  position:absolute;
  left:${fromAreaLeft(ROUTE_SKY_LEFT)};
  width:${units(ROUTE_SKY.sky.width)};
  background:center / 100% 100% no-repeat
}
.ada-controls .ada-route-sky{
  top:0;
  height:${units(ROUTE_SKY.sky.height)}
}
.ada-controls .ada-route-ground{
  bottom:0;
  height:${units(ROUTE_SKY.ground.height)}
}
.ada-controls .ada-route-figure{
  position:absolute;
  background:center / 100% 100% no-repeat;
  image-rendering:pixelated
}
/* The available rect's two inset rules, over the sky and under the ground. */
.ada-controls .ada-route-rules{
  position:absolute;
  top:${safeEdge("top", SAFE_MARGIN.page)};
  right:${safeEdge("right", SAFE_MARGIN.page)};
  bottom:${safeEdge("bottom", SAFE_MARGIN.page)};
  left:${safeEdge("left", SAFE_MARGIN.page)};
  border:${slice(ROUTE_MAP.rules.width)} solid ${ROUTE_MAP.rules.outer};
  pointer-events:none
}
.ada-controls .ada-route-rules::after{
  content:"";
  position:absolute;
  inset:${units(ROUTE_MAP.rules.inset - ROUTE_MAP.rules.width)};
  border:${slice(ROUTE_MAP.rules.width)} solid ${ROUTE_MAP.rules.inner}
}
/* The chart, in play-view px from the game area's top-left. */
.ada-controls .ada-route-chart{
  position:absolute;
  top:0;
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
  width:${units(ROUTE_MAP.press)};
  height:${units(ROUTE_MAP.press)};
  margin:0;
  padding:0;
  border:0;
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
.ada-controls .ada-route-frame{
  width:${units(marker.frame)};
  height:${units(marker.frame)}
}
.ada-controls .ada-route-marker:focus-visible{
  outline:none
}
.ada-controls .ada-route-marker:focus-visible .ada-route-frame{
  ${FOCUS_STYLE}
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
  transition:background-color ${ROUTE_MOVE.unlock.fade}s ease-out
}
.ada-controls .ada-route-ring{
  width:${units(2 * (marker.ring.radius + marker.ring.width / 2))};
  height:${units(2 * (marker.ring.radius + marker.ring.width / 2))};
  border:${units(marker.ring.width)} solid ${marker.ring.color};
  opacity:0;
  transition:opacity ${ROUTE_MOVE.arrival.ring / 1000}s linear
}
.ada-controls .ada-route-marker[data-selected] .ada-route-ring{
  opacity:1
}
.ada-controls .ada-route-pulse{
  position:absolute;
  box-sizing:border-box;
  border-radius:50%;
  border:${units(ROUTE_MOVE.unlock.pulse.width)} solid var(--hue);
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
.ada-controls .ada-route-label[data-locked]{
  color:${colors.grey}
}
.ada-controls .ada-route-ship{
  position:absolute;
  width:${units(SHIP.size)};
  height:${units(SHIP.size)};
  background:center / 100% 100% no-repeat;
  transition:opacity ${ROUTE_MOVE.reduced.fade / 1000}s linear
}
/* The panel: a card face 614 by 112 centred on the play view, a gap above the actions. */
.ada-controls .ada-route-panel{
  position:absolute;
  box-sizing:border-box;
  left:${fromAreaLeft((SCREEN.width - ROUTE_PANEL.width) / 2)};
  bottom:calc(${safeEdge("bottom", SAFE_MARGIN.page)} + ${units(ROUTE_ACTIONS.height + SPACING.gap)});
  width:${units(ROUTE_PANEL.width)};
  height:${units(ROUTE_PANEL.height)};
  padding:${units(ROUTE_PANEL.padding - CARD_SLICE)};
  display:flex;
  align-items:flex-start;
  gap:${units(ROUTE_PANEL.text.left - ROUTE_PANEL.padding - ROUTE_PANEL.capture.width - 2 * ROUTE_PANEL.capture.frame)};
  background:#3b3850;
  border:${slice(CARD_SLICE)} solid #6b6685;
  border-image:url('/art/ui/sprites/ui-settings-card.png') ${CARD_SLICE} fill / ${slice(CARD_SLICE)} stretch;
  image-rendering:pixelated;
  pointer-events:auto
}
.ada-controls .ada-route-panel .ada-galaxy-shot{
  flex:none;
  box-sizing:content-box;
  width:${units(ROUTE_PANEL.capture.width)};
  height:${units(ROUTE_PANEL.capture.height)};
  border:${slice(ROUTE_PANEL.capture.frame)} solid ${ROUTE_PANEL.capture.frameColor};
  background:${colors.ink} center / 100% 100% no-repeat
}
.ada-controls .ada-route-text{
  flex:none;
  width:${units(ROUTE_PANEL.text.width)};
  display:flex;
  flex-direction:column;
  gap:${units(ROUTE_PANEL.rowGap)};
  font:${font(TYPE.body)};
  color:${ROUTE_PANEL.colors.flavor}
}
.ada-controls .ada-route-text h2{
  margin:0;
  font:${font(TYPE.body)};
  color:${ROUTE_PANEL.colors.number}
}
.ada-controls .ada-route-text .ada-route-name{
  margin:0;
  font:${font(TYPE.heading)};
  color:${ROUTE_PANEL.colors.name}
}
.ada-controls .ada-route-text p{
  margin:0
}
.ada-controls .ada-route-text[data-locked] .ada-route-name,
.ada-controls .ada-route-text[data-locked] p,
.ada-controls .ada-route-development{
  color:${ROUTE_PANEL.colors.development}
}
.ada-controls .ada-route-action{
  position:absolute;
  bottom:${safeEdge("bottom", SAFE_MARGIN.page)};
  width:${units(ROUTE_ACTIONS.width)}
}
.ada-controls .ada-route-action[data-action="galaxy-home"]{
  left:${fromAreaLeft(ROUTE_ACTIONS.earth)}
}
.ada-controls .ada-route-action[data-action="galaxy-jump"]{
  left:${fromAreaLeft(ROUTE_ACTIONS.jump)}
}
/* The close X: its 24 face's top and right edges on the HUD rect's top-right corner. */
.ada-controls .ada-route .ada-close{
  top:${fromHudEdge("top", -(CARD_CLOSE.hit.height - CARD_CLOSE.art.height) / 2)};
  right:${fromHudEdge("right", -(CARD_CLOSE.hit.width - CARD_CLOSE.art.width) / 2)}
}
`;

/** A leg's open and locked stamps in play-view px, and where each sits along the route. */
interface LegStamps {
  readonly locked: readonly Stamp[];
  readonly open: readonly Stamp[];
  readonly start: number;
}

const LEG_STAMPS: readonly LegStamps[] = ROUTE_LEGS.map((curve, index) => ({
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

/** A move of the ship along the route: from one distance to another over `seconds`. */
interface Move {
  readonly from: number;
  readonly seconds: number;
  readonly start: number;
  readonly thrust: boolean;
  readonly to: number;
}

export function createRouteMap(root: HTMLElement, options: RouteMapOptions) {
  const { labels } = options;
  const style = document.createElement("style");
  style.textContent = ROUTE_MAP_STYLE;
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ada-route-marker";
    button.dataset.position = String(position);
    const centre = ROUTE_MAP.centres[position - 1]!;
    button.style.left = units(centre.x - ROUTE_MAP.press / 2);
    button.style.top = units(centre.y - ROUTE_MAP.press / 2);
    const backing = document.createElement("span");
    backing.className = "ada-route-backing";
    const frame = document.createElement("span");
    frame.className = "ada-route-frame";
    const disc = document.createElement("span");
    disc.className = "ada-route-disc";
    disc.textContent = String(position);
    const ring = document.createElement("span");
    ring.className = "ada-route-ring";
    button.append(backing, ring, frame, disc);
    button.addEventListener("click", () => options.onView(position));
    button.addEventListener("focus", () => {
      if (!unlock) {
        options.onView(position);
      }
    });
    const name = document.createElement("span");
    name.className = "ada-route-label";
    name.style.left = units(centre.x);
    name.style.top = units(centre.y + label.top);
    return { button, name };
  });
  const shipSprite = document.createElement("div");
  shipSprite.className = "ada-route-ship";
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
  text.append(number, name, flavor, development);
  panel.append(shot, text);
  const earth = createButton(labels.home);
  earth.classList.add("ada-route-action");
  earth.dataset.action = "galaxy-home";
  const jump = createButton(labels.jump, "primary");
  jump.classList.add("ada-route-action");
  jump.dataset.action = "galaxy-jump";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ada-close";
  close.dataset.action = "close-galaxies";
  close.setAttribute("aria-label", labels.close);
  screen.append(sky, rules, ground, chart, panel, earth, jump, close);
  root.append(style, screen);

  let view: RouteMapView | null = null;
  let art: RouteMapArt | null = null;
  // Where the ship is along the route, its move under way and its frame.
  let distance = 0;
  let move: Move | null = null;
  let frame = -1;
  // The unlock under way, and the positions it opens that still draw locked.
  let unlock: { readonly flight: RouteFlight; readonly start: number } | null = null;
  let drawnLocked: ReadonlySet<number> = new Set();
  // A press that skipped the unlock, whose click then does nothing else.
  let swallow = false;
  let animation = 0;
  let shown = "";

  const reduced = () => options.reducedMotion();

  function drawShip(thrust: boolean, direction?: Point): void {
    const { at, tangent } = shipPlace(distance);
    shipSprite.style.left = units(at.x);
    shipSprite.style.top = units(at.y);
    const heading = routeHeading(direction ?? tangent);
    const key = (thrust ? 1 : 0) * 100 + heading;
    if (key !== frame && art) {
      frame = key;
      const url = art.ship(thrust)[heading] || art.ship(false)[heading] || "";
      shipSprite.style.backgroundImage = url ? `url('${url}')` : "none";
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
      button.toggleAttribute("data-selected", !unlock && !move && position === view.ship);
    }
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
    const galaxy = view.galaxies[view.panel - 1]!;
    const title = labels.number.replace("{number}", String(view.panel));
    number.textContent = title;
    screen.setAttribute("aria-label", title);
    text.toggleAttribute("data-locked", !galaxy.unlocked);
    name.textContent = galaxy.unlocked ? galaxy.name : labels.locked;
    flavor.textContent = galaxy.unlocked ? galaxy.flavor : labels.locked;
    development.hidden = !(galaxy.unlocked && galaxy.placeholder);
    const preview = galaxy.unlocked ? galaxy.preview.open : galaxy.preview.locked;
    shot.style.backgroundImage = preview ? `url('${preview}')` : "none";
    jump.classList.toggle("ada-unavailable", !galaxy.unlocked);
    if (galaxy.unlocked) {
      jump.removeAttribute("aria-disabled");
    } else {
      jump.setAttribute("aria-disabled", "true");
    }
  }

  function stop(): void {
    cancelAnimationFrame(animation);
    animation = 0;
  }

  function frameLoop(now: number): void {
    animation = 0;
    if (!view) {
      return;
    }
    if (unlock) {
      stepUnlock(now);
    } else if (move) {
      const t = (now - move.start) / 1000 / move.seconds;
      distance = move.from + (move.to - move.from) * easeInOutSine(t);
      const { tangent } = routePoint(distance);
      const back = move.to < move.from;
      drawShip(move.thrust, back ? { x: -tangent.x, y: -tangent.y } : tangent);
      if (t >= 1) {
        move = null;
        restShip(view.ship);
        drawChart();
      }
    }
    if (unlock || move) {
      animation = requestAnimationFrame(frameLoop);
    }
  }

  function startLoop(): void {
    if (!animation) {
      animation = requestAnimationFrame(frameLoop);
    }
  }

  // The unlock's steps (ROUTE_MOVE.unlock): the new markers and legs open over 300 ms, a ring
  // pulses on the farthest, then at 400 ms the ship flies there; reduced motion fades the ship
  // out, switches the markers at 150 ms and fades it in at the new galaxy.
  function stepUnlock(now: number): void {
    const { flight, start } = unlock!;
    const elapsed = (now - start) / 1000;
    if (reduced()) {
      const fade = ROUTE_MOVE.reduced.fade / 1000;
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
    const { depart, fade, pulse: ring } = ROUTE_MOVE.unlock;
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
    const centre = ROUTE_MAP.centres[flight.to - 1]!;
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
    unlock = { flight, start: performance.now() };
    screen.dataset.flight = "";
    drawnLocked = new Set(flight.opened);
    restShip(flight.from);
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

  // The arrival: the idle frame, the ring and panel on the new galaxy, focus on Jump.
  function endFlight(): void {
    if (!unlock) {
      return;
    }
    const { flight } = unlock;
    unlock = null;
    delete screen.dataset.flight;
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
    panel.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: ROUTE_MOVE.arrival.panel });
    jump.focus();
  }

  // During the unlock, a tap, key or button press jumps to the arrived state and does nothing
  // else.
  screen.addEventListener(
    "pointerdown",
    (event) => {
      swallow = unlock !== null;
      if (unlock) {
        event.preventDefault();
        event.stopPropagation();
        endFlight();
      }
    },
    true,
  );
  screen.addEventListener(
    "keydown",
    (event) => {
      if (unlock) {
        // Space clicks on its key up; that click only skips too.
        swallow = event.key === " ";
        event.preventDefault();
        event.stopPropagation();
        endFlight();
      }
    },
    true,
  );
  screen.addEventListener(
    "click",
    (event) => {
      if (swallow) {
        swallow = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  earth.addEventListener("click", () => options.onEarth());
  close.addEventListener("click", () => options.onEarth());
  jump.addEventListener("click", () => {
    const galaxy = view?.galaxies[view.panel - 1];
    if (galaxy?.unlocked) {
      options.onJump();
    } else {
      refuse(jump, reduced());
    }
  });
  // The arrows walk the route wherever focus is; Tab stays on the map, markers in route order,
  // then Earth, Jump and the close X.
  screen.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      options.onStep(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const order = [...markers.map(({ button }) => button), earth, jump, close];
    event.preventDefault();
    const at = order.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.shiftKey ? -1 : 1;
    const next = at < 0 ? (event.shiftKey ? order.length - 1 : 0) : at + step;
    order[(next + order.length) % order.length]!.focus();
  });
  // An outside tap: one on the sky or ground, off every control and the panel.
  let outside: Point | undefined;
  screen.addEventListener("pointerdown", (event) => {
    const target = event.target as Element;
    outside = target.closest("button, .ada-route-panel")
      ? undefined
      : { x: event.clientX, y: event.clientY };
  });
  screen.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (
      outside &&
      !target.closest("button, .ada-route-panel") &&
      isTap(readViewUnit(screen), outside, { x: event.clientX, y: event.clientY })
    ) {
      options.onEarth();
    }
    outside = undefined;
  });

  return {
    dispose(): void {
      stop();
      style.remove();
      screen.remove();
    },
    isOpen: () => view !== null,
    /** The sky, ground, figures and ship frames, once loaded. */
    setArt(next: RouteMapArt): void {
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
      frame = -1;
      if (view && !unlock && !move) {
        restShip(view.ship);
      }
    },
    show(next: RouteMapView | null): void {
      const signature = JSON.stringify(next);
      if (signature === shown) {
        return;
      }
      shown = signature;
      const previous = view;
      view = next;
      screen.hidden = view === null;
      if (!view) {
        stop();
        unlock = null;
        delete screen.dataset.flight;
        drawnLocked = new Set();
        move = null;
        return;
      }
      drawPanel();
      if (!previous) {
        move = null;
        if (view.flight) {
          beginUnlock(view.flight);
        } else {
          restShip(view.ship);
          drawChart();
        }
        jump.focus();
        return;
      }
      if (unlock) {
        return;
      }
      const to = routeDistance(view.ship);
      if (previous.ship !== view.ship && Math.abs(to - distance) < path.step) {
        restShip(view.ship);
      } else if (previous.ship !== view.ship) {
        if (reduced()) {
          move = null;
          restShip(view.ship);
        } else {
          move = {
            from: distance,
            seconds: selectionSeconds(Math.abs(to - distance)),
            start: performance.now(),
            thrust: false,
            to,
          };
          startLoop();
        }
      }
      drawChart();
    },
  };
}
