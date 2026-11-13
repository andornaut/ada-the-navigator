import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { openingScene, resolutionScene } from "./storybook.ts";

describe("chapter page titles", () => {
  it("keeps the actual first-launch arrival and farewell titled without changing their lines", () => {
    const opening = openingScene(CONTENT, 1, true);
    for (const page of opening.pages) {
      expect(page.heading, page.id).toBe(CONTENT.chapters[1]!.name);
    }
    expect(
      opening.pages
        .filter((page) => page.id.startsWith("opening:arrival:"))
        .map(({ speaker, text }) => ({ speaker, text })),
    ).toEqual(CONTENT.premise.gardenArrival.map(({ speaker, text }) => ({ speaker, text })));
    const farewell = opening.pages.find((page) => page.id === "opening:farewell")!;
    expect(farewell.text).toBe(CONTENT.premise.gardenFarewell.text);
    expect(farewell.speaker).toBe(CONTENT.premise.gardenFarewell.speaker);
  });
  it.each(GALAXY_NUMBERS)(
    "keeps galaxy %s's canonical title through every branch and rejoin",
    (galaxy) => {
      const chapter = CONTENT.chapters[galaxy]!;
      const opening = openingScene(CONTENT, galaxy);
      const resolution = resolutionScene(CONTENT, galaxy);
      for (const scene of [opening, resolution]) {
        for (const page of scene.pages) {
          expect(page.heading, `${scene.id}/${page.id}`).toBe(chapter.name);
        }
      }
      expect(
        opening.pages
          .filter((page) => page.id.startsWith("opening:branch:"))
          .map((page) => page.text),
      ).toEqual(chapter.openingBranches);
      expect(
        resolution.pages
          .filter((page) => page.id.startsWith("resolution:branch:"))
          .map((page) => page.text),
      ).toEqual(chapter.resolutionBranches);
      expect(opening.pages.filter((page) => page.id.startsWith("opening:rejoin:"))).toHaveLength(
        chapter.openingRejoin?.length ?? 0,
      );
      expect(
        resolution.pages.filter((page) => page.id.startsWith("resolution:rejoin:")),
      ).toHaveLength(chapter.resolutionRejoin?.length ?? 0);
      expect(resolution.pages.filter((page) => page.id.startsWith("closing:"))).toHaveLength(
        chapter.closingLines?.length ?? 0,
      );
    },
  );
});
