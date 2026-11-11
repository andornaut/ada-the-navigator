import ORE_FIELD from "../../public/art/cartwheel/ore-field.json" with { type: "json" };
import type { ResourceClass } from "./resource-rocks.ts";

/** One rock of an ore field layout: Art's rock, its rest position and its start spin frame. */
export interface OreFieldRock {
  /** The plain asteroid shape it collides on, `asteroid-{shape}` for Art's `resource-{shape}`. */
  readonly asteroid: string;
  readonly frame: number;
  readonly position: { readonly x: number; readonly y: number };
  readonly resource: ResourceClass;
}

export interface OreFieldLayouts {
  readonly gap: number;
  /** Layouts by rock count. */
  readonly layouts: ReadonlyMap<number, readonly OreFieldRock[]>;
  readonly radius: number;
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Art's ore field layouts (`ore-field.json`, version 1, art/cartwheel-props.md "Ore field"): one
 * cluster per rock count, positions in world units from the field centre. Throws on a file that
 * does not read, since every ore field is placed from it.
 */
export function readOreFieldLayouts(value: unknown): OreFieldLayouts {
  const root = fields(value);
  if (
    root?.version !== 1 ||
    !finite(root.radius) ||
    !finite(root.gap) ||
    !Array.isArray(root.layouts)
  ) {
    throw new Error("public/art/cartwheel/ore-field.json does not read as version 1");
  }
  const layouts = new Map<number, OreFieldRock[]>();
  for (const entry of root.layouts as unknown[]) {
    const layout = fields(entry);
    const rocks = Array.isArray(layout?.rocks) ? (layout.rocks as unknown[]).map(fields) : [];
    if (!finite(layout?.count) || rocks.length !== layout.count || layouts.has(layout.count)) {
      throw new Error("ore-field.json: a layout's rocks do not match its count");
    }
    layouts.set(
      layout.count,
      rocks.map((rock) => {
        const match = /^resource-([ml])(\d+)$/.exec(String(rock?.id));
        const position = rock?.position;
        if (
          !match ||
          !Array.isArray(position) ||
          position.length !== 2 ||
          !position.every(finite) ||
          !Number.isInteger(rock!.frame)
        ) {
          throw new Error(`ore-field.json: rock ${String(rock?.id)} does not read`);
        }
        return {
          asteroid: `asteroid-${match[1]}${match[2]}`,
          frame: rock!.frame as number,
          position: { x: position[0] as number, y: position[1] as number },
          resource: match[1] === "m" ? "medium" : "large",
        };
      }),
    );
  }
  return { gap: root.gap, layouts, radius: root.radius };
}

export const ORE_FIELD_LAYOUTS = readOreFieldLayouts(ORE_FIELD);

/** The layout for a field's rock count; a count without one is an error. */
export function oreFieldLayout(count: number): readonly OreFieldRock[] {
  const layout = ORE_FIELD_LAYOUTS.layouts.get(count);
  if (!layout) {
    throw new Error(`No ore field layout for ${count} rocks`);
  }
  return layout;
}
