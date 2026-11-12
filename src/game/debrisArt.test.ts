import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ART_MANIFEST } from "../testing/publicArt.ts";
import { debrisFrame, debrisMarks, debrisPiece, readDebrisArt } from "./debrisArt.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
const manifest = ART_MANIFEST as unknown as {
  assets: { id: string }[];
  cartwheelDebris: string;
  whirlpoolDebris: string;
};
const ids = new Set(manifest.assets.map((asset) => asset.id));

describe("traveling debris art", () => {
  it("reads Cartwheel's plate and Whirlpool's plate and girder with one reader", () => {
    const cartwheel = readDebrisArt(json(manifest.cartwheelDebris))!;
    const whirlpool = readDebrisArt(json(manifest.whirlpoolDebris))!;
    expect(cartwheel.pieces.map((piece) => piece.id)).toEqual(["cartwheel-debris"]);
    expect(whirlpool.pieces.map((piece) => piece.id).sort()).toEqual([
      "whirlpool-debris-girder",
      "whirlpool-debris-plate",
    ]);
    for (const art of [cartwheel, whirlpool]) {
      expect(art.tumble.degPerSecond).toEqual([60, 120]);
      for (const piece of art.pieces) {
        expect(piece.frames).toHaveLength(8);
        // Each frame's texture is the manifest entry {piece}-{k}.
        expect(piece.frames.every((_, k) => ids.has(`${piece.id}-${k}`))).toBe(true);
      }
    }
    expect(readDebrisArt({ version: 2 })).toBeUndefined();
  });

  it("gives each river rock a fixed piece and tumbles it, holding frame 0 under reduced motion", () => {
    const art = readDebrisArt(json(manifest.whirlpoolDebris))!;
    const chosen = new Set(
      Array.from({ length: 40 }, (_, i) => debrisPiece(art, `river:current:1,2:${i}`).id),
    );
    expect(chosen.size).toBe(2);
    expect(debrisPiece(art, "river:current:1,2:3")).toBe(debrisPiece(art, "river:current:1,2:3"));
    const piece = debrisPiece(art, "river:current:1,2:3");
    expect(debrisFrame(art, piece, "river:current:1,2:3", true, 30)).toBe(0);
    const frames = new Set(
      Array.from({ length: 40 }, (_, i) =>
        debrisFrame(art, piece, "river:current:1,2:3", false, i / 4),
      ),
    );
    expect(frames.size).toBeGreaterThan(4);
  });

  it("trails the coral dashes behind the piece, farthest faintest", () => {
    const art = readDebrisArt(json(manifest.cartwheelDebris))!;
    const piece = art.pieces[0]!;
    const marks = debrisMarks(art, piece, 0, { x: 10, y: 0 });
    expect(marks.map((mark) => mark.alpha)).toEqual([0.95, 0.7, 0.45]);
    // Moving right, every dash sits left of the piece and the last is farthest behind.
    expect(marks.every((mark) => Math.max(mark.from.x, mark.to.x) < 0)).toBe(true);
    expect(Math.min(marks[2]!.from.x, marks[2]!.to.x)).toBeLessThan(
      Math.min(marks[0]!.from.x, marks[0]!.to.x),
    );
    expect(
      marks.map((mark) => Math.hypot(mark.to.x - mark.from.x, mark.to.y - mark.from.y)),
    ).toEqual([9, 6, 4]);
    expect(debrisMarks(art, piece, 0, { x: 0, y: 0 })).toEqual([]);
  });
});
