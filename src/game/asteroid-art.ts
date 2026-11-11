import { ASTEROID_CATALOG, type AsteroidEntry } from "../data/asteroid-catalog.ts";
import type { Vec } from "../model/types.ts";

/** Display-pixel outline of an asteroid variant relative to its pivot. */
export interface AsteroidOutline {
  readonly parts: readonly (readonly Vec[])[];
  /** Boundary edges of the part union; edges inside another part are dropped. */
  readonly edges: readonly (readonly [Vec, Vec])[];
}

// Provisional hues until Art supplies the tint rule; each is mixed lightly into a muted role.
export const SPACE_TINTS: Readonly<Record<string, number>> = {
  lilac: 0xb39ac9,
  moss: 0x8fae86,
  rust: 0xc08a6a,
  slate: 0x7f93b8,
};
const TINT_KEYS = Object.keys(SPACE_TINTS);

/** Linear sRGB mix of `tint` into `base` by `amount` in [0, 1]. */
export function mixColor(amount: number, tint: number, base: number): number {
  let color = 0;
  for (const shift of [16, 8, 0]) {
    const a = (base >> shift) & 255;
    const b = (tint >> shift) & 255;
    color |= Math.round(a + (b - a) * amount) << shift;
  }
  return color;
}

/** A muted role carrying a light tint; unknown keys keep the base color. */
export function tinted(amount: number, key: string, base: number): number {
  const tint = SPACE_TINTS[key];
  return tint === undefined ? base : mixColor(amount, tint, base);
}

/** A stable tint key for a background cell, so markers vary without flickering. */
export function cellTint(x: number, y: number): string {
  const index = Math.abs(Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) % TINT_KEYS.length;
  return TINT_KEYS[index]!;
}

function strictlyInside(part: readonly Vec[], point: Vec): boolean {
  let sign = 0;
  for (let index = 0; index < part.length; index++) {
    const a = part[index]!;
    const b = part[(index + 1) % part.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 1e-6 || (sign && Math.sign(cross) !== sign)) {
      return false;
    }
    sign = Math.sign(cross);
  }
  return true;
}

export function asteroidOutline(entry: AsteroidEntry): AsteroidOutline {
  const scale = {
    x: entry.display.width / entry.frame.width,
    y: entry.display.height / entry.frame.height,
  };
  const origin = { x: entry.pivot.x * entry.frame.width, y: entry.pivot.y * entry.frame.height };
  const parts = entry.collision.map((part) =>
    part.map((at) => ({ x: (at.x - origin.x) * scale.x, y: (at.y - origin.y) * scale.y })),
  );
  const edges: [Vec, Vec][] = [];
  const PIECES = 12;
  parts.forEach((part, index) => {
    const covered = (point: Vec) =>
      parts.some((other, at) => at !== index && strictlyInside(other, point));
    for (let corner = 0; corner < part.length; corner++) {
      const a = part[corner]!;
      const b = part[(corner + 1) % part.length]!;
      const along = (t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      // Keep the pieces of each edge that lie outside every other part.
      let start: number | null = null;
      for (let piece = 0; piece <= PIECES; piece++) {
        const open = piece < PIECES && !covered(along((piece + 0.5) / PIECES));
        if (open && start === null) {
          start = piece;
        } else if (!open && start !== null) {
          edges.push([along(start / PIECES), along(piece / PIECES)]);
          start = null;
        }
      }
    }
  });
  return { edges, parts };
}

const OUTLINES = new Map(
  ASTEROID_CATALOG.asteroids.map((entry) => [entry.id, { entry, outline: asteroidOutline(entry) }]),
);

export function asteroidArt(
  id: string,
): { entry: AsteroidEntry; outline: AsteroidOutline } | undefined {
  return OUTLINES.get(id);
}
