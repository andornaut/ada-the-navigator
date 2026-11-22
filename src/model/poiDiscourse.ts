import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { GalaxyProgress } from "./types.ts";

/** Undefined means there is no known anchor. False permits only the authored speculation. */
export function ambientSecondThread(
  galaxy: GalaxyNumber,
  progress: GalaxyProgress,
): boolean | undefined {
  const known = (id: string) => progress.known.includes(id);
  switch (galaxy) {
    case 1:
      return known("growers") ? known("workshop") : undefined;
    case 2:
      return known("hub") || progress.stations.includes("hub") ? known("miner") : undefined;
    case 3:
      // Whirlpool sets introduced when Marlo's first encounter opens.
      return progress.introduced ? known("family") : undefined;
    case 4:
      return progress.needle?.met ? known("needlePractice") : undefined;
    case 5:
      // Finishing Pip's confession advances the chapter to stage 3.
      return progress.stage >= 3 ? known(ANDROMEDA_PLACES.beacon) : undefined;
    case 6: {
      const settlements = PHANTOM_DESTINATIONS.filter(known).length;
      return settlements === 0 ? undefined : settlements > 1;
    }
  }
  return undefined;
}
