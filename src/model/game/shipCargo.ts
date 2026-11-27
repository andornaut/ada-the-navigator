import { SUPPLY_ITEMS } from "../../data/activities.ts";
import { carriedItemName, STORY_ITEM_NAMES } from "../../data/itemNames.ts";
import { heldActivity } from "../activities.ts";
import { heldJob } from "../jobs.ts";
import { type QuestEntry, taskQuestId } from "../questDetails.ts";
import type { Aboard, GameState, ShipItemFact } from "../types.ts";

type CargoState = Readonly<
  Pick<GameState, "flight" | "mode" | "progress" | "selectedGalaxy" | "tasks">
>;

/**
 * What Ada carries in flight: a rescue's towed craft, a delivery's item or a supply run's
 * cargo; null with nothing aboard.
 */
export function aboard(state: CargoState): Aboard | null {
  if (state.mode !== "space" || !state.flight) {
    return null;
  }
  const held = heldJob(state.selectedGalaxy, state);
  if (state.flight.tow && held) {
    return { kind: "towing", name: carriedItemName(held.item) };
  }
  if (held?.carrying) {
    return { kind: "carrying", name: carriedItemName(held.item) };
  }
  const activity = heldActivity(state.selectedGalaxy, state);
  if (activity?.id === "supplyRun" && activity.carrying) {
    return { kind: "carrying", name: carriedItemName(SUPPLY_ITEMS[activity.place] ?? "") };
  }
  const story = state.progress[state.selectedGalaxy].questItem;
  if (story !== null && STORY_ITEM_NAMES[story] !== undefined) {
    return { kind: "carrying", name: STORY_ITEM_NAMES[story] };
  }
  return null;
}
/** Independent Ship rows do not inherit the HUD's single-item display priority. */
export function shipItemFacts(
  quests: () => readonly Pick<QuestEntry, "id">[],
  state: CargoState,
): { carrying: ShipItemFact[]; towing: ShipItemFact | null } {
  const flight = state.flight;
  const carrying: ShipItemFact[] = [];
  if (state.mode !== "space" || !flight) {
    return { carrying, towing: null };
  }
  const galaxy = flight.galaxy,
    progress = state.progress[galaxy];
  let live: ReadonlySet<string> | undefined;
  const fact = (id: string, name: string, questId: string): ShipItemFact => {
    live ??= new Set(quests().map(({ id }) => id));
    return { id, name, ...(live.has(questId) ? { questId } : {}) };
  };
  const story = progress.questItem;
  if (story !== null && STORY_ITEM_NAMES[story] !== undefined) {
    carrying.push(
      fact(
        `story-item:${galaxy}:${story}`,
        STORY_ITEM_NAMES[story]!,
        `story:${galaxy}:${progress.stage}`,
      ),
    );
  }
  const held = heldJob(galaxy, state);
  if (held?.carrying) {
    const id = taskQuestId(galaxy, held);
    carrying.push(fact(id, carriedItemName(held.item), id));
  }
  const activity = heldActivity(galaxy, state);
  if (activity?.id === "supplyRun" && activity.carrying) {
    const item = SUPPLY_ITEMS[activity.place];
    if (item !== undefined) {
      const id = taskQuestId(galaxy, activity);
      carrying.push(fact(id, carriedItemName(item), id));
    }
  }
  const towing =
    flight.tow && held?.type === "rescue"
      ? fact(taskQuestId(galaxy, held), carriedItemName(held.item), taskQuestId(galaxy, held))
      : null;
  return { carrying, towing };
}
