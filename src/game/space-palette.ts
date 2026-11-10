import type { SpaceObject } from "../model/types.ts";

const ROLES = [
  "active",
  "background",
  "environment",
  "environmentDetail",
  "obstacle",
  "pointOfInterest",
  "shipHardpoint",
  "weapon",
] as const;
export type SpacePalette = Readonly<Record<(typeof ROLES)[number], number>>;

// Preserve the existing placeholder contrast when palette data cannot load or validate.
export const FALLBACK_SPACE_PALETTE: SpacePalette = {
  active: 0xffffff,
  background: 0x101010,
  environment: 0x222222,
  environmentDetail: 0x525252,
  obstacle: 0xffffff,
  pointOfInterest: 0xd4d4d4,
  shipHardpoint: 0xffffff,
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
      return object.weapon ? palette.weapon : palette.active;
    case "rock":
      return palette.environmentDetail;
  }
  return palette.environmentDetail;
}

export function spaceColorCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
