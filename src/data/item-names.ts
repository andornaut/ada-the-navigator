// Carried item names (gameplay/player-copy.md "Carried item names"): the display name of every
// carried item, lost item and towed craft, without an article and starting with a capital, for
// the status pill's carried segment, the Ship card and the item notices.

/** Story items by their quest item id. */
export const STORY_ITEM_NAMES: Readonly<Record<string, string>> = {
  food: "Food",
  parts: "Spare parts",
  toolkit: "Tool kit",
};

/** Supply-run, delivery, hunt and towed-craft items by the name the jobs and activities use. */
export const CARRIED_ITEM_NAMES: Readonly<Record<string, string>> = {
  "a current skimmer": "Current skimmer",
  "a drifting lamp buoy": "Drifting lamp buoy",
  "a lost courier": "Lost courier",
  "a message": "Message",
  "a pod": "Pod",
  "a scrap barge": "Scrap barge",
  "a seed pod": "Seed pod",
  "a stuck glider": "Stuck glider",
  "a stuck hauler": "Stuck hauler",
  "a traveler's pod": "Traveler's pod",
  "an ore pod": "Ore pod",
  "beacon parts": "Beacon parts",
  "courier's badge": "Courier's badge",
  "drill bits": "Drill bits",
  "fresh food": "Fresh food",
  "glass beads": "Glass beads",
  helmet: "Helmet",
  lantern: "Lantern",
  "lucky charm": "Lucky charm",
  mail: "Mail",
  "music shell": "Music shell",
  "ore samples": "Ore samples",
  "repaired tools": "Repaired tools",
  seeds: "Seeds",
  "silver bell": "Silver bell",
  "song shells": "Song shells",
  "spare parts": "Spare parts",
  "star maps": "Star maps",
  "thread spools": "Thread spools",
  toolbox: "Toolbox",
  "watering can": "Watering can",
  "weaving shuttle": "Weaving shuttle",
  "whale-call whistle": "Whale-call whistle",
};

/** An item's display name; an unlisted one drops its article and takes a capital. */
export function carriedItemName(item: string): string {
  const listed = CARRIED_ITEM_NAMES[item];
  if (listed !== undefined) {
    return listed;
  }
  const bare = item.replace(/^(?:a|an|the)\s+/iu, "");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}
