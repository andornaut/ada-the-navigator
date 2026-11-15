import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { StationLabels } from "./station.ts";

export type StationMenuButton = "jobs" | "shop" | "nextGreeting" | "undock";
export type StationMenuLabels = Pick<StationLabels, "jobs" | "shop" | "nextLine" | "undock">;
export type StationMenuSchema = {
  balance: { props: Record<string, never>; slots: never };
  button: {
    props: {
      readonly actionId?: "open-jobs" | "open-shop" | "undock";
      readonly id: StationMenuButton;
      readonly label: string;
      readonly role: "primary" | "secondary";
    };
    slots: never;
  };
  stationMenu: { props: Record<string, never>; slots: "choices" | "controls" };
};

/** Native dialogue slots only; station services, greeting progress and callbacks stay caller-owned. */
export function stationMenuTree(
  labels: StationMenuLabels,
): Extract<ComponentNode<StationMenuSchema>, { component: "stationMenu" }> {
  return {
    component: "stationMenu",
    key: "station-menu",
    kind: "component",
    props: {},
    slots: {
      choices: [
        { component: "balance", key: "balance", kind: "component", props: {} },
        {
          component: "button",
          key: "jobs",
          kind: "component",
          props: { actionId: "open-jobs", id: "jobs", label: labels.jobs, role: "secondary" },
        },
        {
          component: "button",
          key: "shop",
          kind: "component",
          props: { actionId: "open-shop", id: "shop", label: labels.shop, role: "primary" },
        },
      ],
      controls: [
        {
          component: "button",
          key: "next-greeting",
          kind: "component",
          props: { id: "nextGreeting", label: labels.nextLine, role: "secondary" },
        },
        {
          component: "button",
          key: "undock",
          kind: "component",
          props: { actionId: "undock", id: "undock", label: labels.undock, role: "secondary" },
        },
      ],
    },
  };
}
