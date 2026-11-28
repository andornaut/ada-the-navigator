import { describe, expect, it } from "vitest";

import { GALAXY_MANIFESTS, publicJson } from "../../testing/publicArt.ts";
import { BAND_AREA, bandAlpha, bandLine, bandStars, readBackdropBand } from "./backdropBand.ts";

const needle = GALAXY_MANIFESTS.get(4)!;
const file = publicJson(needle.links.needleBand!);
const band = readBackdropBand(file)!;
const { direction, point } = bandLine(band, BAND_AREA);
/** A star's distances along the band's line from its point and across it, in logical px. */
const local = ({ x, y }: { x: number; y: number }) => ({
  across: (y - point.y) * direction.x - (x - point.x) * direction.y,
  along: (x - point.x) * direction.x + (y - point.y) * direction.y,
});

describe("Needle's band", () => {
  it("reads Art's flat band: -6 degrees through (0.5, 0.4) of the play view, two strips", () => {
    expect(band).toMatchObject({ angle: -6, color: "#CFC5BD", through: [0.5, 0.4] });
    expect(band.profile).toEqual([
      { alpha: 0.07, halfWidth: 22 },
      { alpha: 0.11, halfWidth: 5 },
    ]);
    // Specks take the band's colour.
    expect(band.specks).toMatchObject({ alpha: 0.55, color: "#CFC5BD", pitch: 9, size: 1 });
    expect(band.stars).toMatchObject({ alpha: 1, color: "#F1ECE6", pitch: 240, size: 2 });
  });

  it("holds 0.18 within 5 px of the line, 0.07 out to 22 px and nothing past it", () => {
    for (const d of [0, 3, -5, 5]) {
      expect(bandAlpha(band, d), String(d)).toBeCloseTo(0.18, 9);
    }
    for (const d of [5.5, 12, -22, 22]) {
      expect(bandAlpha(band, d), String(d)).toBeCloseTo(0.07, 9);
    }
    expect(bandAlpha(band, 22.5)).toBe(0);
    expect(bandAlpha(band, -60)).toBe(0);
  });

  it("runs through its point in the haze's area, centred on the play view", () => {
    expect(BAND_AREA).toEqual({ height: 480, width: 960, x: -120, y: -60 });
    expect(point).toEqual({ x: 480, y: 204 });
    expect(Math.atan2(direction.y, direction.x)).toBeCloseTo((-6 * Math.PI) / 180, 9);
  });

  it("sets 85 specks 9 px apart from -380 to 376, across by the ten-step offset cycle", () => {
    const placed = bandStars(band, band.specks, BAND_AREA);
    expect(placed).toHaveLength(85);
    const cycle = [-9, 4, -2, 11, -6, 7, 0, -11, 9, -4];
    placed.map(local).forEach(({ across, along }, index) => {
      expect(along).toBeCloseTo(-380 + 9 * index, 9);
      expect(across).toBeCloseTo(cycle[index % 10]!, 9);
    });
    expect(placed.every(({ alpha }) => alpha === 0.55)).toBe(true);
  });

  it("sets four stars at -360, -120, 120 and 360 along the line, across by 5, -6, 3 and -4", () => {
    const stars = bandStars(band, band.stars, BAND_AREA);
    const expected = [
      [-360, 5],
      [-120, -6],
      [120, 3],
      [360, -4],
    ];
    expect(stars).toHaveLength(expected.length);
    stars.map(local).forEach(({ across, along }, index) => {
      expect(along).toBeCloseTo(expected[index]![0]!, 9);
      expect(across).toBeCloseTo(expected[index]![1]!, 9);
    });
    expect(stars.every(({ alpha }) => alpha === 1)).toBe(true);
  });

  it("leaves out stars past the area's edge", () => {
    const narrow = { ...BAND_AREA, width: 480 };
    const kept = bandStars(band, band.specks, narrow);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(85);
    expect(kept.every(({ x }) => x >= 0 && x <= 480)).toBe(true);
  });

  it("reads no band from another placement or a malformed part", () => {
    const valid = file as Record<string, unknown>;
    const specks = valid.specks as Record<string, unknown>;
    for (const change of [
      { version: 2 },
      { layer: "front" },
      { anchor: "world" },
      { parallax: 0.5 },
      { color: "silver" },
      { through: [0.5] },
      { profile: [] },
      { profile: [{ alpha: 0.1, sigma: 7 }] },
      { stars: { pitch: 0 } },
      { specks: { ...specks, offsets: [] } },
      { specks: { ...specks, alpha: 1.5 } },
    ]) {
      expect(readBackdropBand({ ...valid, ...change }), JSON.stringify(change)).toBeUndefined();
    }
    expect(readBackdropBand(null)).toBeUndefined();
  });
});
