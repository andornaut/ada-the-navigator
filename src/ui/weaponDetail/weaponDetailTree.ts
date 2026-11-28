import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AdaLayoutSchema } from "../layoutTree.ts";

export type WeaponDetailAction = "close-weapon-detail" | "dismiss-weapon-detail";

export interface WeaponDetailData {
  readonly closeLabel: string;
  readonly lines: readonly string[];
  readonly title: string;
}

export type WeaponDetailSchema = AdaLayoutSchema<WeaponDetailAction> & {
  weaponDetail: { props: WeaponDetailData; slots: "footer" };
};

/** Native content and icon ownership remain with the component; callbacks stay outside data. */
export function weaponDetailTree(data: WeaponDetailData): LayoutNode<WeaponDetailSchema> {
  return {
    component: "weaponDetail",
    key: "weapon-detail",
    kind: "component",
    props: data,
    slots: {
      footer: [
        {
          component: "button",
          key: "dismiss",
          kind: "component",
          props: {
            actionId: "dismiss-weapon-detail",
            label: data.closeLabel,
            role: "primary",
          },
        },
      ],
    },
  };
}
