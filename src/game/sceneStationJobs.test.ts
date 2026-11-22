import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { JOB_TYPES } from "../data/jobs.ts";
import STATION_JOB_BRIEFS from "../data/station-job-briefs.json" with { type: "json" };
import type { GalaxyNumber } from "../data/types.ts";
import type { JobRow } from "../model/game.ts";
import { fill } from "../model/shop.ts";
import type { StationJob } from "../ui/station.ts";

const source = ts.createSourceFile(
  "sceneUi.ts",
  readFileSync(new URL("./sceneUi.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
let station: ts.ObjectLiteralExpression | undefined;
const visit = (node: ts.Node): void => {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "createStationView") {
    const options = node.arguments[1];
    if (options && ts.isObjectLiteralExpression(options)) {
      station = options;
    }
  }
  ts.forEachChild(node, visit);
};
visit(source);
const jobs = station?.properties.find(
  (property): property is ts.PropertyAssignment =>
    ts.isPropertyAssignment(property) && property.name.getText(source) === "jobs",
);
if (!jobs) {
  throw new Error("Missing the Station job projection");
}
const code = ts.transpileModule(`(${jobs.initializer.getText(source)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText;
const label = (key: string) => CONTENT.labels[key] ?? "";
function board(rows: readonly JobRow[], galaxy?: GalaxyNumber): readonly StationJob[] {
  const project = runInNewContext(code, {
    STATION_JOB_BRIEFS,
    fill,
    label,
    scene: { model: { jobBoard: () => rows, state: { flight: galaxy ? { galaxy } : null } } },
  }) as () => readonly StationJob[];
  return project();
}

const job: JobRow = {
  detail: "Canonical objective",
  id: "actual-job",
  kind: "job",
  reward: 125,
  state: "held",
  title: "Exact target name",
  type: "survey",
};

it.each([1, 2, 3, 4, 5, 6] as const)(
  "projects all four briefs from actual flight galaxy %i",
  (galaxy) => {
    const rows = JOB_TYPES.map((type): JobRow => ({ ...job, type }));
    for (const [index, actual] of board(rows, galaxy).entries()) {
      const row = rows[index]!;
      expect(actual).toEqual({
        ...row,
        brief: STATION_JOB_BRIEFS[galaxy][JOB_TYPES[index]!],
        rewardText: fill(label("jobReward"), { amount: row.reward }),
      });
    }
  },
);

it("keeps the existing objective and reward without adding a brief to activities", () => {
  const activity = { ...job, kind: "activity", type: "activity" } as const;
  expect(board([activity], 2)).toEqual([
    { ...activity, rewardText: fill(label("jobReward"), { amount: activity.reward }) },
  ]);
  expect(board([job])[0]).not.toHaveProperty("brief");
});
