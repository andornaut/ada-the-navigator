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
      columnWidth: 293,
      entries: [entry, { ...entry, name: "Second" }, { ...entry, name: "Third" }],
      entryOffset: 6,
      labels,
      nextHidden: true,
      pageText: "2/2",
      pagerHidden: false,
      previousHidden: false,
      rows: 2,
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
    const group = tree.slots!.entries![0]!;
    if (group.kind !== "columns") {
      throw new Error("Expected structural columns");
    }
    expect(group.gap).toBe(16);
    expect(group.sizing).toEqual({
      mode: "tracks",
      tracks: [
        { kind: "fixed", size: 293 },
        { kind: "fixed", size: 293 },
      ],
    });
    const stacks = group.children.map((column) => {
      if (column.kind !== "stack") {
        throw new Error("Expected a structural column stack");
      }
      expect(column.gap).toBe(8);
      return column.children;
    });
    expect(stacks.map((stack) => stack.map((node) => node.key))).toEqual([
      ["entry:6", "entry:7"],
      ["entry:8"],
    ]);
    const item = stacks[0]![0]!;
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
      columnWidth: 320,
      entries: [],
      entryOffset: 0,
      labels,
      nextHidden: true,
      pageText: "1/1",
      pagerHidden: true,
      previousHidden: true,
      rows: 0,
    });
    expect(tree.slots!.entries).toEqual([]);
    expect(tree.props.pagerHidden).toBe(true);
    expect(tree.slots!.pager!.map((node) => node.key)).toEqual(["previous", "page-count", "next"]);
  });
});
