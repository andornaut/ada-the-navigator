import { type LayoutNode, validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { CARD_CONTENT } from "../layout/contentCard.ts";
import { SETTINGS_COLUMN_GAP } from "../layout/settings.ts";
import { type SettingsLayoutSchema, settingsTree } from "./settingsTree.ts";

function body(columns: 1 | 2, install: boolean) {
  const tree = settingsTree({ columns, install });
  validateLayoutTree({ column: ["rows"], native: [], settings: ["body"] }, tree);
  if (tree.kind !== "component" || tree.component !== "settings") {
    throw Error("Missing Settings port");
  }
  return tree.slots!.body!;
}

it("uses the published fractional/intrinsic tracks around the canonical native divider", () => {
  const [rows, build, actions] = body(2, true);
  expect(rows).toMatchObject({
    gap: SETTINGS_COLUMN_GAP / 2,
    kind: "columns",
    sizing: {
      mode: "tracks",
      tracks: [{ kind: "fraction" }, { kind: "intrinsic" }, { kind: "fraction" }],
    },
  });
  expect(build).toMatchObject({ component: "native", key: "build" });
  expect(actions).toMatchObject({ component: "native", key: "actions" });
});

it("stacks existing columns at the original row gap when native labels require one column", () => {
  const [rows] = body(1, false);
  expect(rows).toMatchObject({ gap: CARD_CONTENT.rowGap, kind: "stack" });
  expect(rows).not.toHaveProperty("sizing");
});

it("omits the complete unavailable Install row and retains widget keys across layout changes", () => {
  const keys = (node: LayoutNode<SettingsLayoutSchema>): string[] => [
    node.key,
    ...(node.kind === "component"
      ? Object.values(node.slots ?? {}).flatMap((children) => children!.flatMap(keys))
      : node.children.flatMap(keys)),
  ];
  const installed = keys(settingsTree({ columns: 2, install: false }));
  const browser = keys(settingsTree({ columns: 2, install: true }));
  expect(installed).toEqual([
    "settings",
    "rows",
    "left",
    "move",
    "aim",
    "sound",
    "divider",
    "right",
    "fpsCounter",
    "reducedMotion",
    "build",
    "actions",
  ]);
  expect(browser).toEqual([
    "settings",
    "rows",
    "left",
    "move",
    "aim",
    "sound",
    "divider",
    "right",
    "fpsCounter",
    "reducedMotion",
    "install",
    "build",
    "actions",
  ]);
  expect(keys(settingsTree({ columns: 1, install: true }))).toEqual(browser);
});
