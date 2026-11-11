import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GALAXIES, galaxyPreview } from "../data/storybook.ts";
import type { SpaceObject } from "../model/types.ts";
import {
  galaxyPalettes,
  readGalaxyFields,
  readSpacePalette,
  spaceColorCss,
  spaceObjectColor,
} from "./space-palette.ts";

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
    expect(spaceObjectColor(palette, { ...object("pickup"), weapon: "rapidMissile" })).toBe(
      palette.weapon,
    );
    expect(spaceObjectColor(palette, object("destination"))).not.toBe(palette.obstacle);
  });
});

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);
const manifest = JSON.parse(readFileSync(publicFile("/art/manifest.json"), "utf8")) as {
  galaxies: string;
};
const galaxiesData: unknown = JSON.parse(readFileSync(publicFile(manifest.galaxies), "utf8"));

describe("galaxy fields", () => {
  const fields = readGalaxyFields(galaxiesData);
  const palettes = galaxyPalettes(palette, fields);

  it("retints the background, environment and detail of each galaxy from Art's galaxies.json", () => {
    expect(
      [1, 2, 3, 4].map((galaxy) => {
        const { background, environment, environmentDetail } = palettes.get(galaxy)!;
        return [background, environment, environmentDetail].map(spaceColorCss);
      }),
    ).toEqual([
      ["#d8c994", "#c9ba86", "#baab77"],
      ["#39221e", "#452e2a", "#523a36"],
      ["#132d33", "#1f3940", "#2b464c"],
      ["#271423", "#331f2f", "#3f2b3b"],
    ]);
  });

  it("keeps every signal role at the base palette's colour", () => {
    for (const galaxyPalette of palettes.values()) {
      for (const role of [
        "active",
        "obstacle",
        "pointOfInterest",
        "shipHardpoint",
        "weapon",
      ] as const) {
        expect(galaxyPalette[role]).toBe(palette[role]);
      }
    }
  });

  it("reads no galaxy from invalid data, so the base field stays", () => {
    expect(readGalaxyFields({ galaxies: [], version: 1 }).size).toBe(0);
    expect(readGalaxyFields({ galaxies: [{ colors: {}, number: 1 }], version: 1 }).size).toBe(0);
    expect(readGalaxyFields({ version: 2 }).size).toBe(0);
    expect(readGalaxyFields(null).size).toBe(0);
  });

  it("names each selector galaxy by its galaxies.json id, with both previews committed", () => {
    const ids = (galaxiesData as { galaxies: { id: string; number: number }[] }).galaxies;
    expect(GALAXIES.map(({ id }, index) => ({ id, number: index + 1 }))).toEqual(
      ids.map(({ id, number }) => ({ id, number })),
    );
    for (const galaxy of GALAXIES) {
      for (const locked of [false, true]) {
        expect(existsSync(publicFile(galaxyPreview(galaxy, locked))), galaxy.id).toBe(true);
      }
    }
  });
});
