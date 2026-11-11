import { ORE_FIELDS } from "../data/galaxy-features.ts";
import type { SectorId } from "../data/types.ts";
import type { Vec } from "./types.ts";

/** One seeded ore field: its centre, rock positions and whether a platform guards it. */
export interface OreField extends Vec {
  /** The guard's position and fixed hull facing, or null for an unguarded field. */
  guard: (Vec & { facing: Vec }) | null;
  id: string;
  rocks: readonly Vec[];
}

/** Fixed per-sector seeds, so ore fields are the same on every flight. */
const SECTOR_SEEDS: Readonly<Record<SectorId, number>> = {
  1: 0x0e5e_0101,
  2: 0x0e5e_0202,
  3: 0x0e5e_0303,
};

function mix(seed: number, x: number, y: number): number {
  let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return (n ^ (n >>> 13)) >>> 0;
}
const unit = (value: number) => value / 4294967296;

/**
 * The ore field in one placement cell, or null. Fields sit inside the cell's central band
 * of side `jitter`, so fields in different cells are at least `cellSize - jitter` apart. A
 * field within `clearance` of the flight start is left out; stations, the hub and later
 * arrivals are checked where the field is placed.
 */
export function oreFieldInCell(sector: SectorId, cell: Vec): OreField | null {
  const { cellSize, chance, clearance, count, diameter, guardChance, guardGap, jitter } =
    ORE_FIELDS;
  if (!ORE_FIELDS.sectors.includes(sector)) {
    return null;
  }
  const seed = SECTOR_SEEDS[sector];
  const roll = (salt: number) => unit(mix(seed ^ salt, cell.x, cell.y));
  if (roll(0) >= chance) {
    return null;
  }
  const margin = (cellSize - jitter) / 2;
  const x = cell.x * cellSize + margin + roll(0x9e37) * jitter;
  const y = cell.y * cellSize + margin + roll(0x79b9) * jitter;
  if (Math.hypot(x, y) < clearance + diameter / 2) {
    return null;
  }
  const total = count[0] + Math.floor(roll(0x51ed) * (count[1] - count[0] + 1));
  const rocks: Vec[] = [];
  // Rocks fill rings on a sunflower spiral, evenly spread across the field.
  const turn = Math.PI * (3 - Math.sqrt(5));
  const start = roll(0x2b3c) * Math.PI * 2;
  for (let index = 0; index < total; index++) {
    const radius = (diameter / 2) * Math.sqrt((index + 0.5) / total);
    const angle = start + index * turn;
    rocks.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
  }
  // A checkerboard keeps guarded fields to at most half; the seed picks among them.
  const eligible = (((cell.x + cell.y) % 2) + 2) % 2 === 0;
  let guard: OreField["guard"] = null;
  if (eligible && roll(0x6a09) < guardChance) {
    const angle = roll(0x3c6e) * Math.PI * 2;
    const reach = diameter / 2 + guardGap;
    const facingAngle = roll(0xa54f) * Math.PI * 2;
    guard = {
      facing: { x: Math.cos(facingAngle), y: Math.sin(facingAngle) },
      x: x + Math.cos(angle) * reach,
      y: y + Math.sin(angle) * reach,
    };
  }
  return { guard, id: `ore:${cell.x},${cell.y}`, rocks, x, y };
}

/** Ore fields whose centres are within `radius` of a point. */
export function oreFieldsNear(sector: SectorId, radius: number, point: Vec): OreField[] {
  const size = ORE_FIELDS.cellSize;
  const fields: OreField[] = [];
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
      const field = oreFieldInCell(sector, { x, y });
      if (field && Math.hypot(field.x - point.x, field.y - point.y) <= radius) {
        fields.push(field);
      }
    }
  }
  return fields;
}
