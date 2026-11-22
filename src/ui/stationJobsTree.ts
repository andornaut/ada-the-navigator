import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { StationJob, StationLabels } from "./station.ts";

export type StationJobRowSchema = {
  mark: {
    props: {
      readonly className: string;
      readonly text: string;
    };
    slots: never;
  };
  name: { props: { readonly detail: string; readonly title: string }; slots: never };
  row: {
    props: { readonly ariaLabel: string; readonly id: string; readonly state: string };
    slots: "parts";
  };
  well: { props: { readonly glyphType: string }; slots: never };
};

/** Native row presentation only; the caller retains the live job/service/action checks. */
export function stationJobRowTree(
  labels: Pick<StationLabels, "jobActive">,
  job: StationJob,
): Extract<ComponentNode<StationJobRowSchema>, { component: "row" }> {
  const held = job.state === "held";
  return {
    component: "row",
    key: job.id,
    kind: "component",
    props: {
      ariaLabel: [job.title, job.detail, held ? labels.jobActive : job.rewardText].join(", "),
      id: job.id,
      state: { busy: "unaffordable", held: "inUse", offer: "forSale" }[job.state],
    },
    slots: {
      parts: [
        {
          component: "well",
          key: "well",
          kind: "component",
          props: { glyphType: job.kind === "activity" ? "activity" : job.type },
        },
        {
          component: "name",
          key: "name",
          kind: "component",
          props: { detail: job.detail, title: job.title },
        },
        {
          component: "mark",
          key: "mark",
          kind: "component",
          props: {
            className: held ? "ada-owned" : "ada-price",
            text: held ? labels.jobActive : String(job.reward),
          },
        },
      ],
    },
  };
}
