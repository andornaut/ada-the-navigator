import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { achievementsTree } from "./achievementsTree.ts";

const labels = {
  close: "Close",
  next: "Next",
  page: "{page}/{pages}",
  previous: "Previous",
  progress: "{have}/{need}",
  title: "Achievements",
};
const entry = {
  condition: "Condition",
  name: "Name",
  progress: { have: 3, need: 10 },
  unlocked: false,
};

describe("production Achievements configuration", () => {
  it("arranges native entries and Previous/count/Next without deriving progress or page size", () => {
    const tree = achievementsTree({
      entries: [entry],
      entryOffset: 6,
      labels,
      nextHidden: true,
      pageText: "2/2",
      pagerHidden: false,
      previousHidden: false,
    });
    validateLayoutTree(
      { achievements: ["entries", "pager"], entry: [], pageCount: [], pagerAction: [] },
      tree,
    );
    expect(tree.props).toEqual({
      card: {
        closeAction: "close-achievements",
        closeLabel: "Close",
        list: true,
        size: "large",
        title: "Achievements",
      },
      pagerHidden: false,
    });
    expect(tree.slots!.entries).toEqual([
      { component: "entry", key: "entry:6", kind: "component", props: { entry, labels } },
    ]);
    const item = tree.slots!.entries![0]!;
    if (item.kind !== "component" || item.component !== "entry") {
      throw new Error("Expected native entry");
    }
    expect(item.props.entry).toBe(entry);
    expect(tree.slots!.pager).toEqual([
      {
        component: "pagerAction",
        key: "previous",
        kind: "component",
        props: { actionId: "achievements-previous", hidden: false, label: "Previous" },
      },
      { component: "pageCount", key: "page-count", kind: "component", props: { text: "2/2" } },
      {
        component: "pagerAction",
        key: "next",
        kind: "component",
        props: { actionId: "achievements-next", hidden: true, label: "Next" },
      },
    ]);
  });
  it("retains pager nodes and labels even for empty/single-page content", () => {
    const tree = achievementsTree({
      entries: [],
      entryOffset: 0,
      labels,
      nextHidden: true,
      pageText: "1/1",
      pagerHidden: true,
      previousHidden: true,
    });
    expect(tree.slots!.entries).toEqual([]);
    expect(tree.props.pagerHidden).toBe(true);
    expect(tree.slots!.pager!.map((node) => node.key)).toEqual(["previous", "page-count", "next"]);
  });
});
