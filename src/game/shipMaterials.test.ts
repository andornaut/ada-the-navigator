import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import paints from "../../public/art/ship-paint.json";
import { SHIPPED_SHIP_SOURCES } from "../testing/shippedShipSources.ts";
import {
  readShipMaterialPalettes,
  readShipMaterials,
  SHIP_MATERIAL_SLOTS,
  ShipMaterialSources,
} from "./shipMaterials.ts";

const poses = [
  "bank-8",
  "bank-16",
  "bank-24",
  "bank-30",
  "stretch-30",
  "settle-24",
  "settle-16",
  "settle-10",
  "settle-5",
];
const expected = { poses, warpHeading: 48 };
const profiles = () => ({
  distinct: [
    { alpha: 1, path: 0, slot: "top" },
    { alpha: 1, path: 1, slot: "engineOpening" },
  ],
  frontSkirt: [
    { alpha: 1, path: 2, slot: "frontSides" },
    { alpha: 1, path: 1, slot: "engineOpening" },
  ],
});
const fixture = () => ({
  palettePath: "/art/ship-paint.json",
  paths: ["M0,0L2,0L1,2Z", "M3,0L4,0L4,1Z", "M0,0L2,0L2,2L0,2Z"],
  ship: {
    displayScale: 0.4375,
    frame: 96,
    headings: Array.from({ length: 64 }, (_, index) => ({ index, profiles: profiles() })),
    pivot: [0.5, 0.5],
  },
  shipHeadings: { count: 64, version: 2 },
  slots: [...SHIP_MATERIAL_SLOTS],
  version: 1,
  warp: {
    displayScale: 0.4375,
    frame: 256,
    heading: 48,
    pivot: [0.5, 0.5],
    poses: poses.map((id) => ({ id, profiles: profiles() })),
  },
});

describe("semantic ship material sources", () => {
  it("uses the original per-material paint values and colour-equality union profile", () => {
    const materials = readShipMaterials(expected, fixture());
    const palettes = readShipMaterialPalettes(
      paints.schemes.map(({ id }) => id),
      paints,
    );
    expect(materials).toBeDefined();
    expect(palettes).toBeDefined();
    const sources = new ShipMaterialSources(materials!, palettes!);
    const classic = sources.ship("classic", 0)!;
    const cobalt = sources.ship("cobalt", 0)!;
    expect(classic.svg).toContain('<path fill="#ffffff" d="M0,0L2,0L1,2Z"/>');
    expect(classic.svg).toContain('<path fill="#86deff" d="M3,0L4,0L4,1Z"/>');
    expect(cobalt.svg).toContain('<path fill="#5074b1" d="M0,0L2,0L2,2L0,2Z"/>');
    expect(cobalt.svg).toContain('<path fill="#e4f6ff" d="M3,0L4,0L4,1Z"/>');
    expect(sources.ship("cobalt", 0)).toBe(cobalt);
    expect(sources.pose("cobalt", "bank-30")?.svg).toContain('viewBox="0 0 256 256"');
    expect(sources.ship("cobalt", 63)).toBeDefined();
    expect(sources.ship("cobalt", 64)).toBeUndefined();
  });

  it("reproduces the standalone serializer without replacing existing material sources", () => {
    const materials = fixture();
    materials.paths[0] = "M-.004,0L2.006,0L1.234,2Z";
    const geometry = readShipMaterials(expected, materials)!;
    const palettes = readShipMaterialPalettes(
      paints.schemes.map(({ id }) => id),
      paints,
    )!;
    const sources = new ShipMaterialSources(geometry, palettes);
    const classic = sources.standaloneClassic(0)!;
    expect(classic.svg).toContain('d="M0,0L2.01,0L1.23,2Z"');
    expect(classic.svg).toContain("<title>Ship 0 idle</title>");
    expect(sources.standaloneClassic(0)).toBe(classic);
    expect(sources.ship("classic", 0)?.svg).toContain('d="M-.004,0L2.006,0L1.234,2Z"');
    expect(sources.standaloneClassic(64)).toBeUndefined();
  });

  it("matches the 64 original Classic bodies while they remain in the package", () => {
    const sources = SHIPPED_SHIP_SOURCES!;
    for (let heading = 0; heading < 64; heading++) {
      const path = new URL(`../../public/art/ship-${heading}.svg`, import.meta.url);
      const frame = sources.standaloneClassic(heading)!;
      expect(frame.svg).toContain(`<title>Ship ${heading} idle</title>`);
      if (existsSync(path)) {
        expect(frame.svg).toBe(readFileSync(path, "utf8"));
      }
    }
  });

  it("rejects incomplete heading/pose geometry, foreign XML, and changed opacity", () => {
    const partial = fixture();
    partial.ship.headings.pop();
    expect(readShipMaterials(expected, partial)).toBeUndefined();
    const wrongPose = fixture();
    wrongPose.warp.poses[0]!.id = "invented-pose";
    expect(readShipMaterials(expected, wrongPose)).toBeUndefined();
    const foreignXml = fixture();
    foreignXml.paths[0] = "<script>alert(1)</script>";
    expect(readShipMaterials(expected, foreignXml)).toBeUndefined();
    const changedAlpha = fixture();
    changedAlpha.ship.headings[0]!.profiles.distinct[0]!.alpha = 0.5;
    expect(readShipMaterials(expected, changedAlpha)).toBeUndefined();
  });

  it("does not synthesize a missing paint or accept invalid material colours", () => {
    const ids = paints.schemes.map(({ id }) => id);
    expect(readShipMaterialPalettes([...ids, "unknown"], paints)).toBeUndefined();
    const invalid = structuredClone(paints);
    invalid.schemes[0]!.engineOpening = "red";
    expect(readShipMaterialPalettes(ids, invalid)).toBeUndefined();
  });
});
