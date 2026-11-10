import type { SectorId } from "./types.ts";

export type ChunkTemplateId = "quiet" | "cluster" | "passage" | "poi";
export type ChunkCatalog = Readonly<
  Record<SectorId, readonly { id: ChunkTemplateId; weight: number }[]>
>;

// Provisional neutral weights for all sectors.
export const CHUNK_CATALOG: ChunkCatalog = {
  1: [
    { id: "quiet", weight: 1 },
    { id: "cluster", weight: 1 },
    { id: "passage", weight: 1 },
    { id: "poi", weight: 1 },
  ],
  2: [
    { id: "quiet", weight: 1 },
    { id: "cluster", weight: 1 },
    { id: "passage", weight: 1 },
    { id: "poi", weight: 1 },
  ],
  3: [
    { id: "quiet", weight: 1 },
    { id: "cluster", weight: 1 },
    { id: "passage", weight: 1 },
    { id: "poi", weight: 1 },
  ],
};
