import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { QuestEntry, QuestObjective } from "../model/questDetails.ts";
import type { questRoute } from "./questsScreen.ts";

export interface QuestEndpointBody {
  readonly endpoint: ReturnType<typeof questRoute>[number];
  readonly entry: QuestEntry;
}
export type QuestsBodyData =
  | {
      readonly mode: "detail";
      readonly text: string;
      readonly description?: string;
      readonly objectives: readonly {
        readonly iconPath: string | null;
        readonly step: QuestObjective;
      }[];
      readonly route?: readonly QuestEndpointBody[];
      readonly reward: { readonly name: string | undefined; readonly text: string | undefined };
    }
  | {
      readonly mode: "list";
      readonly groups: readonly {
        readonly heading: string;
        readonly entries: readonly QuestEntry[];
      }[];
      readonly emptyText?: string;
    };
export type QuestsBodySchema = {
  body: { props: Record<string, never>; slots: "content" };
  heading: { props: { readonly text: string }; slots: never };
  objective: {
    props: { readonly iconPath: string | null; readonly step: QuestObjective };
    slots: never;
  };
  paragraph: { props: { readonly className?: string; readonly text: string }; slots: never };
  quest: { props: { readonly entry: QuestEntry }; slots: never };
  route: { props: { readonly endpoints: readonly QuestEndpointBody[] }; slots: never };
  section: {
    props: {
      readonly className: string;
      readonly name?: string | undefined;
      readonly text?: string | undefined;
    };
    slots: "content";
  };
};

/** Supplied presentation facts only; filtering, state, icon resolution and actions stay in the caller. */
export function questsBodyTree(
  data: QuestsBodyData,
): Extract<ComponentNode<QuestsBodySchema>, { component: "body" }> {
  const content: ComponentNode<QuestsBodySchema>[] = [];
  if (data.mode === "detail") {
    const objective: ComponentNode<QuestsBodySchema>[] = [];
    if (data.description) {
      objective.push({
        component: "paragraph",
        key: "description",
        kind: "component",
        props: { className: "ada-quest-description", text: data.description },
      });
    }
    if (data.route !== undefined) {
      objective.push({
        component: "route",
        key: "route",
        kind: "component",
        props: { endpoints: data.route },
      });
    }
    content.push(
      {
        component: "section",
        key: "objective",
        kind: "component",
        props: { className: "ada-quest-objective", text: data.text },
        slots: { content: objective },
      },
      {
        component: "section",
        key: "objectives",
        kind: "component",
        props: { className: "ada-quest-objectives", name: "Objectives" },
        slots: {
          content: data.objectives.map((props, index) => ({
            component: "objective",
            key: `step:${index}`,
            kind: "component",
            props,
          })),
        },
      },
      {
        component: "section",
        key: "reward",
        kind: "component",
        props: { className: "ada-quest-reward", ...data.reward },
        slots: { content: [] },
      },
    );
  } else {
    for (const [index, group] of data.groups.entries()) {
      content.push({
        component: "heading",
        key: `heading:${index}`,
        kind: "component",
        props: { text: group.heading },
      });
      content.push(
        ...group.entries.map((entry) => ({
          component: "quest" as const,
          key: entry.id,
          kind: "component" as const,
          props: { entry },
        })),
      );
    }
    if (data.emptyText !== undefined) {
      content.push({
        component: "paragraph",
        key: "empty",
        kind: "component",
        props: { text: data.emptyText },
      });
    }
  }
  return {
    component: "body",
    key: "quests-body",
    kind: "component",
    props: {},
    slots: { content },
  };
}
