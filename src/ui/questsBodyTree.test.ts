import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import type { QuestEntry } from "../model/questDetails.ts";
import { type QuestsBodyData, questsBodyTree } from "./questsBodyTree.ts";

const entry: QuestEntry = {
  galaxy: 1,
  id: "opaque",
  line: { kind: "story", target: null, text: "Known action" },
  locations: [],
};
const schema = {
  body: ["content"],
  heading: [],
  log: ["entries"],
  logEntry: [],
  objective: [],
  paragraph: [],
  quest: [],
  route: [],
  section: ["content"],
} as const;
describe("Quest body configuration", () => {
  it("keeps the log's stable IDs and canonical text without rendering attribution metadata", () => {
    const entries = [{ id: "transmission", speaker: "hidden", text: "Orders from fleet command." }];
    const tree = questsBodyTree({ entries, mode: "flightLog" });
    validateLayoutTree(schema, tree);
    expect(tree.slots!.content).toEqual([
      {
        component: "log",
        key: "flight-log",
        kind: "component",
        props: {},
        slots: {
          entries: [
            {
              component: "logEntry",
              key: "transmission",
              kind: "component",
              props: { id: "transmission", text: "Orders from fleet command." },
            },
          ],
        },
      },
    ]);
  });
  it("keeps supplied group order and canonical quest identity without sorting or selecting", () => {
    const job = { ...entry, id: "job", line: { ...entry.line, kind: "job" as const } };
    const tree = questsBodyTree({
      groups: [
        { entries: [entry], heading: "Story" },
        { entries: [job], heading: "Jobs" },
      ],
      mode: "list",
    });
    validateLayoutTree(schema, tree);
    expect(
      tree.slots!.content!.map((node) => [
        node.kind === "component" ? node.component : node.kind,
        node.key,
      ]),
    ).toEqual([
      ["heading", "heading:0"],
      ["quest", "opaque"],
      ["heading", "heading:1"],
      ["quest", "job"],
    ]);
    expect(tree.slots!.content![1]).toMatchObject({ props: { entry } });
  });
  it("renders only the caller-supplied empty text", () => {
    const tree = questsBodyTree({ emptyText: "Nothing active", groups: [], mode: "list" });
    expect(tree.slots!.content).toEqual([
      {
        component: "paragraph",
        key: "empty",
        kind: "component",
        props: { text: "Nothing active" },
      },
    ]);
    expect(questsBodyTree({ groups: [], mode: "list" }).slots!.content).toEqual([]);
  });
  it("retains objective completion, quantities and resolved icons in the original section order", () => {
    const objectives = [
      { iconPath: "/known.png", step: { checked: true, count: "2 / 2", label: "Delivered" } },
      { iconPath: null, step: { checked: false, label: "Return" } },
    ];
    const route = [{ endpoint: { kind: "target" as const, location: null, place: null }, entry }];
    const data: QuestsBodyData = {
      description: "Context",
      mode: "detail",
      objectives,
      reward: { name: "Reward", text: "Known reward" },
      route,
      text: "Current objective",
    };
    const tree = questsBodyTree(data);
    validateLayoutTree(schema, tree);
    expect(tree.slots!.content!.map((node) => node.key)).toEqual([
      "objective",
      "objectives",
      "reward",
    ]);
    expect(tree.slots!.content![0]).toMatchObject({
      props: { text: "Current objective" },
      slots: {
        content: [
          {
            component: "paragraph",
            props: { className: "ada-quest-description", text: "Context" },
          },
          { component: "route", props: { endpoints: route } },
        ],
      },
    });
    expect(tree.slots!.content![1]).toMatchObject({
      props: { name: "Objectives" },
      slots: { content: objectives.map((props) => ({ component: "objective", props })) },
    });
    expect(tree.slots!.content![2]).toMatchObject({
      props: { className: "ada-quest-reward", name: "Reward", text: "Known reward" },
    });
    expect(data.objectives).toBe(objectives);
  });
  it("does not invent description, route endpoints, future steps or rewards", () => {
    const tree = questsBodyTree({
      mode: "detail",
      objectives: [],
      reward: { name: undefined, text: undefined },
      text: "Known",
    });
    expect(tree.slots!.content![0]).toMatchObject({ slots: { content: [] } });
    expect(tree.slots!.content![1]).toMatchObject({ slots: { content: [] } });
    expect(tree.slots!.content![2]).toMatchObject({ props: { name: undefined, text: undefined } });
  });
});
