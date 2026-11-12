import { byGalaxy } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { SpaceObject } from "../model/types.ts";

const ROLES = [
  "active",
  "ammo",
  "background",
  "environment",
  "environmentDetail",
  "obstacle",
  "pointOfInterest",
  "shipHardpoint",
  "threat",
  "weapon",
] as const;
export type SpacePalette = Readonly<Record<(typeof ROLES)[number], number>>;

// Preserve the existing placeholder contrast when palette data cannot load or validate.
export const FALLBACK_SPACE_PALETTE: SpacePalette = {
  active: 0xffffff,
  ammo: 0xffffff,
  background: 0x101010,
  environment: 0x222222,
  environmentDetail: 0x525252,
  obstacle: 0xffffff,
  pointOfInterest: 0xd4d4d4,
  shipHardpoint: 0xffffff,
  threat: 0xffffff,
  weapon: 0xffffff,
};

export function readSpacePalette(value: unknown): SpacePalette | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("colors" in value) ||
    !value.colors ||
    typeof value.colors !== "object"
  ) {
    return undefined;
  }
  const colors = value.colors as Record<string, unknown>;
  const result = {} as Record<(typeof ROLES)[number], number>;
  for (const role of ROLES) {
    const color = colors[role];
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) {
      return undefined;
    }
    result[role] = Number.parseInt(color.slice(1), 16);
  }
  return result;
}

/** Match existing collision classes, including zero-speed debris with ballistic ownership. */
export function spaceObjectColor(palette: SpacePalette, object: SpaceObject): number {
  switch (object.kind) {
    case "enemy":
    case "hazard":
      return palette.obstacle;
    case "debris":
      return object.velocity === undefined ? palette.environmentDetail : palette.obstacle;
    case "destination":
    case "resource":
      return palette.pointOfInterest;
    case "pickup":
      return object.ammoPack ? palette.ammo : object.upgrade ? palette.weapon : palette.active;
    case "rock":
      return palette.environmentDetail;
  }
  return palette.environmentDetail;
}

export function spaceColorCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

// The field roles a galaxy retints (art/galaxies.md "Field hues"); signals never change.
const FIELD_ROLES = ["background", "environment", "environmentDetail"] as const;
export type FieldColors = Pick<SpacePalette, (typeof FIELD_ROLES)[number]>;

/** One galaxies.json entry's field colours; undefined if any role is missing or malformed. */
function readFieldColors(entry: unknown): FieldColors | undefined {
  const colors = (entry as { colors?: Record<string, unknown> } | null | undefined)?.colors;
  const values = FIELD_ROLES.map((role) => colors?.[role]);
  if (!values.every((color) => typeof color === "string" && /^#[0-9a-f]{6}$/iu.test(color))) {
    return undefined;
  }
  return Object.fromEntries(
    FIELD_ROLES.map((role, index) => [
      role,
      Number.parseInt((values[index] as string).slice(1), 16),
    ]),
  ) as FieldColors;
}

/**
 * Each galaxy's field colours from Art's galaxies.json, keyed there by stable galaxy id, by
 * GalaxyNumber; empty if invalid.
 */
export function readGalaxyFields(value: unknown): ReadonlyMap<GalaxyNumber, FieldColors> {
  const data = value as { galaxies?: unknown; version?: unknown } | null | undefined;
  if (data?.version !== 1) {
    return new Map();
  }
  return byGalaxy(readFieldColors, data.galaxies) ?? new Map();
}

/** Each galaxy's palette: the base palette with that galaxy's field colours. */
export function galaxyPalettes(
  palette: SpacePalette,
  fields: ReadonlyMap<GalaxyNumber, FieldColors>,
): ReadonlyMap<GalaxyNumber, SpacePalette> {
  return new Map([...fields].map(([galaxy, colors]) => [galaxy, { ...palette, ...colors }]));
}
