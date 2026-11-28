import type { ComponentNode, LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { AchievementEntry, AchievementsLabels } from "./achievementsCard.ts";
import { SPACING } from "./layout/tokens.ts";

export const ACHIEVEMENT_COLUMNS = {
  columnGap: SPACING.panelPadding,
  columns: 2,
  rowGap: SPACING.gap,
} as const;

export interface AchievementsTreeData {
  readonly columnWidth: number;
  readonly entries: readonly AchievementEntry[];
  readonly entryOffset: number;
  readonly labels: AchievementsLabels;
  readonly nextHidden: boolean;
  readonly pageText: string;
  readonly pagerHidden: boolean;
  readonly previousHidden: boolean;
  readonly rows: number;
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

/** Measured page facts set the column tracks and the column-major split. */
function entryColumns(data: AchievementsTreeData): readonly LayoutNode<AchievementsLayoutSchema>[] {
  if (data.entries.length === 0) {
    return [];
  }
  const { columnGap, columns, rowGap } = ACHIEVEMENT_COLUMNS;
  const entries = data.entries.map(
    (entry, index) =>
      ({
        component: "entry",
        key: `entry:${data.entryOffset + index}`,
        kind: "component",
        props: { entry, labels: data.labels },
      }) satisfies LayoutNode<AchievementsLayoutSchema>,
  );
  return [
    {
      children: Array.from({ length: columns }, (_, index) => ({
        children: entries.slice(index * data.rows, (index + 1) * data.rows),
        gap: rowGap,
        key: `column:${index}`,
        kind: "stack",
        padding: 0,
      })),
      gap: columnGap,
      key: "columns",
      kind: "columns",
      padding: 0,
      sizing: {
        mode: "tracks",
        tracks: Array.from({ length: columns }, () => ({ kind: "fixed", size: data.columnWidth })),
      },
    },
  ];
}

/** The caller supplies page content and owns the native pager. */
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
      entries: entryColumns(data),
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
