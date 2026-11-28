import {
  ANDROMEDA_REDACT,
  type CapitalBossHud,
  CARTWHEEL_CLAIM,
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../../data/capitalBosses.ts";
import { encounterBossHud } from "../capitalBossEncounter.ts";
import type { ChapterContext } from "../chapterProtocol.ts";
import { phantomBossHud } from "../phantom/index.ts";

/** Select the chapter's visible boss from the active flight without paging its actor. */
export function projectCapitalBossHud(context: ChapterContext): CapitalBossHud | null {
  const { flight, progress } = context;
  const canSalvage = () => false;
  if (flight.galaxy === 6) {
    return phantomBossHud(context, canSalvage);
  }
  if (flight.galaxy === 2) {
    return progress.claim?.phase === "active"
      ? encounterBossHud(CARTWHEEL_CLAIM, flight, canSalvage)
      : null;
  }
  if (flight.galaxy === 5) {
    return progress.redact?.phase === "active"
      ? encounterBossHud(ANDROMEDA_REDACT, flight, canSalvage)
      : null;
  }
  const sounder = progress.sounder;
  const optional = progress.capitalBoss?.phase === "active";
  const identity =
    optional && flight.galaxy === 1
      ? SUNFLOWER_CAPITAL_BOSS
      : optional && flight.galaxy === 4
        ? NEEDLE_CADENCE
        : flight.galaxy === 3 &&
            (sounder?.phase === "active" ||
              (sounder?.phase === "resolved" && sounder.outcome === "disabled"))
          ? WHIRLPOOL_CAPITAL_BOSS
          : null;
  return identity && encounterBossHud(identity, flight, canSalvage);
}
