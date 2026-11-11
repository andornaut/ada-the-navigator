import { ECONOMY } from "../data/economy.ts";
import { CURRENTS } from "../data/galaxy-features.ts";
import type { SectorId } from "../data/types.ts";
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

/** Fixed per-sector seeds, so currents are the same on every flight. */
const SECTOR_SEEDS: Readonly<Record<SectorId, number>> = {
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
export function currentInCell(sector: SectorId, cell: Vec): Current | null {
  const key = `${sector}:${cell.x},${cell.y}`;
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  const current = buildCurrent(sector, cell);
  cache.set(key, current);
  return current;
}

function buildCurrent(sector: SectorId, cell: Vec): Current | null {
  const { cellSize, chance, clearance, length, margin, width: widths } = CURRENTS;
  if (!CURRENTS.sectors.includes(sector)) {
    return null;
  }
  const seed = SECTOR_SEEDS[sector];
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
    stationsNear(ECONOMY, sector, cellSize, centre).some((station) =>
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
export function currentAt(sector: SectorId, point: Vec): Current | null {
  const size = CURRENTS.cellSize;
  return currentInCell(sector, { x: Math.floor(point.x / size), y: Math.floor(point.y / size) });
}

/** Currents whose cells overlap a square of half-side `radius` around a point. */
export function currentsNear(sector: SectorId, radius: number, point: Vec): Current[] {
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
      const current = currentInCell(sector, { x, y });
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
export function flowAt(sector: SectorId, point: Vec): Vec {
  const current = currentAt(sector, point);
  if (!current) {
    return { x: 0, y: 0 };
  }
  const { arc, distance, tangent } = nearestOnCurrent(current, point);
  const half = current.width / 2;
  if (distance >= half) {
    return { x: 0, y: 0 };
  }
  const across = 1 - (distance / half) ** 2;
  const ends = Math.min(1, arc / CURRENTS.fade, (current.length - arc) / CURRENTS.fade);
  const strength = CURRENTS.peakFlow * across * Math.max(0, ends);
  return { x: tangent.x * strength, y: tangent.y * strength };
}

/** Whether a disc of `radius` at a point touches any current's band. */
export function inCurrent(sector: SectorId, radius: number, point: Vec): boolean {
  return currentsNear(sector, radius, point).some(
    (current) => nearestOnCurrent(current, point).distance < current.width / 2 + radius,
  );
}

/** A point on a current's path at an arc position, with its unit tangent. */
export function pointOnCurrent(current: Current, arc: number): { point: Vec; tangent: Vec } {
  const at = Math.max(0, Math.min(current.length, arc));
  let index = 1;
  while (index < current.stations.length - 1 && current.stations[index]! < at) {
    index++;
  }
  const a = current.points[index - 1]!;
  const b = current.points[index]!;
  const segment = current.stations[index]! - current.stations[index - 1]!;
  const t = segment > 0 ? (at - current.stations[index - 1]!) / segment : 0;
  const tangent =
    segment > 0 ? { x: (b.x - a.x) / segment, y: (b.y - a.y) / segment } : { x: 1, y: 0 };
  return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, tangent };
}
