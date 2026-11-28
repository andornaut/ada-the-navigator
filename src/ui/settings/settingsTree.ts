import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { DeviceSetting } from "../deviceSettings.ts";
import { settingsColumnArrangement } from "../layout/index.ts";

export type SettingsSwitch = DeviceSetting;
export type SettingsNative = SettingsSwitch | "actions" | "build" | "divider" | "install";
export type SettingsLayoutSchema = {
  settings: { props: Record<string, never>; slots: "body" };
  column: { props: "left" | "right"; slots: "rows" };
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
            {
              component: "column",
              key: "left",
              kind: "component",
              props: "left",
              slots: { rows: [native("move"), native("aim"), native("sound")] },
            },
            native("divider"),
            {
              component: "column",
              key: "right",
              kind: "component",
              props: "right",
              slots: {
                rows: [
                  native("fpsCounter"),
                  native("reducedMotion"),
                  ...(data.install ? [native("install")] : []),
                ],
              },
            },
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
