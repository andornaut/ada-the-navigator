import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { anchor } from "../../art/tools/projection.ts";
import { nose } from "../../art/tools/ship-model.ts";
import manifest from "../../public/art/manifest.json";
import quantum from "../../public/art/quantum-jump.json";
import mainData from "../../public/art/ship-jets.json";
import noseData from "../../public/art/ship-nose.json";
import retroData from "../../public/art/ship-retro-jets.json";
import yellowArchive from "../../public/art/ship-retro-jets-yellow.json";
import title from "../../public/art/title-screen.json";
import { ECONOMY } from "../data/economy.ts";
import { fromScreen } from "../model/convex.ts";
import {
  noseScreenOffset,
  readShipNose,
  SHIP_HEADINGS,
  SHIP_NOSE,
  shipHeading,
  shipSilhouette,
} from "../model/nose.ts";
import { shipBody, shipTouches } from "../model/shipBody.ts";
import { SHIP_HEADING_CONTRACT } from "../model/shipHeadingContract.ts";
import { readTitleScreen } from "../ui/titleScreen.ts";
import { ENEMY_HEADINGS } from "./enemyArt.ts";
import { hasPlayerHeadingPackage } from "./playerHeadingPackage.ts";
import { readQuantumJump } from "./quantumJump.ts";
import {
  hasShipHeadings,
  selectPaintedShipAsset,
  type ShipAsset,
  shipDirection,
} from "./shipArt.ts";
import {
  engineJets,
  jetTriangles,
  readEngineJets,
  readJetGeometry,
  readShipJets,
} from "./shipJets.ts";

const paints = ECONOMY.paintOrder.filter((paint) => paint !== ECONOMY.defaultPaint);
const forward = readEngineJets(mainData)!;
const reverse = readEngineJets(retroData)!;
const facing = (index: number) => ({
  x: Math.cos((index * 2 * Math.PI) / SHIP_HEADINGS),
  y: Math.sin((index * 2 * Math.PI) / SHIP_HEADINGS),
});

describe("atomic 64-heading player package", () => {
  it("contains each declared hull and paint group while preserving the separate enemy/archive formats", () => {
    expect(SHIP_HEADINGS).toBe(64);
    expect(ENEMY_HEADINGS).toBe(16);
    expect(hasPlayerHeadingPackage(paints, manifest)).toBe(true);
    expect(manifest.shipHeadings).toEqual(SHIP_HEADING_CONTRACT);
    expect(forward.headings).toHaveLength(64);
    expect(reverse.headings).toHaveLength(64);
    expect(readEngineJets(yellowArchive)).toBeUndefined();
    expect(yellowArchive.headings).toHaveLength(32);
  });

  it.each(Array.from({ length: 64 }, (_, index) => index))(
    "keeps sample %i hull, nose, collision and both mouths in one direction",
    (index) => {
      const direction = facing(index);
      expect(shipHeading(direction)).toBe(index);
      expect(shipDirection(64, direction)).toBe(index);
      if (index % 4 === 0) {
        expect(shipDirection(16, direction)).toBe(index / 4);
      }
      const projected = anchor(64, 48, index, nose());
      expect(SHIP_NOSE.noses[index]).toEqual({ x: projected[0], y: projected[1] });
      const offset = noseScreenOffset(index);
      expect(offset.x).toBeCloseTo(((projected[0] - 48) * 42) / 96, 10);
      expect(offset.y).toBeCloseTo(((projected[1] - 48) * 42) / 96, 10);
      expect(shipBody(direction)).toBe(shipSilhouette(index));
      for (const part of shipBody(direction)) {
        expect(part.length).toBeGreaterThanOrEqual(3);
        for (const vertex of part) {
          expect(shipTouches(direction, { x: 0, y: 0 }, fromScreen(vertex), 0.01)).toBe(true);
        }
      }
      expect(shipTouches(direction, { x: 0, y: 0 }, { x: 1000, y: 1000 }, 1)).toBe(false);
      for (const paint of ECONOMY.paintOrder) {
        const selected = selectPaintedShipAsset(
          manifest.assets as (ShipAsset & { path: string })[],
          paint === ECONOMY.defaultPaint ? null : paint,
          false,
          direction,
        )!;
        expect(selected.directionIndex).toBe(index);
        expect(selected.displayWidth).toBe(42);
        expect(selected.displayHeight).toBe(42);
        expect(existsSync(`public${selected.path}`)).toBe(true);
        expect(readFileSync(`public${selected.path}`, "utf8")).toContain('viewBox="0 0 96 96"');
      }
      for (const jets of [forward, reverse]) {
        expect(jets.headings[index]).toHaveLength(2);
        expect(
          jets.headings[index]!.every((mouth) => mouth.outerCorner && mouth.coreOutboard),
        ).toBe(true);
        for (const mouth of jets.headings[index]!) {
          const triangles = jetTriangles(
            { ...engineJets(jets, 1), headings: [[mouth]] },
            { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } },
            0,
            0.8,
          );
          expect(triangles.length).toBeGreaterThan(0);
          expect(triangles.every((triangle) => triangle.occluders === undefined)).toBe(true);
          if (jets === reverse) {
            expect(mouth.rearClip).toBeDefined();
            for (const triangle of triangles) {
              for (const point of triangle.points) {
                const clip = mouth.rearClip!;
                expect(
                  clip.normal.x * point.x + clip.normal.y * point.y - clip.constant,
                ).toBeLessThanOrEqual(1e-8);
              }
            }
          } else {
            expect(mouth.rearClip).toBeUndefined();
          }
        }
      }
    },
  );

  it("keeps cardinal directions and both sides of every half-step boundary including wrap", () => {
    expect([0, 16, 32, 48].map((index) => shipHeading(facing(index)))).toEqual([0, 16, 32, 48]);
    for (let index = 0; index < 64; index++) {
      const boundary = ((index + 0.5) * 2 * Math.PI) / 64;
      const at = (angle: number) => ({ x: Math.cos(angle), y: Math.sin(angle) });
      expect(shipHeading(at(boundary - 1e-8))).toBe(index);
      expect(shipHeading(at(boundary + 1e-8))).toBe((index + 1) % 64);
    }
  });

  it("rejects absent, legacy and mismatched player descriptors in every indexed reader", () => {
    for (const shipHeadings of [
      undefined,
      { count: 32, version: 1 },
      { count: 32, version: 2 },
      { count: 64, version: 1 },
    ]) {
      expect(readShipNose({ ...noseData, shipHeadings })).toBeUndefined();
      expect(readEngineJets({ ...mainData, shipHeadings })).toBeUndefined();
      expect(readEngineJets({ ...retroData, shipHeadings })).toBeUndefined();
      expect(readQuantumJump({ ...quantum, shipHeadings })).toBeUndefined();
      expect(
        readTitleScreen(manifest.assets, engineJets(forward, 1), { ...title, shipHeadings }),
      ).toBeNull();
      expect(hasPlayerHeadingPackage(paints, { ...manifest, shipHeadings })).toBe(false);
    }
  });

  it("rejects partial sets, missing paint groups, duplicate or out-of-range manifest and mouth indices", () => {
    expect(
      hasPlayerHeadingPackage(paints, {
        ...manifest,
        assets: manifest.assets.filter((asset) => asset.id !== "ship-63"),
      }),
    ).toBe(false);
    expect(
      hasPlayerHeadingPackage(paints, {
        ...manifest,
        assets: manifest.assets.filter((asset) => !("paint" in asset) || asset.paint !== paints[0]),
      }),
    ).toBe(false);
    const first = manifest.assets.find((asset) => asset.id === "ship-0")!;
    for (const extra of [first, { ...first, directionIndex: 64, id: "ship-64" }]) {
      expect(
        hasPlayerHeadingPackage(paints, { ...manifest, assets: [...manifest.assets, extra] }),
      ).toBe(false);
    }
    expect(hasShipHeadings(manifest.assets.filter((asset) => asset.directionIndex !== 63))).toBe(
      false,
    );
    expect(
      readEngineJets({ ...mainData, headings: mainData.headings.slice(0, 32) }),
    ).toBeUndefined();
    for (const index of [-1, 64, 0]) {
      const headings = [...mainData.headings];
      headings[1] = { ...headings[1]!, index };
      expect(readEngineJets({ ...mainData, headings })).toBeUndefined();
    }
  });

  it("keeps the same physical title and warp views without changing singleton pose geometry", () => {
    expect(title.ship.frame).toBe(52);
    expect(quantum.warp.heading).toBe(48);
    expect(manifest.assets.find(({ id }) => id === "ship")?.directionIndex).toBe(40);
    const jump = readQuantumJump(quantum)!;
    expect(jump.warp.poses).toHaveLength(9);
    expect(jump.warp.poses.filter(({ jets }) => jets)).toHaveLength(7);
    for (const pose of quantum.warp.poses) {
      if ("jets" in pose) {
        expect(readJetGeometry(pose.jets)?.headings).toHaveLength(1);
      }
    }
    const generic = {
      ...mainData,
      headings: mainData.headings.slice(0, 16),
      layers: mainData.engineLevels[0]!.layers,
    };
    expect(readShipJets(generic)?.headings).toHaveLength(16);
  });
});
