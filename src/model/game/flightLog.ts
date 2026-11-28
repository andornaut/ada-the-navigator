import { ANDROMEDA_REDACT } from "../../data/capitalBosses.ts";
import { ARCHIE_NAMED } from "../../data/conversations.ts";
import { andromedaRelayWaypoint } from "../andromeda/relay.ts";
import { holodisksHeld } from "../conversations.ts";
import { needleCadenceTransmission } from "../needle/runtime.ts";
import type { FlightLogEntry, GameState } from "../types.ts";

/** Read the existing intercepted entries in their display order. */
export function projectFlightLog(
  memoryPending: boolean,
  progress: Readonly<GameState["progress"]>,
): readonly FlightLogEntry[] {
  const needle = progress[4];
  // Older saves have no completion field. The saved holodisk story cursor still gates them.
  const archieRevealed =
    needle.holodisk &&
    holodisksHeld(progress) >= ARCHIE_NAMED.holodisks &&
    (needle.needleMemoryRead ?? !memoryPending);
  const transmission = needleCadenceTransmission(needle.capitalBoss, archieRevealed);
  const relay = andromedaRelayWaypoint(progress[5].redact);
  return [
    ...(transmission ? [transmission] : []),
    ...(relay ? [{ id: relay.id, text: ANDROMEDA_REDACT.relayLabel, waypoint: relay }] : []),
  ];
}
