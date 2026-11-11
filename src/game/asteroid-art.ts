import {
  ASTEROID_FOOTPRINTS,
  type AsteroidArt,
  type AsteroidArtCatalog,
  type AsteroidFootprint,
  type BackdropSprite,
  type BackdropTint,
} from "../data/asteroid-catalog.ts";
import { GALAXIES } from "../data/storybook.ts";
import type { SectorId } from "../data/types.ts";
import type { Vec } from "../model/types.ts";

/** Display-pixel outline of a footprint relative to its pivot: the drawing fallback without Art. */
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

export function asteroidOutline(entry: AsteroidFootprint): AsteroidOutline {
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
  ASTEROID_FOOTPRINTS.asteroids.map((entry) => [
    entry.id,
    { entry, outline: asteroidOutline(entry) },
  ]),
);

export function footprintOutline(
  id: string,
): { entry: AsteroidFootprint; outline: AsteroidOutline } | undefined {
  return OUTLINES.get(id);
}

function hash(seed: number, text: string): number {
  let value = seed >>> 0 || 0x811c9dc5;
  for (const character of text) {
    value = Math.imul(value ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d) >>> 0;
  return (value ^ (value >>> 12)) >>> 0;
}
/** A stable value in [0, 1) for a seed, an id and a salt. */
function unit(seed: number, id: string, salt: string): number {
  return hash(seed, `${id}:${salt}`) / 0x100000000;
}

/**
 * The Art rock drawn over a model footprint: the same size class, matched by rank of radius,
 * so the largest footprint of a size wears that size's largest rock.
 */
export function artVariant(
  catalog: AsteroidArtCatalog,
  footprint: string,
): AsteroidArt | undefined {
  let variants = VARIANTS.get(catalog);
  if (!variants) {
    variants = new Map();
    VARIANTS.set(catalog, variants);
  }
  if (!variants.has(footprint)) {
    variants.set(footprint, matchVariant(catalog, footprint));
  }
  return variants.get(footprint);
}
const VARIANTS = new WeakMap<AsteroidArtCatalog, Map<string, AsteroidArt | undefined>>();
function matchVariant(catalog: AsteroidArtCatalog, footprint: string): AsteroidArt | undefined {
  const entry = footprintOutline(footprint)?.entry;
  if (!entry) {
    return undefined;
  }
  const byRadius = <T extends { readonly id: string; readonly radius: number }>(
    list: readonly T[],
  ) => [...list].sort((a, b) => a.radius - b.radius || a.id.localeCompare(b.id));
  const footprints = byRadius(ASTEROID_FOOTPRINTS.asteroids.filter((at) => at.size === entry.size));
  const rocks = byRadius(catalog.asteroids.filter((at) => at.size === entry.size));
  const rank = footprints.indexOf(entry);
  return rocks[Math.floor((rank * rocks.length) / footprints.length)];
}

/**
 * The spin frame a rock shows at `seconds` of flight (art/asteroids.md "Classes"): one rate per
 * rock within its range and one direction, both from the level seed, so frame
 * floor(angle / step) mod count plays ascending or descending. Still rocks and reduced motion
 * show frame 0.
 */
export function spinFrame(
  art: AsteroidArt,
  seed: number,
  reducedMotion: boolean,
  id: string,
  seconds: number,
): number {
  if (!art.spin || reducedMotion || art.frames.length < 2) {
    return 0;
  }
  const [slow, fast] = art.spin.degPerSecond;
  const rate = slow + unit(seed, id, "spin-rate") * (fast - slow);
  const direction = unit(seed, id, "spin-direction") < 0.5 ? -1 : 1;
  const angle = unit(seed, id, "spin-phase") * 360 + direction * rate * seconds;
  const turned = ((angle % 360) + 360) % 360;
  return Math.floor(turned / (360 / art.frames.length)) % art.frames.length;
}

/** A frame's silhouette parts in display px relative to the pivot. */
export function frameSilhouette(art: AsteroidArt, frame: number): Vec[][] {
  const scale = {
    x: art.display.width / art.frame.width,
    y: art.display.height / art.frame.height,
  };
  const origin = { x: art.pivot.x * art.frame.width, y: art.pivot.y * art.frame.height };
  return (art.frames[frame] ?? art.frames[0]!).collision.map((part) =>
    part.map((at) => ({ x: (at.x - origin.x) * scale.x, y: (at.y - origin.y) * scale.y })),
  );
}

export interface DriftChip extends Vec {
  readonly alpha: number;
  readonly size: number;
}
const CHIP_SIZES = [2, 2, 1, 1] as const;
const CHIP_ALPHAS = [0.9, 0.7, 0.5, 0.35] as const;
/**
 * A drifting rock's trailing chips (art/asteroids.md "Drift cue"), in display px from the pivot:
 * chip i sits e + 4 + 6.5 i behind the silhouette centre along the screen direction `behind`, e
 * being the distance to the edge of the ellipse with the collision bounds' half extents, offset
 * sideways by a seeded value within 1.5.
 */
export function driftChips(
  art: AsteroidArt,
  seed: number,
  frame: number,
  id: string,
  behind: Vec,
): DriftChip[] {
  const length = Math.hypot(behind.x, behind.y);
  if (!(length > 0)) {
    return [];
  }
  const d = { x: behind.x / length, y: behind.y / length };
  const points = frameSilhouette(art, frame).flat();
  const xs = points.map((at) => at.x);
  const ys = points.map((at) => at.y);
  const centre = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
  const half = {
    x: (Math.max(...xs) - Math.min(...xs)) / 2,
    y: (Math.max(...ys) - Math.min(...ys)) / 2,
  };
  const edge = 1 / Math.hypot(d.x / half.x, d.y / half.y);
  const side = { x: -d.y, y: d.x };
  return CHIP_SIZES.map((size, index) => {
    const along = edge + 4 + 6.5 * index;
    const across = (unit(seed, id, `chip-${index}`) * 2 - 1) * 1.5;
    return {
      alpha: CHIP_ALPHAS[index]!,
      size,
      x: centre.x + d.x * along + side.x * across,
      y: centre.y + d.y * along + side.y * across,
    };
  });
}

/** A galaxy's backdrop colours by its galaxies.json id; the base field outside a galaxy. */
export function backdropTint(catalog: AsteroidArtCatalog, sector: SectorId | null): BackdropTint {
  const id = sector === null ? undefined : GALAXIES[sector - 1]?.id;
  return (id ? catalog.tints[id] : undefined) ?? catalog.tints.base!;
}

/** Provisional backdrop field density until Art sets one: world cell size and fill chance. */
export const BACKDROP_FIELD = { cell: 320, chance: 0.35, scale: [0.6, 1] } as const;

export interface BackdropRock extends Vec {
  readonly scale: number;
  readonly sprite: BackdropSprite;
}
/** The backdrop rock seeded in world cell (x, y), or null for an empty cell. */
export function backdropRock(
  catalog: AsteroidArtCatalog,
  seed: number,
  x: number,
  y: number,
): BackdropRock | null {
  const id = `${x},${y}`;
  if (unit(seed, id, "backdrop") >= BACKDROP_FIELD.chance) {
    return null;
  }
  const sprites = catalog.backdrop.sprites;
  const sprite = sprites[Math.floor(unit(seed, id, "backdrop-sprite") * sprites.length)]!;
  const [low, high] = BACKDROP_FIELD.scale;
  const { cell } = BACKDROP_FIELD;
  return {
    scale: low + unit(seed, id, "backdrop-scale") * (high - low),
    sprite,
    x: (x + unit(seed, id, "backdrop-x")) * cell,
    y: (y + unit(seed, id, "backdrop-y")) * cell,
  };
}

/** Every SVG the catalog draws: each rock frame and each backdrop sprite, once. */
export function asteroidFiles(catalog: AsteroidArtCatalog): string[] {
  return [
    ...new Set([
      ...catalog.asteroids.flatMap((rock) => rock.frames.map((frame) => frame.file)),
      ...catalog.backdrop.sprites.map((sprite) => sprite.file),
    ]),
  ];
}

/** A `#rrggbb` colour as a number. */
export function hexNumber(color: string): number {
  return Number.parseInt(color.slice(1), 16);
}

/**
 * Phaser depth of a play object by its pivot's screen y (art/asteroids.md "Placement and draw
 * order"): ascending y draws later, within one band above the field.
 */
export function playDepth(screenY: number): number {
  return 2 + Math.max(-1e4, Math.min(1e4, screenY)) / 1e5;
}
