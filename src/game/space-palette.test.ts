import { describe, expect, it } from "vitest";

import type { SpaceObject } from "../model/types.ts";
import { readSpacePalette, spaceColorCss, spaceObjectColor } from "./space-palette.ts";

const colors = {
  active: "#65C9BF",
  background: "#292734",
  environment: "#34333F",
  environmentDetail: "#403F4D",
  obstacle: "#D68B72",
  pointOfInterest: "#C4AFCC",
  shipHardpoint: "#70ACE8",
  weapon: "#F0BD68",
};
const palette = readSpacePalette({ colors, version: 1 })!;
const object = (kind: SpaceObject["kind"]): SpaceObject => ({
  hp: 1,
  id: "palette-test",
  kind,
  radius: 10,
  x: 0,
  y: 0,
});

describe("space palette boundary", () => {
  it("decodes the complete versioned color document and keeps CSS colors padded", () => {
    expect(palette.background).toBe(0x292734);
    expect(palette.obstacle).toBe(0xd68b72);
    expect(palette.weapon).toBe(0xf0bd68);
    expect(spaceColorCss(0x001122)).toBe("#001122");
    expect(Object.keys(palette)).toHaveLength(8);
  });

  it("rejects missing roles, unsupported versions and malformed colors instead of mixing partial palettes", () => {
    for (const value of [
      undefined,
      { colors, version: 2 },
      { colors: { background: colors.background }, version: 1 },
      { colors: { ...colors, active: "#fff" }, version: 1 },
      { colors: { ...colors, weapon: "#abcdef00" }, version: 1 },
      { colors: { ...colors, environment: "#zzzzzz" }, version: 1 },
    ]) {
      expect(readSpacePalette(value)).toBeUndefined();
    }
  });

  it("keeps harmless terrain muted while marking ballistic debris as dangerous even at zero speed", () => {
    const stationary = object("debris");
    expect(spaceObjectColor(palette, object("rock"))).toBe(palette.environmentDetail);
    expect(spaceObjectColor(palette, stationary)).toBe(palette.environmentDetail);
    expect(spaceObjectColor(palette, { ...stationary, velocity: { x: 0, y: 0 } })).toBe(
      palette.obstacle,
    );
    expect(spaceObjectColor(palette, object("hazard"))).toBe(palette.obstacle);
    expect(spaceObjectColor(palette, object("enemy"))).toBe(palette.obstacle);
  });

  it("distinguishes safe destinations and resource POIs from danger and separates weapon pickups", () => {
    expect(spaceObjectColor(palette, object("destination"))).toBe(palette.pointOfInterest);
    expect(spaceObjectColor(palette, object("resource"))).toBe(palette.pointOfInterest);
    expect(spaceObjectColor(palette, { ...object("pickup"), role: "cargo" })).toBe(palette.active);
    expect(spaceObjectColor(palette, { ...object("pickup"), weapon: "rapid" })).toBe(
      palette.weapon,
    );
    expect(spaceObjectColor(palette, object("destination"))).not.toBe(palette.obstacle);
  });
});
