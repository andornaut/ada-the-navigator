import type { EncounterCue } from "../../data/conversations.ts";
import { ECONOMY } from "../../data/economy.ts";
import { SCREEN } from "../../data/screen.ts";
import { onScreen } from "../conversations.ts";
import { lateEncounterCue } from "../lateEncounter.ts";
import { HUB_STATION } from "../stations/index.ts";
import type { FlightState, SpaceObject } from "../types.ts";

/** Stations, the hub among them, within station discovery range of Ada. */
export function stationsInRange(f: FlightState): SpaceObject[] {
  return f.objects.filter(
    (object) =>
      (object.kind === "station" ||
        (object.kind === "destination" && f.galaxy === 2 && object.id === HUB_STATION)) &&
      Math.hypot(object.x - f.player.x, object.y - f.player.y) <= ECONOMY.station.discoveryRadius,
  );
}
/**
 * First-meeting cues (gameplay/player-copy.md "In-flight conversations"): Cartwheel's hub
 * within station discovery range, Whirlpool's whale family on screen, and one of Whirlpool's
 * Voron stations within station discovery range.
 */
export function encounterCues(f: FlightState): EncounterCue[] {
  const near = stationsInRange(f);
  const cues: EncounterCue[] = [];
  if (f.galaxy === 2 && near.some(({ id }) => id === HUB_STATION)) {
    cues.push("hubNear");
  }
  if (f.galaxy === 3) {
    const family = f.objects.find((o) => o.kind === "destination" && o.id === "family");
    if (family && onScreen(SCREEN, f.player, family)) {
      cues.push("familyInSight");
    }
    if (near.some(({ kind }) => kind === "station")) {
      cues.push("stationNear");
    }
  }
  const late = lateEncounterCue({ catalog: ECONOMY, viewport: SCREEN }, f);
  if (late) {
    cues.push(late);
  }
  return cues;
}
