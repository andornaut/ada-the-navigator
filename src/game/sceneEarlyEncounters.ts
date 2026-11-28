import { LIGHT_FIELD, type SpacePalette } from "../art/index.ts";
import { SUNFLOWER_CAPITAL_BOSS, WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { andromedaCourierMarkers } from "../model/andromeda/runtime.ts";
import { CARTWHEEL_MINING_PATROL } from "../model/cartwheelMiningPatrol.ts";
import { toScreen } from "../model/convex.ts";
import { mantaEscortPhase } from "../model/earlyEncounterPatterns.ts";
import { enemyPartOutline } from "../model/enemyBody.ts";
import { activeCrossbowSector, activeEnemyBeams } from "../model/flight.ts";
import { requiredFrigateEscortId } from "../model/frigateEscorts.ts";
import type { FlightState, Vec } from "../model/types.ts";
import { flightWorldContext, worldDistance, worldPoint } from "../model/world/index.ts";
import { drawEncounterRoute, visibleDistances } from "./scenePhantomBlockade.ts";

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

function visibleSegment({ from, to }: Segment): Segment[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const visible = visibleDistances(from, { x: dx, y: dy }, 1);
  if (!visible || visible[0] >= visible[1] || (dx === 0 && dy === 0)) {
    return [];
  }
  const [start, end] = visible;
  return [
    {
      from: start === 0 ? from : { x: from.x + dx * start, y: from.y + dy * start },
      to: end === 1 ? to : { x: from.x + dx * end, y: from.y + dy * end },
    },
  ];
}

/** Clip the work while keeping the dash pattern anchored at the authored start. */
function dashes(from: Vec, direction: Vec, visible: readonly [number, number] | null): Segment[] {
  if (!visible) {
    return [];
  }
  const [start, end] = visible;
  const pointAt = (distance: number) =>
    plus(from, {
      x: direction.x * distance,
      y: direction.y * distance,
    });
  const result: Segment[] = [];
  for (let at = Math.floor(start / 20) * 20; at < end; at += 20) {
    const dashStart = Math.max(start, at);
    const dashEnd = Math.min(end, at + 12);
    if (dashStart < dashEnd) {
      result.push({ from: pointAt(dashStart), to: pointAt(dashEnd) });
    }
  }
  return result;
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
  const direction = { x: dx / span, y: dy / span };
  const body =
    phase.kind === "approach"
      ? dashes(from, direction, visibleDistances(from, direction, span))
      : visibleSegment({ from, to });
  stroke(scene, scene.palette.threat, 1.5, 0.85, [...body, ...arrow.flatMap(visibleSegment)]);
}

const ray = (angle: number): Vec => toScreen({ x: Math.cos(angle), y: Math.sin(angle) });

function drawCrossbow(scene: EarlyEncounterScene, flight: FlightState): void {
  const mark = activeCrossbowSector(flight);
  if (!mark) {
    return;
  }
  const origin = scene.project(mark.vertex);
  const rail = (offset: number, dashed = false): Segment[] => {
    const raw = ray(mark.bearing + offset);
    const span = Math.hypot(raw.x, raw.y);
    const direction = { x: raw.x / span, y: raw.y / span };
    const visible = visibleDistances(origin, direction, Infinity);
    if (!visible || visible[0] >= visible[1]) {
      return [];
    }
    if (dashed) {
      return dashes(origin, direction, visible);
    }
    const at = (distance: number) =>
      plus(origin, { x: direction.x * distance, y: direction.y * distance });
    return [{ from: at(visible[0]), to: at(visible[1]) }];
  };
  stroke(scene, scene.palette.active, 1.5, 0.9, [
    ...rail(-mark.laneHalfAngle),
    ...rail(mark.laneHalfAngle),
  ]);
  if (mark.phase === "switch") {
    return;
  }
  const [min, max] = mark.sector;
  const outer = Math.abs(min) > Math.abs(max) ? min : max;
  const arc = Array.from({ length: 13 }, (_, index) => {
    const direction = ray(mark.bearing + min + ((max - min) * index) / 12);
    return plus(origin, { x: direction.x * 73, y: direction.y * 73 });
  });
  stroke(scene, scene.palette.threat, 2, 0.8, [
    ...rail(outer, mark.phase === "warning"),
    ...arc.slice(1).flatMap((to, index) => visibleSegment({ from: arc[index]!, to })),
  ]);
}

function drawCartwheel(scene: EarlyEncounterScene, flight: FlightState): void {
  const patrol = flight.cartwheelMiningPatrol;
  if (patrol?.warnedAt === undefined) {
    return;
  }
  const world = flightWorldContext(flight);
  const { anchor, bypass } = patrol.plan;
  const [a, b] = bypass;
  const extent = Math.max(worldDistance(world, anchor, a), worldDistance(world, anchor, b));
  if (
    worldDistance(world, anchor, flight.player) > extent + CARTWHEEL_MINING_PATROL.warningRange ||
    (!patrol.actors.some((id) => (flight.world.notables[id]?.hp ?? 0) > 0) &&
      !flight.objects.some(({ hp, id }) => hp > 0 && patrol.actors.includes(id)))
  ) {
    return;
  }
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
