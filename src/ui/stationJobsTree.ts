import type { ComponentNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { StationJob, StationLabels } from "./station.ts";

export type StationJobsSchema = {
  group: { props: { readonly indices: readonly number[] }; slots: never };
};
export type StationJobRowSchema = {
  action: {
    props: {
      readonly label: string;
      readonly mark: string;
      readonly markClass: string;
      readonly primary: boolean;
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
  labels: Pick<StationLabels, "jobAccept" | "jobActive" | "jobDrop">,
  job: StationJob,
): Extract<ComponentNode<StationJobRowSchema>, { component: "row" }> {
  const held = job.state === "held",
    label = held ? labels.jobDrop : labels.jobAccept;
  return {
    component: "row",
    key: job.id,
    kind: "component",
    props: {
      ariaLabel: [job.title, job.detail, held ? labels.jobActive : job.rewardText, label].join(
        ", ",
      ),
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
          component: "action",
          key: "action",
          kind: "component",
          props: {
            label,
            mark: held ? labels.jobActive : String(job.reward),
            markClass: held ? "ada-owned" : "ada-price",
            primary: !held,
          },
        },
      ],
    },
  };
}

/** Indices select the same already measured/registered nodes, without cloning or new handlers. */
export function stationJobsTree(
  context: { readonly columns: number },
  count: number,
): readonly Extract<ComponentNode<StationJobsSchema>, { component: "group" }>[] {
  const groups: Extract<ComponentNode<StationJobsSchema>, { component: "group" }>[] = [];
  for (let index = 0; index < count; index += context.columns) {
    groups.push({
      component: "group",
      key: `group:${index}`,
      kind: "component",
      props: {
        indices: Array.from(
          { length: Math.min(context.columns, count - index) },
          (_, offset) => index + offset,
        ),
      },
    });
  }
  return groups;
}
