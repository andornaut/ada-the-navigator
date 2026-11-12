import { ECONOMY } from "../data/economy.ts";
import { CURRENTS } from "../data/galaxyFeatures.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { stationsNear } from "./stations.ts";
import type { Vec } from "./types.ts";

/** One seeded current: a polyline path in flow order with its width and arc lengths. */
export interface Current {
  /** Whether the current carries a debris river. */
  debris: boolean;
  id: string;
  /** Total path length. */
  length: number;
  /** Path points in flow order. */
  points: readonly Vec[];
  /** Arc length from the start to each point. */
  stations: readonly number[];
  width: number;
}

/** Fixed seeds for the galaxies with currents, so currents are the same on every flight. */
const GALAXY_SEEDS: Readonly<Partial<Record<GalaxyNumber, number>>> = {
  1: 0xc0_4401,
  2: 0xc0_4402,
  3: 0xc0_4403,
};

function mix(seed: number, x: number, y: number): number {
  let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return (n ^ (n >>> 13)) >>> 0;
}
const unit = (value: number) => value / 4294967296;

/** A wave across the cell's inner band: `along` from 0 to `span`, `lateral` its offset. */
function wavePoints(span: number, amplitude: number, halfWaves: number, phase: number): Vec[] {
  return Array.from({ length: CURRENTS.samples + 1 }, (_, index) => {
    const t = index / CURRENTS.samples;
    // The envelope keeps both ends on the band's centre line, so they open into free space.
    const envelope = Math.sin(Math.PI * t);
    return { x: t * span, y: amplitude * envelope * Math.sin(halfWaves * Math.PI * t + phase) };
  });
}

function arcLengths(points: readonly Vec[]): number[] {
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!;
    const b = points[index]!;
    lengths.push(lengths[index - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return lengths;
}

const cache = new Map<string, Current | null>();

/**
 * The current in one placement cell, or null. A current stays inside its cell's inner band,
 * so currents in different cells never overlap or join. A current that would come within the
 * clearance of the flight start or a station is left out.
 */
export function currentInCell(galaxy: GalaxyNumber, cell: Vec): Current | null {
  const key = `${galaxy}:${cell.x},${cell.y}`;
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  const current = buildCurrent(galaxy, cell);
  cache.set(key, current);
  return current;
}

function buildCurrent(galaxy: GalaxyNumber, cell: Vec): Current | null {
  const { cellSize, chance, clearance, length, margin, width: widths } = CURRENTS;
  if (!CURRENTS.galaxies.includes(galaxy)) {
    return null;
  }
  const seed = GALAXY_SEEDS[galaxy]!;
  const roll = (salt: number) => unit(mix(seed ^ salt, cell.x, cell.y));
  if (roll(0) >= chance) {
    return null;
  }
  const width = widths[0] + roll(0x1d2c) * (widths[1] - widths[0]);
  const span = cellSize - 2 * margin;
  const maxAmplitude = span / 2 - width / 2;
  const target = length[0] + roll(0x3e4f) * (Math.min(length[1], span * 2.6) - length[0]);
  const halfWaves = 1 + Math.floor(roll(0x5a6b) * 2);
  const phase = roll(0x7c8d) * Math.PI;
  // Find the amplitude whose path length meets the seeded target, within the band.
  let low = 0;
  let high = maxAmplitude;
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2;
    const lengths = arcLengths(wavePoints(span, middle, halfWaves, phase));
    if (lengths.at(-1)! < target) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const local = wavePoints(span, low, halfWaves, phase);
  // Each cell picks one of four directions across its band, and the flow's sense.
  const turn = Math.floor(roll(0x9eaf) * 4) * (Math.PI / 2);
  const centre = { x: (cell.x + 0.5) * cellSize, y: (cell.y + 0.5) * cellSize };
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  let points = local.map(({ x, y }) => {
    const dx = x - span / 2;
    return { x: centre.x + dx * cos - y * sin, y: centre.y + dx * sin + y * cos };
  });
  if (roll(0xb1c2) < 0.5) {
    points = points.toReversed();
  }
  const keep = clearance + width / 2;
  if (
    points.some((point) => Math.hypot(point.x, point.y) < keep) ||
    stationsNear(ECONOMY, galaxy, cellSize, centre).some((station) =>
      points.some((point) => Math.hypot(point.x - station.x, point.y - station.y) < keep),
    )
  ) {
    return null;
  }
  const stations = arcLengths(points);
  return {
    debris: roll(0xd3e4) < CURRENTS.debrisShare,
    id: `current:${cell.x},${cell.y}`,
    length: stations.at(-1)!,
    points,
    stations,
    width,
  };
}

/** The current whose cell holds a point, if any; currents never leave their own cell. */
export function currentAt(galaxy: GalaxyNumber, point: Vec): Current | null {
  const size = CURRENTS.cellSize;
  return currentInCell(galaxy, { x: Math.floor(point.x / size), y: Math.floor(point.y / size) });
}

/** Currents whose cells overlap a square of half-side `radius` around a point. */
export function currentsNear(galaxy: GalaxyNumber, radius: number, point: Vec): Current[] {
  const size = CURRENTS.cellSize;
  const found: Current[] = [];
  for (
    let x = Math.floor((point.x - radius) / size);
    x <= Math.floor((point.x + radius) / size);
    x++
  ) {
    for (
      let y = Math.floor((point.y - radius) / size);
      y <= Math.floor((point.y + radius) / size);
      y++
    ) {
      const current = currentInCell(galaxy, { x, y });
      if (current) {
        found.push(current);
      }
    }
  }
  return found;
}

/** The nearest point on a current's path: its distance, arc position and unit tangent. */
export function nearestOnCurrent(
  current: Current,
  point: Vec,
): { arc: number; distance: number; tangent: Vec } {
  let best = { arc: 0, distance: Infinity, tangent: { x: 1, y: 0 } };
  for (let index = 1; index < current.points.length; index++) {
    const a = current.points[index - 1]!;
    const b = current.points[index]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segment = Math.hypot(dx, dy);
    if (segment === 0) {
      continue;
    }
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / segment ** 2),
    );
    const distance = Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
    if (distance < best.distance) {
      best = {
        arc: current.stations[index - 1]! + segment * t,
        distance,
        tangent: { x: dx / segment, y: dy / segment },
      };
    }
  }
  return best;
}

/**
 * The flow at a point: strongest at the centre line, zero at the edges, fading over the last
 * `fade` units at each end, along the path's direction.
 */
export function flowAt(galaxy: GalaxyNumber, point: Vec): Vec {
  const current = currentAt(galaxy, point);
  if (!current) {
    return { x: 0, y: 0 };
  }
  const { arc, distance, tangent } = nearestOnCurrent(current, point);
  const strength = CURRENTS.peakFlow * flowFraction(current, arc, distance);
  return { x: tangent.x * strength, y: tangent.y * strength };
}

/**
 * The flow over the peak at arc `arc` and offset `offset` across a current: 1 - (2d / w)^2
 * across, fading over `fade` at each end, zero at and beyond the edges.
 */
export function flowFraction(
  current: Pick<Current, "length" | "width">,
  arc: number,
  offset: number,
): number {
  const half = current.width / 2;
  if (Math.abs(offset) >= half) {
    return 0;
  }
  const ends = Math.min(1, arc / CURRENTS.fade, (current.length - arc) / CURRENTS.fade);
  return (1 - (offset / half) ** 2) * Math.max(0, ends);
}

/** Whether a disc of `radius` at a point touches any current's band. */
export function inCurrent(galaxy: GalaxyNumber, radius: number, point: Vec): boolean {
  return currentsNear(galaxy, radius, point).some(
    (current) => nearestOnCurrent(current, point).distance < current.width / 2 + radius,
  );
}

type CurrentPath = Pick<Current, "length" | "points" | "stations">;

/** The polyline segment holding an arc position: its end index and the arc clamped to the path. */
function segmentAt(current: CurrentPath, arc: number): { at: number; index: number } {
  const at = Math.max(0, Math.min(current.length, arc));
  let index = 1;
  while (index < current.stations.length - 1 && current.stations[index]! < at) {
    index++;
  }
  return { at, index };
}

/**
 * A point on a current's path at an arc position, with its segment's unit tangent: the
 * direction the flow and the debris river follow (flowAt, placeRiverRock).
 */
export function pointOnCurrent(current: CurrentPath, arc: number): { point: Vec; tangent: Vec } {
  const { at, index } = segmentAt(current, arc);
  const a = current.points[index - 1]!;
  const b = current.points[index]!;
  const segment = current.stations[index]! - current.stations[index - 1]!;
  const t = segment > 0 ? (at - current.stations[index - 1]!) / segment : 0;
  const tangent =
    segment > 0 ? { x: (b.x - a.x) / segment, y: (b.y - a.y) / segment } : { x: 1, y: 0 };
  return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, tangent };
}

/**
 * The drawn streaks' frame at an arc position: pointOnCurrent's point, with a tangent that turns
 * smoothly from one segment's direction to the next between their midpoints, so streak lanes
 * offset along its normal follow a bend instead of jumping at its vertex. Drawing only; the
 * flow keeps each segment's direction.
 */
export function streakFrame(current: CurrentPath, arc: number): { point: Vec; tangent: Vec } {
  const { points, stations } = current;
  const { at, index } = segmentAt(current, arc);
  const { point } = pointOnCurrent(current, arc);
  const direction = (i: number): Vec | null => {
    const length = stations[i]! - stations[i - 1]!;
    const from = points[i - 1]!;
    const to = points[i]!;
    return length > 0 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : null;
  };
  const middle = (i: number) => (stations[i - 1]! + stations[i]!) / 2;
  const own = direction(index);
  if (!own) {
    return { point, tangent: { x: 1, y: 0 } };
  }
  // The neighbouring segment on this side of the segment's midpoint, and how far across.
  const before = at < middle(index);
  const other = before ? index - 1 : index + 1;
  const neighbour = other >= 1 && other < stations.length ? direction(other) : null;
  if (!neighbour) {
    return { point, tangent: own };
  }
  // Linear from this segment's direction at its midpoint to the neighbour's at its midpoint.
  const span = Math.abs(middle(index) - middle(other));
  const weight = span > 0 ? Math.abs(middle(index) - at) / span : 0;
  const blend = {
    x: own.x * (1 - weight) + neighbour.x * weight,
    y: own.y * (1 - weight) + neighbour.y * weight,
  };
  const size = Math.hypot(blend.x, blend.y);
  return { point, tangent: size > 1e-9 ? { x: blend.x / size, y: blend.y / size } : own };
}
