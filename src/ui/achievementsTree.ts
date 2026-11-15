import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AchievementEntry, AchievementsLabels } from "./achievementsCard.ts";

export interface AchievementsTreeData {
  readonly entries: readonly AchievementEntry[];
  readonly entryOffset: number;
  readonly labels: AchievementsLabels;
  readonly nextHidden: boolean;
  readonly pageText: string;
  readonly pagerHidden: boolean;
  readonly previousHidden: boolean;
}

export type AchievementsLayoutSchema = {
  achievements: {
    props: {
      readonly card: {
        readonly closeAction: "close-achievements";
        readonly closeLabel: string;
        readonly list: true;
        readonly size: "large";
        readonly title: string;
      };
      readonly pagerHidden: boolean;
    };
    slots: "entries" | "pager";
  };
  entry: {
    props: { readonly entry: AchievementEntry; readonly labels: AchievementsLabels };
    slots: never;
  };
  pageCount: { props: { readonly text: string }; slots: never };
  pagerAction: {
    props: {
      readonly actionId: "achievements-previous" | "achievements-next";
      readonly hidden: boolean;
      readonly label: string;
    };
    slots: never;
  };
};

/** Native list and pager slots retain their geometry; the caller supplies measured page facts. */
export function achievementsTree(
  data: AchievementsTreeData,
): Extract<ComponentNode<AchievementsLayoutSchema>, { component: "achievements" }> {
  return {
    component: "achievements",
    key: "achievements",
    kind: "component",
    props: {
      card: {
        closeAction: "close-achievements",
        closeLabel: data.labels.close,
        list: true,
        size: "large",
        title: data.labels.title,
      },
      pagerHidden: data.pagerHidden,
    },
    slots: {
      entries: data.entries.map((entry, index) => ({
        component: "entry",
        key: `entry:${data.entryOffset + index}`,
        kind: "component",
        props: { entry, labels: data.labels },
      })),
      pager: [
        {
          component: "pagerAction",
          key: "previous",
          kind: "component",
          props: {
            actionId: "achievements-previous",
            hidden: data.previousHidden,
            label: data.labels.previous,
          },
        },
        {
          component: "pageCount",
          key: "page-count",
          kind: "component",
          props: { text: data.pageText },
        },
        {
          component: "pagerAction",
          key: "next",
          kind: "component",
          props: {
            actionId: "achievements-next",
            hidden: data.nextHidden,
            label: data.labels.next,
          },
        },
      ],
    },
  };
}
