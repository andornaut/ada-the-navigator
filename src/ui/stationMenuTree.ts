import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { StationLabels } from "./station.ts";

export type StationMenuButton = "shop" | "jobs" | "exchange" | "undock";
export type StationMenuLabels = Pick<StationLabels, "jobsProjects" | "shop" | "undock"> & {
  readonly exchange: string;
};
export type StationMenuSchema = {
  button: {
    props: {
      readonly actionId: "open-jobs" | "open-shop" | "open-exchange" | "undock";
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
