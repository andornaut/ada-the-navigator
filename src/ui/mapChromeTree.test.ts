import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { MAP_TOOLS } from "./layout/mapScreen.ts";
import { mapChromeTrees } from "./mapChromeTree.ts";

it("preserves header and navigation order in independent retained native chrome roots", () => {
  const trees = mapChromeTrees(MAP_TOOLS.map(({ id }) => id));
  for (const tree of trees) {
    validateLayoutTree({ card: ["body"], group: ["content"], leaf: [] }, tree);
  }
  expect(trees).toMatchObject([
    {
      props: "header",
      slots: {
        content: [
          {
            props: "headerRow",
            slots: {
              content: [
                { props: "galaxy" },
                { props: "divider" },
                { props: "column", slots: { content: [{ props: "percent" }, { props: "pips" }] } },
              ],
            },
          },
          { props: "surveyInfo" },
        ],
      },
    },
    { props: "tools", slots: { content: MAP_TOOLS.map(({ id }) => ({ props: id })) } },
    {
      props: "navigation",
      slots: { content: [{ props: "quests" }, { props: "galaxies" }, { props: "close" }] },
    },
    {
      props: "questsModal",
      slots: {
        content: [
          {
            component: "card",
            slots: {
              body: [
                { props: "lines" },
                {
                  props: "pager",
                  slots: {
                    content: [{ props: "previous" }, { props: "pageCount" }, { props: "next" }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ]);
});

it("takes the actual tool order as facts without owning glyph internals or dynamic quest content", () => {
  const trees = mapChromeTrees(["recentre", "zoomOut", "zoomIn"]);
  expect(trees[1]).toMatchObject({
    slots: { content: [{ key: "recentre" }, { key: "zoomOut" }, { key: "zoomIn" }] },
  });
  const data = JSON.stringify(trees);
  for (const key of ["fog", "places", "panel", "objective", "reward", "geometry", "ink"]) {
    expect(data).not.toContain(`"${key}"`);
  }
});
