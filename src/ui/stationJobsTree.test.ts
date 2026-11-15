import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import type { StationJob } from "./station.ts";
import { stationJobRowTree, stationJobsTree } from "./stationJobsTree.ts";

const labels = { jobAccept: "Accept", jobActive: "Active", jobDrop: "Drop" };
const job: StationJob = {
  detail: "Detail",
  id: "opaque-job",
  kind: "job",
  reward: 45,
  rewardText: "45 Stardust",
  state: "offer",
  title: "Title",
  type: "delivery",
};
describe("native Jobs configuration", () => {
  it.each(["held", "busy", "offer"] as const)(
    "retains the %s row's native presentation and identity",
    (state) => {
      const tree = stationJobRowTree(labels, { ...job, state });
      validateLayoutTree({ action: [], name: [], row: ["parts"], well: [] }, tree);
      expect(tree.props).toEqual({
        ariaLabel: `Title, Detail, ${state === "held" ? "Active, Drop" : "45 Stardust, Accept"}`,
        id: job.id,
        state: { busy: "unaffordable", held: "inUse", offer: "forSale" }[state],
      });
      expect(tree.slots!.parts!.map((node) => node.key)).toEqual(["well", "name", "action"]);
      expect(tree.slots!.parts![0]).toMatchObject({ props: { glyphType: "delivery" } });
      expect(tree.slots!.parts![2]).toMatchObject({
        props: {
          label: state === "held" ? "Drop" : "Accept",
          mark: state === "held" ? "Active" : "45",
          markClass: state === "held" ? "ada-owned" : "ada-price",
          primary: state !== "held",
        },
      });
    },
  );
  it("retains the canonical activity sheet without deriving live action policy", () => {
    const tree = stationJobRowTree(labels, { ...job, kind: "activity" });
    expect(tree.slots!.parts![0]).toMatchObject({ props: { glyphType: "activity" } });
  });
  it.each([1, 2, 3])("chunks the same measured row indices into %i columns", (columns) => {
    const groups = stationJobsTree({ columns }, 7);
    for (const tree of groups) {
      validateLayoutTree({ group: [] }, tree);
    }
    expect(groups.flatMap((tree) => tree.props.indices)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(groups.every((tree) => tree.props.indices.length <= columns)).toBe(true);
    expect(stationJobsTree({ columns }, 0)).toEqual([]);
  });
});
