import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { CHARTING_RADIUS, localMap, type MapContext, withinChartingRadius } from "./map.ts";
import { stationsNear } from "./stations/index.ts";

const near = { id: "near", kind: "beacon" as const, label: "near", x: 1000, y: 0 };
const far = { id: "far", kind: "beacon" as const, label: "far", x: 80000, y: 0 };
const stations = stationsNear(ECONOMY, 1, CHARTING_RADIUS, { x: 0, y: 0 }).map(({ id }) => id);
function context(charted: readonly (typeof near)[], allStations: boolean): MapContext {
  return {
    catalog: ECONOMY,
    chunkSize: CONTENT.tuning.chunkSize,
    destinations: [],
    explored: [],
    flight: { facing: { x: 0, y: -1 }, galaxy: 1, objects: [], player: { x: 0, y: 0 } },
    holodisk: null,
    job: null,
    label: (id) => id,
    landmarks: { charted, surveyTotal: [near, far].filter(withinChartingRadius).length, total: 2 },
    objective: null,
    progress: { known: [], stations: allStations ? stations : [] },
    quests: { job: null, story: "", storyComplete: false },
  };
}

describe("landmark survey bounds", () => {
  it("keeps 25k survey completion attainable while far charted landmarks remain visible", () => {
    expect(CHARTING_RADIUS).toBe(25000);
    const centerComplete = localMap(context([near], true));
    expect(centerComplete.mapped).toBe(100);
    const withFar = localMap(context([near, far], true));
    expect(withFar.mapped).toBe(100);
    expect(withFar.places).toContainEqual(
      expect.objectContaining({ id: far.id, x: far.x, y: far.y }),
    );
    expect(localMap(context([far], false)).mapped).toBe(0);
  });
});
