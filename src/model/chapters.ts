import { BUILT } from "../data/galaxies.ts";
import { NEEDLE_PLACES } from "../data/needle.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ANDROMEDA_RUNTIME, andromedaAction, andromedaObjectiveIndex } from "./andromeda.ts";
import type { ChapterRuntime } from "./chapterProtocol.ts";
import { LATE_CHAPTER_ROUTES } from "./game/campaignState.ts";
import {
  chooseNeedle,
  initNeedle,
  needleAction,
  needleActivityChoices,
  needleObjective,
  needleObjectiveIndex,
  stepNeedle,
  useNeedle,
} from "./needle/runtime.ts";
import {
  afterStepPhantom,
  beforeStepPhantom,
  choosePhantom,
  initPhantom,
  phantomAction,
  phantomObjective,
  phantomObjectiveIndex,
  usePhantom,
} from "./phantom.ts";

/** Authored chapter modules share the model's home, outcome, save and flight machinery. */
const RUNTIMES: Readonly<Partial<Record<GalaxyNumber, ChapterRuntime>>> = {
  4: {
    action: (context, id) =>
      NEEDLE_PLACES.some((place) => place === id) ? needleAction(context, id) : undefined,
    activityChoices: needleActivityChoices,
    afterStep: stepNeedle,
    beforeStep: initNeedle,
    choose: chooseNeedle,
    galaxy: 4,
    init: initNeedle,
    objective: needleObjective,
    objectiveIndex: needleObjectiveIndex,
    route: LATE_CHAPTER_ROUTES[4],
    use: useNeedle,
  },
  5: {
    ...ANDROMEDA_RUNTIME,
    action: andromedaAction,
    objectiveIndex: ({ progress }) => andromedaObjectiveIndex(progress),
  },
  6: {
    action: phantomAction,
    afterStep: afterStepPhantom,
    beforeStep: beforeStepPhantom,
    choose: choosePhantom,
    galaxy: 6,
    init: initPhantom,
    objective: phantomObjective,
    objectiveIndex: phantomObjectiveIndex,
    route: LATE_CHAPTER_ROUTES[6],
    use: usePhantom,
  },
};

export function chapterRuntime(galaxy: GalaxyNumber): ChapterRuntime | undefined {
  return BUILT.has(galaxy) ? RUNTIMES[galaxy] : undefined;
}
