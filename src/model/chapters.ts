import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { ChapterRuntime } from "./chapterProtocol.ts";
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
  return RUNTIMES[galaxy];
}
