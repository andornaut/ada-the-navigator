import { readFileSync } from "node:fs";

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
const draws = () => [
  { alpha: 1, path: 0, slot: "top" },
  { alpha: 1, path: 1, slot: "engineOpening" },
  { alpha: 1, path: 2, slot: "accentLeft" },
];
const fixture = () => ({
  palettePath: "/art/ship-paint.json",
  paths: ["M0,0L2,0L1,2Z", "M3,0L4,0L4,1Z", "M0,0L2,0L2,2L0,2Z"],
  ship: {
    displayScale: 0.4375,
    frame: 96,
    headings: Array.from({ length: 64 }, (_, index) => ({ draws: draws(), index })),
    pivot: [0.5, 0.5],
  },
  shipHeadings: { count: 64, version: 2 },
  slots: [...SHIP_MATERIAL_SLOTS],
  version: 2,
  warp: {
    displayScale: 0.4375,
    frame: 256,
    heading: 48,
    pivot: [0.5, 0.5],
    poses: poses.map((id) => ({ draws: draws(), id })),
  },
});

describe("semantic ship material sources", () => {
  it("fills each ordered draw from the selected paint's slot colour", () => {
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
    expect(classic.svg).toContain(
      '<path fill="#ffffff" d="M0,0L2,0L1,2Z"/>\n<path fill="#86deff" d="M3,0L4,0L4,1Z"/>\n' +
        '<path fill="#1a418f" d="M0,0L2,0L2,2L0,2Z"/>',
    );
    expect(cobalt.svg).toContain(
      '<path fill="#6f9ff0" d="M0,0L2,0L1,2Z"/>\n<path fill="#e4f6ff" d="M3,0L4,0L4,1Z"/>\n' +
        '<path fill="#0e1a46" d="M0,0L2,0L2,2L0,2Z"/>',
    );
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

  it("draws every shipped heading and pose in every paint from the 15 slots", () => {
    const sources = SHIPPED_SHIP_SOURCES!;
    for (const { id } of paints.schemes) {
      for (let heading = 0; heading < 64; heading++) {
        expect(sources.ship(id, heading)?.svg).toMatch(/<path fill="#[0-9a-f]{6}"/u);
      }
      for (const pose of poses) {
        expect(sources.pose(id, pose)?.svg).toContain('viewBox="0 0 256 256"');
      }
    }
    expect(sources.standaloneClassic(40)!.svg).toContain("<title>Ship 40 idle</title>");
  });

  it("reads Art's 15 slots in order and rejects the earlier schema", () => {
    const shipped = JSON.parse(
      readFileSync(new URL("../../public/art/ship-materials.json", import.meta.url), "utf8"),
    ) as { slots: string[] };
    expect(SHIP_MATERIAL_SLOTS).toEqual(shipped.slots);
    expect(readShipMaterials(expected, { ...fixture(), version: 1 })).toBeUndefined();
    const reordered = fixture();
    reordered.slots.reverse();
    expect(readShipMaterials(expected, reordered)).toBeUndefined();
    const profiled = fixture();
    Reflect.set(profiled.ship.headings[0]!, "profiles", { distinct: draws() });
    Reflect.deleteProperty(profiled.ship.headings[0]!, "draws");
    expect(readShipMaterials(expected, profiled)).toBeUndefined();
    const unknownSlot = fixture();
    unknownSlot.ship.headings[0]!.draws[0]!.slot = "frontSides";
    expect(readShipMaterials(expected, unknownSlot)).toBeUndefined();
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
    // An empty path draws nothing and is retained; a path that is not path data is refused.
    const empty = fixture();
    empty.paths[0] = "";
    expect(readShipMaterials(expected, empty)?.paths[0]).toBe("");
    const text = fixture();
    text.paths[0] = "hello";
    expect(readShipMaterials(expected, text)).toBeUndefined();
    const changedAlpha = fixture();
    changedAlpha.ship.headings[0]!.draws[0]!.alpha = 0.5;
    expect(readShipMaterials(expected, changedAlpha)).toBeUndefined();
  });

  it("does not synthesize a missing paint or accept invalid material colours", () => {
    const ids = paints.schemes.map(({ id }) => id);
    expect(readShipMaterialPalettes([...ids, "unknown"], paints)).toBeUndefined();
    const invalid = structuredClone(paints);
    invalid.schemes[0]!.engineOpening = "red";
    expect(readShipMaterialPalettes(ids, invalid)).toBeUndefined();
    const missing = structuredClone(paints);
    Reflect.deleteProperty(missing.schemes[1]!, "accentRight");
    expect(readShipMaterialPalettes(ids, missing)).toBeUndefined();
  });
});
