import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { StationLabels } from "./station.ts";

export type StationMenuButton = "talk" | "shop" | "jobs" | "exchange" | "undock";
export type StationMenuLabels = Pick<StationLabels, "jobsProjects" | "shop" | "undock"> & {
  readonly exchange: string;
  readonly talk?: string;
};
export type StationMenuSchema = {
  button: {
    props: {
      readonly actionId: "open-talk" | "open-jobs" | "open-shop" | "open-exchange" | "undock";
      readonly id: StationMenuButton;
      readonly label: string;
      readonly role: "primary" | "secondary";
    };
    slots: never;
  };
  stationMenu: { props: Record<string, never>; slots: "controls" };
};

/** The Station's stable footer buttons travel together between its views. */
export function stationMenuTree(
  labels: StationMenuLabels,
): Extract<ComponentNode<StationMenuSchema>, { component: "stationMenu" }> {
  return {
    component: "stationMenu",
    key: "station-menu",
    kind: "component",
    props: {},
    slots: {
      controls: [
        ...(labels.talk === undefined
          ? []
          : [
              {
                component: "button",
                key: "talk",
                kind: "component",
                props: {
                  actionId: "open-talk",
                  id: "talk",
                  label: labels.talk,
                  role: "secondary",
                },
              } as const,
            ]),
        {
          component: "button",
          key: "shop",
          kind: "component",
          props: { actionId: "open-shop", id: "shop", label: labels.shop, role: "secondary" },
        },
        {
          component: "button",
          key: "jobs",
          kind: "component",
          props: {
            actionId: "open-jobs",
            id: "jobs",
            label: labels.jobsProjects,
            role: "secondary",
          },
        },
        {
          component: "button",
          key: "exchange",
          kind: "component",
          props: {
            actionId: "open-exchange",
            id: "exchange",
            label: labels.exchange,
            role: "secondary",
          },
        },
        {
          component: "button",
          key: "undock",
          kind: "component",
          props: { actionId: "undock", id: "undock", label: labels.undock, role: "primary" },
        },
      ],
    },
  };
}
