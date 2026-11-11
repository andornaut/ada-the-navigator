import {
  ASTEROID_ART,
  type AsteroidArt,
  type AsteroidArtCatalog,
  type BackdropSprite,
  type BackdropTint,
} from "../data/asteroid-catalog.ts";
import { GALAXIES } from "../data/storybook.ts";
import type { SectorId } from "../data/types.ts";
import type { Vec } from "../model/types.ts";

/**
 * A footprint's outline in display px relative to the pivot: the drawing while a rock's frames
 * load, and the overlay that compares the footprint with the sprite.
 */
export interface AsteroidOutline {
  readonly parts: readonly (readonly Vec[])[];
  /** Boundary edges of the part union; edges inside another part are dropped. */
  readonly edges: readonly (readonly [Vec, Vec])[];
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

function onEdge(part: readonly Vec[], point: Vec): boolean {
  return part.some((a, index) => {
    const b = part[(index + 1) % part.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const square = dx * dx + dy * dy;
    const t = square ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / square : 0;
    if (t < 0 || t > 1) {
      return false;
    }
    return Math.hypot(a.x + dx * t - point.x, a.y + dy * t - point.y) < 1e-6;
  });
}

/** The view's projection of a world offset to display px: `(x - y, (x + y) / 2)`. */
const project = (at: Vec): Vec => ({ x: at.x - at.y, y: (at.x + at.y) / 2 });

/** The outline of world-unit footprint parts, projected to display px. */
export function asteroidOutline(footprint: readonly (readonly Vec[])[]): AsteroidOutline {
  const parts = footprint.map((part) => part.map(project));
  const edges: [Vec, Vec][] = [];
  const PIECES = 12;
  parts.forEach((part, index) => {
    // A piece inside another part, or on an edge another part shares, is not on the union's
    // boundary.
    const covered = (point: Vec) =>
      parts.some(
        (other, at) => at !== index && (strictlyInside(other, point) || onEdge(other, point)),
      );
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

const ROCKS = new Map(ASTEROID_ART.asteroids.map((rock) => [rock.id, rock]));

/** Art's rock for an object's asteroid id. */
export function rockArt(id: string): AsteroidArt | undefined {
  return ROCKS.get(id);
}

const OUTLINES = new Map<string, AsteroidOutline>();
/** The outline of a rock frame's footprint, built once per frame. */
export function footprintOutline(art: AsteroidArt, frame: number): AsteroidOutline {
  const key = `${art.id}:${frame}`;
  let outline = OUTLINES.get(key);
  if (!outline) {
    outline = asteroidOutline((art.frames[frame] ?? art.frames[0]!).footprint);
    OUTLINES.set(key, outline);
  }
  return outline;
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
