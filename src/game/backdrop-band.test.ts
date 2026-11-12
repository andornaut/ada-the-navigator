import { describe, expect, it } from "vitest";

import { GALAXY_MANIFESTS, publicJson } from "../testing/public-art.ts";
import {
  BAND_AREA,
  BAND_SEED,
  bandAlpha,
  bandLine,
  bandStars,
  readBackdropBand,
} from "./backdrop-band.ts";

const needle = GALAXY_MANIFESTS.get(4)!;
const file = publicJson(needle.links.needleBand!);
const band = readBackdropBand(file)!;

describe("Needle's band", () => {
  it("reads Art's band: -6 degrees through (0.5, 0.4) of the play view, three layers", () => {
    expect(band).toMatchObject({ angle: -6, color: "#CFC5BD", through: [0.5, 0.4] });
    expect(band.profile.map(({ sigma }) => sigma)).toEqual([30, 7, 1.2]);
    expect(band.stars).toMatchObject({ color: "#F1ECE6", size: 2, spacing: 240 });
    // Specks take the band's colour.
    expect(band.specks).toMatchObject({ alpha: [0.25, 0.8], color: "#CFC5BD", size: 1 });
  });

  it("peaks at alpha 0.24 on the line and falls to the haze layer far out", () => {
    expect(bandAlpha(band, 0)).toBeCloseTo(0.24, 6);
    expect(bandAlpha(band, 7)).toBeLessThan(0.1);
    expect(bandAlpha(band, 60)).toBeLessThan(0.002);
  });

  it("runs through its point in the haze's area, centred on the play view", () => {
    expect(BAND_AREA).toEqual({ height: 480, width: 960, x: -120, y: -60 });
    const { direction, point } = bandLine(band, BAND_AREA);
    expect(point).toEqual({ x: 480, y: 204 });
    expect(Math.atan2(direction.y, direction.x)).toBeCloseTo((-6 * Math.PI) / 180, 9);
  });

  it("scatters the same stars on every flight, about one speck per 2.2 px near the line", () => {
    const specks = bandStars(band, band.specks, BAND_AREA, BAND_SEED);
    expect(bandStars(band, band.specks, BAND_AREA, BAND_SEED)).toEqual(specks);
    expect(specks.length).toBeGreaterThan(400);
    expect(specks.length).toBeLessThan(450);
    const { direction, point } = bandLine(band, BAND_AREA);
    const across = specks.map(
      ({ x, y }) => (y - point.y) * direction.x - (x - point.x) * direction.y,
    );
    const spread = Math.sqrt(across.reduce((sum, d) => sum + d * d, 0) / across.length);
    expect(spread).toBeGreaterThan(10);
    expect(spread).toBeLessThan(14);
    expect(specks.every(({ alpha }) => alpha >= 0.25 && alpha <= 0.8)).toBe(true);
  });

  it("reads no band from another placement or a malformed part", () => {
    const valid = file as Record<string, unknown>;
    for (const change of [
      { version: 2 },
      { layer: "front" },
      { anchor: "world" },
      { parallax: 0.5 },
      { color: "silver" },
      { through: [0.5] },
      { profile: [] },
      { stars: { spacing: 0 } },
    ]) {
      expect(readBackdropBand({ ...valid, ...change })).toBeUndefined();
    }
    expect(readBackdropBand(null)).toBeUndefined();
  });
});
