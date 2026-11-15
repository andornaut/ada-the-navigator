import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { updateTree } from "./updateTree.ts";
it("declares native content with ordered stable original actions and caller labels only", () => {
  const labels = {
    accept: "Update now",
    cancel: "Cancel",
    close: "Close",
    title: "Update available",
  };
  const tree = updateTree(labels);
  validateLayoutTree(
    { button: [], card: ["header", "body", "footer"], text: [], update: ["footer"] },
    tree,
  );
  expect(tree).toEqual({
    component: "update",
    key: "update",
    kind: "component",
    props: labels,
    slots: {
      footer: [
        {
          component: "button",
          key: "cancel",
          kind: "component",
          props: { actionId: "cancel-update", label: "Cancel", role: "secondary" },
        },
        {
          component: "button",
          key: "accept",
          kind: "component",
          props: { actionId: "accept-update", label: "Update now", role: "primary" },
        },
      ],
    },
  });
  expect(updateTree({ ...labels, accept: "Current caller label" })).toMatchObject({
    key: tree.key,
    slots: {
      footer: [{ key: "cancel" }, { key: "accept", props: { label: "Current caller label" } }],
    },
  });
});
