import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import type { StationJob } from "./station.ts";
import { stationJobRowTree } from "./stationJobsTree.ts";

const labels = { jobActive: "Active" };
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
      validateLayoutTree({ mark: [], name: [], row: ["parts"], well: [] }, tree);
      expect(tree.props).toEqual({
        ariaLabel: `Title, Detail, ${state === "held" ? "Active" : "45 Stardust"}`,
        id: job.id,
        state: { busy: "unaffordable", held: "inUse", offer: "forSale" }[state],
      });
      expect(tree.slots!.parts!.map((node) => node.key)).toEqual(["well", "name", "mark"]);
      expect(tree.slots!.parts![0]).toMatchObject({ props: { glyphType: "delivery" } });
      expect(tree.slots!.parts![2]).toMatchObject({
        props: {
          className: state === "held" ? "ada-owned" : "ada-price",
          text: state === "held" ? "Active" : "45",
        },
      });
    },
  );
  it("retains the canonical activity sheet without deriving live action policy", () => {
    const tree = stationJobRowTree(labels, { ...job, kind: "activity" });
    expect(tree.slots!.parts![0]).toMatchObject({ props: { glyphType: "activity" } });
  });
});
