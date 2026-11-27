import type { SpacePalette } from "../art/index.ts";
import { SUNFLOWER_CAPITAL_BOSS, WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import { andromedaCourierMarkers } from "../model/andromeda.ts";
import { toScreen } from "../model/convex.ts";
import { mantaEscortPhase } from "../model/earlyEncounterPatterns.ts";
import { enemyPartOutline } from "../model/enemyBody.ts";
import { activeCrossbowSector, activeEnemyBeams } from "../model/flight.ts";
import { flightWorldContext } from "../model/flightTopology.ts";
import { requiredFrigateEscortId } from "../model/frigateEscorts.ts";
import type { FlightState, Vec } from "../model/types.ts";
import { worldDistance, worldPoint } from "../model/worldContacts.ts";
import { LIGHT_FIELD } from "./lightField.ts";
import { drawEncounterRoute } from "./scenePhantomBlockade.ts";

interface Segment {
  readonly from: Vec;
  readonly to: Vec;
}

interface EarlyEncounterScene {
  readonly overlay: {
    lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
    lineStyle(width: number, color: number, alpha?: number): unknown;
  };
  readonly palette: SpacePalette;
  project(point: Vec): Vec;
}

const plus = (point: Vec, offset: Vec): Vec => ({ x: point.x + offset.x, y: point.y + offset.y });

function stroke(
  scene: EarlyEncounterScene,
  color: number,
  width: number,
  alpha: number,
  segments: readonly Segment[],
): void {
  if (!segments.length) {
    return;
  }
  const { overlay } = scene;
  const lines = () => {
    for (const { from, to } of segments) {
      overlay.lineBetween(from.x, from.y, to.x, to.y);
    }
  };
  overlay.lineStyle(width + 2, LIGHT_FIELD.ink, alpha);
  lines();
  overlay.lineStyle(width, color, alpha);
  lines();
}

/** Steady, high-contrast warning marks. Timing comes entirely from the model. */
function dashes({ from, to }: Segment): Segment[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const pointAt = (distance: number) => ({
    x: from.x + (dx * distance) / length,
    y: from.y + (dy * distance) / length,
  });
  const result: Segment[] = [];
  for (let at = 0; at < length; at += 20) {
    result.push({ from: pointAt(at), to: pointAt(Math.min(at + 12, length)) });
  }
  return result;
}

function inView({ x, y }: Vec): boolean {
  return x >= 0 && x <= SCREEN.width && y >= 0 && y <= SCREEN.height;
}

function drawHammer(scene: EarlyEncounterScene, flight: FlightState): void {
  const beam = activeEnemyBeams(flight).find(
    (entry) => entry.ownerId === SUNFLOWER_CAPITAL_BOSS.id && entry.authored && !entry.fired,
  );
  if (!beam?.hardpointId) {
    return;
  }
  const hammer = flight.objects.find(({ id }) => id === beam.ownerId);
  if (
    !hammer?.enemy ||
    !hammer.enemy.hardpoints.some(({ hp, id }) => id === beam.hardpointId && hp > 0)
  ) {
    return;
  }
  const origin = scene.project(hammer);
  const parts = enemyPartOutline(ROUTE_POSITION[flight.galaxy], hammer.enemy, beam.hardpointId);
  if (parts) {
    stroke(
      scene,
      scene.palette.shipHardpoint,
      2,
      0.95,
      parts.flatMap((part) =>
        part.map((from, index) => ({
          from: plus(origin, from),
          to: plus(origin, part[(index + 1) % part.length]!),
        })),
      ),
    );
  }
}

function drawManta(scene: EarlyEncounterScene, flight: FlightState): void {
  const leader = flight.objects.find(({ id }) => id === WHIRLPOOL_CAPITAL_BOSS.id);
  const state = leader?.enemy?.earlyEncounter;
  if (!leader || state?.kind !== "manta" || leader.enemy?.disabled || leader.hp <= 0) {
    return;
  }
  const phase = mantaEscortPhase(state.elapsed);
  if (phase.escort === null) {
    return;
  }
  const escortId = requiredFrigateEscortId(leader.id, phase.escort);
  const escort = flight.objects.find(({ id }) => id === escortId);
  if (!escort?.enemy || escort.hp <= 0 || escort.enemy.returning || escort.enemy.fleeing) {
    return;
  }
  const course = state.courses[phase.escort];
  const origin = scene.project(leader);
  const from = plus(origin, toScreen(course.entry));
  const to = plus(origin, toScreen(course.exit));
  if (!inView(from) && !inView(to)) {
    return;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = Math.hypot(dx, dy);
  if (!span) {
    return;
  }
  const arrow = [-1, 1].map((side) => ({
    from: {
      x: to.x + (-dx * 8 - dy * 4 * side) / span,
      y: to.y + (-dy * 8 + dx * 4 * side) / span,
    },
    to,
  }));
  const path = { from, to };
  stroke(scene, scene.palette.threat, 1.5, 0.85, [
    ...(phase.kind === "approach" ? dashes(path) : [path]),
    ...arrow,
  ]);
}

const ray = (angle: number): Vec => toScreen({ x: Math.cos(angle), y: Math.sin(angle) });

function toViewEdge(origin: Vec, direction: Vec): Vec {
  const x = direction.x > 0 ? SCREEN.width - origin.x : -origin.x;
  const y = direction.y > 0 ? SCREEN.height - origin.y : -origin.y;
  const length = Math.min(
    direction.x === 0 ? Infinity : x / direction.x,
    direction.y === 0 ? Infinity : y / direction.y,
  );
  return plus(origin, { x: direction.x * length, y: direction.y * length });
}

function drawCrossbow(scene: EarlyEncounterScene, flight: FlightState): void {
  const mark = activeCrossbowSector(flight);
  if (!mark) {
    return;
  }
  const origin = scene.project(mark.vertex);
  if (!inView(origin)) {
    return;
  }
  const rail = (offset: number) => ({
    from: origin,
    to: toViewEdge(origin, ray(mark.bearing + offset)),
  });
  stroke(scene, scene.palette.active, 1.5, 0.9, [
    rail(-mark.laneHalfAngle),
    rail(mark.laneHalfAngle),
  ]);
  if (mark.phase === "switch") {
    return;
  }
  const [min, max] = mark.sector;
  const outer = Math.abs(min) > Math.abs(max) ? min : max;
  const edge = rail(outer);
  const arc = Array.from({ length: 13 }, (_, index) => {
    const direction = ray(mark.bearing + min + ((max - min) * index) / 12);
    return plus(origin, { x: direction.x * 73, y: direction.y * 73 });
  });
  stroke(scene, scene.palette.threat, 2, 0.8, [
    ...(mark.phase === "warning" ? dashes(edge) : [edge]),
    ...arc.slice(1).map((to, index) => ({ from: arc[index]!, to })),
  ]);
}

function drawCartwheel(scene: EarlyEncounterScene, flight: FlightState): void {
  const patrol = flight.cartwheelMiningPatrol;
  if (
    patrol?.warnedAt === undefined ||
    !flight.objects.some(({ hp, id }) => hp > 0 && patrol.actors.includes(id))
  ) {
    return;
  }
  const world = flightWorldContext(flight);
  const [a, b] = patrol.plan.bypass;
  const [entry, exit] =
    worldDistance(world, flight.player, a) <= worldDistance(world, flight.player, b)
      ? [a, b]
      : [b, a];
  const start = worldPoint(world, flight.player, entry);
  drawEncounterRoute(scene, flight.player, [start, worldPoint(world, start, exit)]);
}

function drawCourierEscape(scene: EarlyEncounterScene, flight: FlightState): void {
  const route = andromedaCourierMarkers(flight)?.escape;
  if (!route) {
    return;
  }
  const world = flightWorldContext(flight);
  const start = worldPoint(world, flight.player, route.from);
  drawEncounterRoute(scene, flight.player, [start, worldPoint(world, start, route.to)]);
}

/** Existing overlay lifecycle clears these passive marks when no encounter supplies them. */
export function drawEarlyEncounters(scene: EarlyEncounterScene, flight: FlightState): void {
  switch (flight.galaxy) {
    case 1:
      drawHammer(scene, flight);
      break;
    case 2:
      drawCartwheel(scene, flight);
      break;
    case 3:
      drawManta(scene, flight);
      break;
    case 4:
      drawCrossbow(scene, flight);
      break;
    case 5:
      drawCourierEscape(scene, flight);
      break;
  }
}
