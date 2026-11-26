import { SVG_DECIMALS, svgText } from "../../art/tools/svg-text.ts";
import { ECONOMY } from "../data/economy.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";

/** Art's material slots in `ship-materials.json` order; each paint scheme colours every slot. */
export const SHIP_MATERIAL_SLOTS = [
  "top",
  "topTurned",
  "wallLeft",
  "wallRight",
  "tailLeft",
  "tailRight",
  "accent",
  "accentTurned",
  "accentLeft",
  "accentRight",
  "skirt",
  "canopyHighlight",
  "canopyRoof",
  "canopyShade",
  "engineOpening",
] as const;

type MaterialSlot = (typeof SHIP_MATERIAL_SLOTS)[number];
export type ShipMaterialPalette = Readonly<Record<MaterialSlot, string>>;
interface DrawRef {
  readonly alpha: 1;
  readonly path: number;
  readonly slot: MaterialSlot;
}
export interface ShipMaterials {
  /** Each heading's ordered draws, shared by every paint. */
  readonly headings: ReadonlyMap<number, readonly DrawRef[]>;
  readonly paths: readonly string[];
  /** Each warp pose's ordered draws. */
  readonly poses: ReadonlyMap<string, readonly DrawRef[]>;
}
export interface MaterialSvg {
  readonly svg: string;
  readonly url: string;
}

const fields = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const slot = (value: unknown): value is MaterialSlot =>
  SHIP_MATERIAL_SLOTS.some((name) => name === value);
const pivot = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 2 && value[0] === 0.5 && value[1] === 0.5;

function readDraws(paths: readonly string[], value: unknown): readonly DrawRef[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }
  const result: DrawRef[] = [];
  for (const candidate of value as unknown[]) {
    const ref = fields(candidate);
    if (
      !ref ||
      !Number.isInteger(ref.path) ||
      typeof ref.path !== "number" ||
      ref.path < 0 ||
      ref.path >= paths.length ||
      !slot(ref.slot) ||
      ref.alpha !== 1
    ) {
      return undefined;
    }
    result.push({ alpha: 1, path: ref.path, slot: ref.slot });
  }
  return result;
}

/** Read the producer's exact geometry and ordered draws, retaining every path. */
export function readShipMaterials(
  expected: { readonly poses: readonly string[]; readonly warpHeading: number },
  value: unknown,
): ShipMaterials | undefined {
  const root = fields(value);
  const contract = fields(root?.shipHeadings);
  const ship = fields(root?.ship);
  const warp = fields(root?.warp);
  if (
    root?.version !== 2 ||
    contract?.count !== SHIP_HEADINGS ||
    contract.version !== 2 ||
    !Array.isArray(root.paths) ||
    !root.paths.length ||
    // Path data only; an empty path is a fragment the producer clipped away, and draws nothing.
    !root.paths.every(
      (path: unknown) =>
        typeof path === "string" && /^(?:[Mm][MmLlHhVvCcSsQqTtAaZzEe0-9,.\s+-]*)?$/.test(path),
    ) ||
    !Array.isArray(root.slots) ||
    root.slots.length !== SHIP_MATERIAL_SLOTS.length ||
    !SHIP_MATERIAL_SLOTS.every((name, index) => (root.slots as unknown[])[index] === name) ||
    root.palettePath !== "/art/ship-paint.json" ||
    ship?.frame !== 96 ||
    ship.displayScale !== 0.4375 ||
    !pivot(ship.pivot) ||
    !Array.isArray(ship.headings) ||
    ship.headings.length !== SHIP_HEADINGS ||
    warp?.frame !== 256 ||
    warp.heading !== expected.warpHeading ||
    warp.displayScale !== 0.4375 ||
    !pivot(warp.pivot) ||
    !Array.isArray(warp.poses) ||
    warp.poses.length !== expected.poses.length
  ) {
    return undefined;
  }
  const paths = root.paths as string[];
  const headings = new Map<number, readonly DrawRef[]>();
  for (const value of ship.headings as unknown[]) {
    const heading = fields(value);
    const draws = readDraws(paths, heading?.draws);
    if (
      !draws ||
      typeof heading?.index !== "number" ||
      !Number.isInteger(heading.index) ||
      heading.index < 0 ||
      heading.index >= SHIP_HEADINGS ||
      headings.has(heading.index)
    ) {
      return undefined;
    }
    headings.set(heading.index, draws);
  }
  const poses = new Map<string, readonly DrawRef[]>();
  for (const value of warp.poses as unknown[]) {
    const pose = fields(value);
    const draws = readDraws(paths, pose?.draws);
    if (
      !draws ||
      typeof pose?.id !== "string" ||
      !expected.poses.includes(pose.id) ||
      poses.has(pose.id)
    ) {
      return undefined;
    }
    poses.set(pose.id, draws);
  }
  return { headings, paths, poses };
}

/** Every declared paint supplies its own exact material colours, not a global tint. */
export function readShipMaterialPalettes(
  expected: readonly string[],
  value: unknown,
): ReadonlyMap<string, ShipMaterialPalette> | undefined {
  const root = fields(value);
  if (root?.version !== 1 || !Array.isArray(root.schemes)) {
    return undefined;
  }
  const palettes = new Map<string, ShipMaterialPalette>();
  for (const value of root.schemes as unknown[]) {
    const scheme = fields(value);
    if (
      typeof scheme?.id !== "string" ||
      !expected.includes(scheme.id) ||
      palettes.has(scheme.id) ||
      !SHIP_MATERIAL_SLOTS.every(
        (name) => typeof scheme[name] === "string" && /^#[0-9a-f]{6}$/i.test(scheme[name]),
      )
    ) {
      return undefined;
    }
    palettes.set(scheme.id, scheme as unknown as ShipMaterialPalette);
  }
  return palettes.size === new Set(expected).size ? palettes : undefined;
}

/** Filled SVG sources are assembled once per paint and geometry, then reused on raster changes. */
export class ShipMaterialSources {
  private readonly sources = new Map<string, MaterialSvg>();
  private readonly flightMasks = new Map<number, { tail: string[]; rear: string[] }>();

  private readonly materials: ShipMaterials;
  private readonly palettes: ReadonlyMap<string, ShipMaterialPalette>;

  constructor(materials: ShipMaterials, palettes: ReadonlyMap<string, ShipMaterialPalette>) {
    this.materials = materials;
    this.palettes = palettes;
  }

  ship(paint: string, heading: number): MaterialSvg | undefined {
    return this.source(`ship:${paint}:${heading}`, paint, 96, this.materials.headings.get(heading));
  }

  /** The same geometry serialized like the former standalone Classic SVG. */
  standaloneClassic(heading: number): MaterialSvg | undefined {
    const key = `standalone-classic:${heading}`;
    const cached = this.sources.get(key);
    if (cached) {
      return cached;
    }
    const material = this.ship(ECONOMY.defaultPaint, heading);
    if (!material) {
      return undefined;
    }
    const svg = svgText(
      material.svg.replace(">\n", `>\n<title>Ship ${heading} idle</title>\n`),
      SVG_DECIMALS.ship,
    );
    const source = { svg, url: `data:image/svg+xml;base64,${btoa(svg)}` };
    this.sources.set(key, source);
    return source;
  }

  flightMask(heading: number): { tail: string[]; rear: string[] } | undefined {
    const cached = this.flightMasks.get(heading);
    if (cached) {
      return cached;
    }
    const draws = this.materials.headings.get(heading);
    if (!draws) {
      return undefined;
    }
    const tail: string[] = [];
    const rear: string[] = [];
    for (const { path, slot } of draws) {
      if (slot === "tailLeft" || slot === "tailRight") {
        tail.push(this.materials.paths[path]!);
      } else if (slot === "engineOpening") {
        rear.push(this.materials.paths[path]!);
      }
    }
    const mask = { rear: [...tail, ...rear], tail };
    this.flightMasks.set(heading, mask);
    return mask;
  }

  pose(paint: string, id: string): MaterialSvg | undefined {
    return this.source(`pose:${paint}:${id}`, paint, 256, this.materials.poses.get(id));
  }

  private source(
    key: string,
    paint: string,
    frame: number,
    draws: readonly DrawRef[] | undefined,
  ): MaterialSvg | undefined {
    const cached = this.sources.get(key);
    if (cached) {
      return cached;
    }
    const palette = this.palettes.get(paint);
    if (!palette || !draws) {
      return undefined;
    }
    const paths = draws.map(
      ({ path, slot }) => `<path fill="${palette[slot]}" d="${this.materials.paths[path]}"/>`,
    );
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${frame}" height="${frame}" ` +
      `viewBox="0 0 ${frame} ${frame}">\n${paths.join("\n")}\n</svg>`;
    const source = { svg, url: `data:image/svg+xml;base64,${btoa(svg)}` };
    this.sources.set(key, source);
    return source;
  }
}
