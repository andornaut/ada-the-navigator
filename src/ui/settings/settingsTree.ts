import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { DeviceSetting } from "../deviceSettings.ts";
import { CARD_CONTENT, settingsColumnArrangement } from "../layout/index.ts";

export type SettingsSwitch = DeviceSetting;
export type SettingsNative = SettingsSwitch | "actions" | "build" | "divider" | "install";
export type SettingsLayoutSchema = {
  settings: { props: Record<string, never>; slots: "body" };
  native: { props: SettingsNative; slots: never };
};
export interface SettingsLayoutData {
  readonly columns: 1 | 2;
  readonly install: boolean;
}

const native = (id: SettingsNative): LayoutNode<SettingsLayoutSchema> => ({
  component: "native",
  key: id,
  kind: "component",
  props: id,
});

const column = (
  key: "left" | "right",
  rows: readonly SettingsNative[],
): LayoutNode<SettingsLayoutSchema> => ({
  children: rows.map(native),
  gap: CARD_CONTENT.rowGap,
  key,
  kind: "stack",
  padding: 0,
});

/** Native widgets retain their state and handlers; configuration owns their actual arrangement. */
export function settingsTree(data: SettingsLayoutData): LayoutNode<SettingsLayoutSchema> {
  return {
    component: "settings",
    key: "settings",
    kind: "component",
    props: {},
    slots: {
      body: [
        {
          ...settingsColumnArrangement(data.columns),
          children: [
            column("left", ["move", "aim", "sound"]),
            native("divider"),
            column("right", [
              "fpsCounter",
              "reducedMotion",
              ...(data.install ? (["install"] as const) : []),
            ]),
          ],
          key: "rows",
          padding: 0,
        },
        native("build"),
        native("actions"),
      ],
    },
  };
}
