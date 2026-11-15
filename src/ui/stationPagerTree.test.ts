import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { stationPagerTree } from "./stationPagerTree.ts";

describe("shared native Station pager configuration", () => {
  it("arranges Previous/status count/Next without page or availability policy", () => {
    const tree = stationPagerTree({ next: "Next", previous: "Previous" });
    validateLayoutTree({ button: [], count: [], pager: ["controls"] }, tree);
    expect(tree.props).toEqual({});
    expect(tree.slots!.controls).toEqual([
      {
        component: "button",
        key: "previous",
        kind: "component",
        props: { direction: "previous", label: "Previous" },
      },
      { component: "count", key: "count", kind: "component", props: {} },
      {
        component: "button",
        key: "next",
        kind: "component",
        props: { direction: "next", label: "Next" },
      },
    ]);
  });
  it("keeps both controls and the status node when labels are explicitly empty", () => {
    const tree = stationPagerTree({ next: "", previous: "" });
    expect(tree.slots!.controls!.map((node) => node.key)).toEqual(["previous", "count", "next"]);
    expect(tree.slots!.controls![0]).toMatchObject({ props: { label: "" } });
  });
});
