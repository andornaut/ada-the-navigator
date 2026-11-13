import { BUILT } from "../data/galaxies.ts";
import { NEEDLE_PLACES } from "../data/needle.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ANDROMEDA_RUNTIME, andromedaAction, andromedaObjectiveIndex } from "./andromeda.ts";
import type { ChapterRuntime } from "./chapterProtocol.ts";
import {
  chooseNeedle,
  initNeedle,
  needleAction,
  needleActivityChoices,
  needleObjective,
  needleObjectiveIndex,
  stepNeedle,
  useNeedle,
} from "./needleRuntime.ts";
import {
  afterStepPhantom,
  beforeStepPhantom,
  choosePhantom,
  initPhantom,
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
    route: NEEDLE_PLACES,
    use: useNeedle,
  },
  5: {
    ...ANDROMEDA_RUNTIME,
    action: andromedaAction,
    objectiveIndex: ({ progress }) => andromedaObjectiveIndex(progress),
  },
  6: {
    afterStep: afterStepPhantom,
    beforeStep: beforeStepPhantom,
    choose: choosePhantom,
    galaxy: 6,
    init: initPhantom,
    objective: phantomObjective,
    objectiveIndex: phantomObjectiveIndex,
    route: PHANTOM_DESTINATIONS,
    use: usePhantom,
  },
};

export function chapterRuntime(galaxy: GalaxyNumber): ChapterRuntime | undefined {
  return BUILT.has(galaxy) ? RUNTIMES[galaxy] : undefined;
}
