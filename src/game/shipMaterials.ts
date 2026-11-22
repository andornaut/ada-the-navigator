import { SVG_DECIMALS, svgText } from "../../art/tools/svg-text.ts";
import { ECONOMY } from "../data/economy.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";

export const SHIP_MATERIAL_SLOTS = [
  "top",
  "frontSides",
  "rearSides",
  "skirt",
  "canopyRoof",
  "canopySides",
  "engineHousing",
  "engineOpening",
] as const;

type MaterialSlot = (typeof SHIP_MATERIAL_SLOTS)[number];
export type ShipMaterialPalette = Readonly<Record<MaterialSlot, string>>;
interface DrawRef {
  readonly alpha: 1;
  readonly path: number;
  readonly slot: MaterialSlot;
}
interface Profiles {
  readonly distinct: readonly DrawRef[];
  readonly frontSkirt: readonly DrawRef[];
}
export interface ShipMaterials {
  readonly headings: ReadonlyMap<number, Profiles>;
  readonly paths: readonly string[];
  readonly poses: ReadonlyMap<string, Profiles>;
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

function readProfiles(paths: readonly string[], value: unknown): Profiles | undefined {
  const profiles = fields(value);
  const refs = (value: unknown): readonly DrawRef[] | undefined => {
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
  };
  const distinct = refs(profiles?.distinct);
  const frontSkirt = refs(profiles?.frontSkirt);
  return distinct && frontSkirt ? { distinct, frontSkirt } : undefined;
}

/** Read the producer's exact geometry and equality profiles, retaining every ordered path. */
export function readShipMaterials(
  expected: { readonly poses: readonly string[]; readonly warpHeading: number },
  value: unknown,
): ShipMaterials | undefined {
  const root = fields(value);
  const contract = fields(root?.shipHeadings);
  const ship = fields(root?.ship);
  const warp = fields(root?.warp);
  if (
    root?.version !== 1 ||
    contract?.count !== SHIP_HEADINGS ||
    contract.version !== 2 ||
    !Array.isArray(root.paths) ||
    !root.paths.length ||
    !root.paths.every(
      (path: unknown) =>
        typeof path === "string" && /^[Mm][MmLlHhVvCcSsQqTtAaZzEe0-9,.\s+-]*$/.test(path),
    ) ||
    !Array.isArray(root.slots) ||
    root.slots.length !== SHIP_MATERIAL_SLOTS.length ||
    !SHIP_MATERIAL_SLOTS.every((name) => (root.slots as unknown[]).includes(name)) ||
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
  const headings = new Map<number, Profiles>();
  for (const value of ship.headings as unknown[]) {
    const heading = fields(value);
    const profiles = readProfiles(paths, heading?.profiles);
    if (
      !profiles ||
      typeof heading?.index !== "number" ||
      !Number.isInteger(heading.index) ||
      heading.index < 0 ||
      heading.index >= SHIP_HEADINGS ||
      headings.has(heading.index)
    ) {
      return undefined;
    }
    headings.set(heading.index, profiles);
  }
  const poses = new Map<string, Profiles>();
  for (const value of warp.poses as unknown[]) {
    const pose = fields(value);
    const profiles = readProfiles(paths, pose?.profiles);
    if (
      !profiles ||
      typeof pose?.id !== "string" ||
      !expected.poses.includes(pose.id) ||
      poses.has(pose.id)
    ) {
      return undefined;
    }
    poses.set(pose.id, profiles);
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

  pose(paint: string, id: string): MaterialSvg | undefined {
    return this.source(`pose:${paint}:${id}`, paint, 256, this.materials.poses.get(id));
  }

  private source(
    key: string,
    paint: string,
    frame: number,
    profiles: Profiles | undefined,
  ): MaterialSvg | undefined {
    const cached = this.sources.get(key);
    if (cached) {
      return cached;
    }
    const palette = this.palettes.get(paint);
    if (!palette || !profiles) {
      return undefined;
    }
    const same = palette.frontSides.toLowerCase() === palette.skirt.toLowerCase();
    const refs = same ? profiles.frontSkirt : profiles.distinct;
    const paths = refs.map(
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
