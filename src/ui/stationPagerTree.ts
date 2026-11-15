import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

export type StationPagerSchema = {
  button: {
    props: { readonly direction: "previous" | "next"; readonly label: string };
    slots: never;
  };
  count: { props: Record<string, never>; slots: never };
  pager: { props: Record<string, never>; slots: "controls" };
};

/** Both native pagers share arrangement only; measured pages and availability stay caller-owned. */
export function stationPagerTree(labels: {
  readonly next: string;
  readonly previous: string;
}): Extract<ComponentNode<StationPagerSchema>, { component: "pager" }> {
  return {
    component: "pager",
    key: "station-pager",
    kind: "component",
    props: {},
    slots: {
      controls: [
        {
          component: "button",
          key: "previous",
          kind: "component",
          props: { direction: "previous", label: labels.previous },
        },
        { component: "count", key: "count", kind: "component", props: {} },
        {
          component: "button",
          key: "next",
          kind: "component",
          props: { direction: "next", label: labels.next },
        },
      ],
    },
  };
}
