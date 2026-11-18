import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { cheatsTree } from "./cheatsTree.ts";

it("keeps the caller's row order with stable keys, Close in its own slot", () => {
  const rows = [
    { id: "first", kind: "action", label: "First" },
    { id: "fps", kind: "switch", label: "FPS counter" },
    { id: "last", kind: "action", label: "Last" },
  ] as const;
  const tree = cheatsTree("Close", rows);
  validateLayoutTree({ action: [], footer: [], list: ["rows", "footer"], switch: [] }, tree);
  expect(tree).toEqual({
    component: "list",
    key: "cheats",
    kind: "component",
    props: {},
    slots: {
      footer: [
        { component: "footer", key: "dismiss", kind: "component", props: { label: "Close" } },
      ],
      rows: rows.map(({ id, kind, label }) => ({
        component: kind,
        key: id,
        kind: "component",
        props: { id, label },
      })),
    },
  });
});
