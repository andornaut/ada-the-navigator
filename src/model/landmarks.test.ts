import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { LANDMARK_GALAXIES } from "../data/jobs.ts";
import { landmarkLabel, landmarkSites } from "./landmarks.ts";
import { identityWords, stationWords } from "./stationIdentity.ts";

const label = (key: string) => CONTENT.labels[key] ?? "";

describe("landmark identity labels", () => {
  it("leaves every retained landmark's exact label key and display unchanged", () => {
    for (const galaxy of LANDMARK_GALAXIES) {
      for (const site of landmarkSites(galaxy)) {
        expect(site.nameWords).toBeUndefined();
        expect(landmarkLabel(label, site)).toBe(label(site.name));
        expect(landmarkLabel(label, site)).not.toBe("");
      }
    }
  });

  it("uses the approved short word qualifier without changing the base name", () => {
    const site = landmarkSites(1)[0]!;
    expect(landmarkLabel(label, { ...site, nameWords: identityWords(72n) })).toBe(
      `${label(site.name)} Ember Iris`,
    );
    expect(identityWords(1199n)).toBe("Ember Kite Pebble");
    expect(identityWords(0n)).toBe("Amber");
    expect(() => identityWords(-1n)).toThrow();
    expect(stationWords("station:0,0")).toBe("Amber");
  });
});
