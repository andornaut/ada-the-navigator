import type { EncounterEntry, EnemyArchetype } from "../data/enemyCatalog.ts";

/**
 * Chooses an encounter's archetype by weight and its group size from that archetype's
 * inclusive range. Rolls are uniform in [0, 1); the count roll is drawn first so the
 * equal-weight shared table keeps its original seeded results.
 */
export function rollEncounter(
  table: readonly EncounterEntry[],
  countRoll: number,
  archetypeRoll: number,
): { archetype: EnemyArchetype; count: number; escorts?: EncounterEntry["escorts"] } {
  const total = table.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let threshold = archetypeRoll * total;
  let chosen = table.at(-1);
  for (const entry of table) {
    const weight = Math.max(0, entry.weight);
    if (threshold < weight) {
      chosen = entry;
      break;
    }
    threshold -= weight;
  }
  const [low, high] = chosen?.groupSize ?? [1, 1];
  const result = {
    archetype: chosen?.archetype ?? "fighter",
    count: low + Math.floor(countRoll * (high - low + 1)),
  };
  return chosen?.escorts ? { ...result, escorts: chosen.escorts } : result;
}
