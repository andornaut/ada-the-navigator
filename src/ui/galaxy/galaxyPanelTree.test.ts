import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { galaxyPanelTree } from "./galaxyPanelTree.ts";

it("composes the retained thumbnail, four text nodes and single native destination action", () => {
  const tree = galaxyPanelTree();
  validateLayoutTree({ group: ["content"], leaf: [] }, tree);
  expect(tree).toMatchObject({
    props: "screen",
    slots: {
      content: [
        {
          props: "panel",
          slots: {
            content: [
              { props: "shot" },
              {
                props: "text",
                slots: {
                  content: [
                    { props: "number" },
                    { props: "name" },
                    { props: "flavor" },
                    { props: "development" },
                  ],
                },
              },
            ],
          },
        },
        { props: "footer", slots: { content: [{ props: "jump" }] } },
      ],
    },
  });
});

it("keeps stable native keys without chart, ship, selection or travel policy data", () => {
  expect(galaxyPanelTree()).toEqual(galaxyPanelTree());
  const data = JSON.stringify(galaxyPanelTree());
  for (const key of [
    "screen",
    "panel",
    "text",
    "footer",
    "shot",
    "number",
    "name",
    "flavor",
    "development",
    "jump",
  ]) {
    expect(data.split(`"key":"${key}"`)).toHaveLength(2);
  }
  for (const excluded of ["chart", "ship", "unlocked", "stay", "atEarth"]) {
    expect(data).not.toContain(`"${excluded}"`);
  }
});
