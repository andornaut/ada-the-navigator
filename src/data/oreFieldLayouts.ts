import ORE_FIELD from "../../public/art/cartwheel/ore-field.json" with { type: "json" };
import { ASTEROID_ART } from "./asteroidCatalog.ts";
import type { ResourceClass } from "./resourceRocks.ts";

/** One rock of an ore field layout: Art's rock, its rest position and its start spin frame. */
export interface OreFieldRock {
  /** The plain asteroid shape it collides on, `asteroid-{shape}` for Art's `resource-{shape}`. */
  readonly asteroid: string;
  readonly frame: number;
  readonly position: { readonly x: number; readonly y: number };
  readonly resource: ResourceClass;
}

export interface OreFieldVariant {
  readonly id: string;
  /** One realization of this family for each supported rock count. */
  readonly layouts: ReadonlyMap<number, readonly OreFieldRock[]>;
}

export interface OreFieldLayouts {
  readonly count: readonly [number, number];
  readonly gap: number;
  readonly radius: number;
  /** Stable data order used by the independent seeded family selection. */
  readonly variants: readonly OreFieldVariant[];
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const shapes = new Map(ASTEROID_ART.asteroids.map((shape) => [shape.id, shape]));

/** Art's version 2 families, each with a complete set of supported count realizations. */
export function readOreFieldLayouts(value: unknown): OreFieldLayouts {
  const root = fields(value);
  const counts = root?.count;
  if (
    root?.version !== 2 ||
    !finite(root.radius) ||
    root.radius <= 0 ||
    !finite(root.gap) ||
    root.gap < 0 ||
    !Array.isArray(counts) ||
    counts.length !== 2 ||
    !counts.every((count) => Number.isSafeInteger(count) && count > 0) ||
    counts[0] > counts[1] ||
    !Array.isArray(root.variants) ||
    root.variants.length === 0
  ) {
    throw new Error("public/art/cartwheel/ore-field.json does not read as version 2");
  }
  const count = counts as [number, number];
  const gap = root.gap;
  const radius = root.radius;
  const variants: OreFieldVariant[] = [];
  const ids = new Set<string>();
  for (const entry of root.variants as unknown[]) {
    const variant = fields(entry);
    if (
      typeof variant?.id !== "string" ||
      !variant.id.trim() ||
      ids.has(variant.id) ||
      !Array.isArray(variant.layouts)
    ) {
      throw new Error("ore-field.json: invalid or duplicate family");
    }
    ids.add(variant.id);
    const layouts = new Map<number, readonly OreFieldRock[]>();
    for (const entry of variant.layouts as unknown[]) {
      const layout = fields(entry);
      const rocks = Array.isArray(layout?.rocks) ? (layout.rocks as unknown[]).map(fields) : [];
      if (
        !finite(layout?.count) ||
        !Number.isSafeInteger(layout.count) ||
        layout.count < count[0] ||
        layout.count > count[1] ||
        rocks.length !== layout.count ||
        layouts.has(layout.count)
      ) {
        throw new Error("ore-field.json: a layout's rocks do not match its count");
      }
      const decoded = rocks.map((rock): OreFieldRock => {
        const match = /^resource-([ml])(\d+)$/.exec(String(rock?.id));
        const asteroid = match ? `asteroid-${match[1]}${match[2]}` : "";
        const shape = shapes.get(asteroid);
        const position = rock?.position;
        if (
          !match ||
          !shape ||
          !Array.isArray(position) ||
          position.length !== 2 ||
          !position.every(finite) ||
          !Number.isSafeInteger(rock!.frame) ||
          (rock!.frame as number) < 0 ||
          (rock!.frame as number) >= shape.frames.length
        ) {
          throw new Error(`ore-field.json: rock ${String(rock?.id)} does not read`);
        }
        return {
          asteroid,
          frame: rock!.frame as number,
          position: { x: position[0] as number, y: position[1] as number },
          resource: match[1] === "m" ? "medium" : "large",
        };
      });
      for (const [index, rock] of decoded.entries()) {
        const footprint = shapes.get(rock.asteroid)!.footprintRadius;
        if (
          Math.hypot(rock.position.x, rock.position.y) + footprint > radius + 1e-6 ||
          decoded
            .slice(index + 1)
            .some(
              (other) =>
                Math.hypot(rock.position.x - other.position.x, rock.position.y - other.position.y) -
                  footprint -
                  shapes.get(other.asteroid)!.footprintRadius <
                gap - 1e-6,
            )
        ) {
          throw new Error(`ore-field.json: ${variant.id} does not preserve field clearance`);
        }
      }
      layouts.set(layout.count, decoded);
    }
    if (layouts.size !== count[1] - count[0] + 1) {
      throw new Error(`ore-field.json: ${variant.id} lacks a supported count`);
    }
    variants.push({ id: variant.id, layouts });
  }
  return { count, gap, radius, variants };
}

export const ORE_FIELD_LAYOUTS = readOreFieldLayouts(ORE_FIELD);

/** One family's authored realization for a supported rock count. */
export function oreFieldLayout(variantId: string, count: number): readonly OreFieldRock[] {
  const variant = ORE_FIELD_LAYOUTS.variants.find((variant) => variant.id === variantId);
  const layout = variant?.layouts.get(count);
  if (!layout) {
    throw new Error(`No ore field layout for ${variantId} with ${count} rocks`);
  }
  return layout;
}
