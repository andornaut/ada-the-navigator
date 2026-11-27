import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { mapPanelTree } from "./mapPanelTree.ts";

it("groups the place content separately from the ordered native actions", () => {
  const tree = mapPanelTree();
  validateLayoutTree({ group: ["content"], leaf: [] }, tree);
  expect(tree).toMatchObject({
    props: "panel",
    slots: {
      content: [
        {
          props: "row",
          slots: {
            content: [
              {
                props: "place",
                slots: {
                  content: [
                    { props: "chip" },
                    {
                      props: "text",
                      slots: {
                        content: [{ props: "name" }, { props: "detail0" }, { props: "detail1" }],
                      },
                    },
                  ],
                },
              },
              { props: "actions", slots: { content: [{ props: "travel" }, { props: "quest" }] } },
            ],
          },
        },
        { props: "empty" },
        {
          props: "reason",
          slots: { content: [{ props: "danger" }, { props: "towing" }, { props: "carrying" }] },
        },
      ],
    },
  });
});

it("retains all native visibility targets and stable keys without selection or policy data", () => {
  expect(mapPanelTree()).toEqual(mapPanelTree());
  const json = JSON.stringify(mapPanelTree());
  for (const key of [
    "panel",
    "row",
    "place",
    "text",
    "reason",
    "chip",
    "name",
    "detail0",
    "detail1",
    "actions",
    "travel",
    "quest",
    "danger",
    "towing",
    "carrying",
    "empty",
  ]) {
    expect(json.split(`"key":"${key}"`)).toHaveLength(2);
  }
  expect(json).not.toContain("hostileStationStatus");
  expect(json).not.toContain("inDanger");
});
