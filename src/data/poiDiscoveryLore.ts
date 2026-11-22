import type { Conversation, ConversationLine } from "./conversations.ts";
import deck from "./poiFlavourCopy.json" with { type: "json" };
import type { GalaxyNumber } from "./types.ts";

export type PoiLoreCue =
  | { readonly id?: string; readonly kind: "station" }
  | { readonly group?: string; readonly kind: "cache" }
  | { readonly id: string; readonly kind: "storyPlace"; readonly role?: string }
  | { readonly id: string; readonly kind: "landmark"; readonly symbol: string };

type AuthoredLine = { readonly speaker: string; readonly text: string };
function find<T>(pools: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(pools, key) ? pools[key] : undefined;
}

function pool(galaxy: GalaxyNumber, cue: PoiLoreCue) {
  const copy = deck[galaxy];
  switch (cue.kind) {
    case "cache":
    case "station":
      return { key: cue.kind, lines: copy[cue.kind] };
    case "storyPlace": {
      const key = cue.role ?? cue.id;
      return { key: `storyPlace:${key}`, lines: find(copy.storyPlace, key) };
    }
    default: {
      const named = find(copy.namedLandmark, cue.id);
      return named
        ? { key: `namedLandmark:${cue.id}`, lines: named.variants }
        : {
            key: `generatedLandmark:${cue.symbol}`,
            lines: find(copy.generatedLandmark, cue.symbol),
          };
    }
  }
}

function boundLine(line: AuthoredLine): ConversationLine {
  const { speaker, text } = line;
  if (speaker !== "ada" && speaker !== "astra") {
    throw new Error(`Unknown discovery speaker ${speaker}`);
  }
  return { speaker, text };
}

/** One single-line conversation per authored variant, using the existing lore priority. */
export function poiDiscoveryPool(galaxy: GalaxyNumber, cue: PoiLoreCue): readonly Conversation[] {
  const { key, lines } = pool(galaxy, cue);
  const id = `poi:${galaxy}:${key}`;
  return (
    lines?.map((line, index) => ({
      id: `${id}:${index}`,
      lines: [boundLine(line)],
      pool: id,
      priority: "lore",
      repeat: "always",
      trigger: { kind: cue.kind === "station" ? "stationMapped" : "mapped" },
    })) ?? []
  );
}

export type PoiApproachKind = "unknown" | "landmark" | "job";

const APPROACH_COPY: Readonly<Record<PoiApproachKind, readonly ConversationLine[]>> = {
  job: [
    { speaker: "ada", text: "We're getting closer. Let's see what we can do." },
    { speaker: "ada", text: "I think we're headed the right way. I'll take it slowly." },
  ],
  landmark: [
    { speaker: "astra", text: "We can take a closer look when you're ready." },
    { speaker: "astra", text: "Come a bit closer and I can get a better reading." },
  ],
  unknown: [
    { speaker: "ada", text: "Let's see if there's anything out that way." },
    { speaker: "ada", text: "I can't make it out yet. Can we get a little closer?" },
  ],
};

const AMBIENT_COPY = {
  1: [
    [
      "The growers and the workshop both have their own way of solving things.",
      "I wonder what they'd make if they shared a bench.",
    ],
    "The growers can't fix everything on their own. Maybe there's someone nearby who's better with tools.",
  ],
  2: [
    "It's easy to count the loads from the dock. It's harder to see how long it took the miner to bring them in.",
    "A crew can wait a long time to unload. I wonder where they go when they need a break.",
  ],
  3: [
    "I thought the current was the loudest thing here. Now I keep listening for the family.",
    "Marlo keeps listening between calls. I wonder who's on the other end.",
  ],
  4: [
    "Elder Loom made it sound easy to slow down before the turn. I think I get it now that I've seen the channel.",
    "I wonder what I'll notice if I try going slowly the first time.",
  ],
  5: [
    "One lamp makes a big difference when a courier has to find the next stop.",
    "I wonder what Pip looks for when the next stop isn't in sight yet.",
  ],
  6: [
    "It's a long way between lights. I like knowing there are people at both of them.",
    "I wonder if anyone else is keeping a light on out here.",
  ],
} as const;

export function poiApproachPool(
  galaxy: GalaxyNumber,
  kind: PoiApproachKind,
): readonly Conversation[] {
  const pool = `poi:approach:${kind}`;
  return APPROACH_COPY[kind].map((line, index) => ({
    id: `${pool}:${index}`,
    lines: [line],
    pool,
    priority: "lore",
    repeat: "never",
    trigger: { galaxy, id: pool, kind: "chapter" },
  }));
}

export function poiAmbientLine(galaxy: GalaxyNumber, secondKnown: boolean): Conversation {
  const copy = AMBIENT_COPY[galaxy][secondKnown ? 0 : 1];
  const lines = typeof copy === "string" ? [copy] : copy;
  return {
    id: `poi:ambient:${galaxy}:${secondKnown ? "known" : "possible"}`,
    lines: lines.map((text) => ({ speaker: "ada", text })),
    priority: "lore",
    repeat: "never",
    trigger: { galaxy, kind: "quiet" },
  };
}
