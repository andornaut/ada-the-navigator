// Keys for the scene's object sprites. An extra sprite (a flash, a beacon, a composed craft's
// part, the hub's bay overlay, buoys and story craft) keeps its owner's id before a `#`, which
// object ids never contain, so it lives exactly as long as its owner's flight object.

/** The holodisk's beacon sprite: the holodisk's id plus this suffix. */
export const BEACON_SUFFIX = "#beacon";
/** A destruction flash: the destroyed object's id plus this suffix. */
export const FLASH_SUFFIX = "#flash";

/** The flight object an object sprite belongs to. */
export function spriteOwner(id: string): string {
  const mark = id.indexOf("#");
  return mark < 0 ? id : id.slice(0, mark);
}

/** An extra sprite drawn for an owner object, such as `hub#bay` or `hub#story:miner`. */
export function partKey(owner: string, part: string): string {
  return `${owner}#${part}`;
}

/** The sprite keys whose owner is no longer a flight object, which the update destroys. */
export function staleSpriteKeys(activeIds: ReadonlySet<string>, keys: Iterable<string>): string[] {
  return [...keys].filter((id) => !activeIds.has(spriteOwner(id)));
}

/** The hub's second docking bay overlay. */
export function hubBayKey(hub: string): string {
  return partKey(hub, "bay");
}

/** One of the hub's mooring buoy groups. */
export function hubBuoyKey(hub: string, group: string): string {
  return partKey(hub, `buoy:${group}`);
}

/** A story craft around the hub. */
export function hubStoryKey(hub: string, ship: string): string {
  return partKey(hub, `story:${ship}`);
}
