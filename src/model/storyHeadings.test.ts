import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { openingScene, resolutionScene } from "./storybook.ts";

describe("chapter page titles", () => {
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
