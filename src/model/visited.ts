import type { Vec } from "./types.ts";

export const VISITED_PAGE_SIDE = 16;
const PAGE_BYTES = (VISITED_PAGE_SIDE * VISITED_PAGE_SIDE) / 8;

export function chunkCoordinates(key: string): Vec | null {
  const match = /^(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*))$/.exec(key);
  if (!match) {
    return null;
  }
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isSafeInteger(x) && Number.isSafeInteger(y) && `${x},${y}` === key
    ? { x, y }
    : null;
}
function validPage(point: Vec): boolean {
  return (
    Number.isSafeInteger(point.x * VISITED_PAGE_SIDE) &&
    Number.isSafeInteger(point.y * VISITED_PAGE_SIDE) &&
    Number.isSafeInteger((point.x + 1) * VISITED_PAGE_SIDE - 1) &&
    Number.isSafeInteger((point.y + 1) * VISITED_PAGE_SIDE - 1)
  );
}
function address(key: string): { key: string; byte: number; mask: number } {
  const point = chunkCoordinates(key);
  if (!point) {
    throw new Error("Invalid chunk coordinates");
  }
  const x = Math.floor(point.x / VISITED_PAGE_SIDE);
  const y = Math.floor(point.y / VISITED_PAGE_SIDE);
  if (!validPage({ x, y })) {
    throw new RangeError("Visited page coordinates exceed safe integer bounds");
  }
  const bit =
    (point.y - y * VISITED_PAGE_SIDE) * VISITED_PAGE_SIDE + point.x - x * VISITED_PAGE_SIDE;
  return { byte: Math.floor(bit / 8), key: `${x},${y}`, mask: 1 << (bit % 8) };
}
export function visitedChunk(pages: Readonly<Record<string, string>>, key: string): boolean {
  const at = address(key);
  const encoded = pages[at.key];
  return encoded !== undefined && Boolean(atob(encoded).charCodeAt(at.byte) & at.mask);
}
export function markVisited(pages: Record<string, string>, key: string): void {
  const at = address(key);
  const prior = pages[at.key];
  const bytes = prior === undefined ? "\0".repeat(PAGE_BYTES) : atob(prior);
  const value = bytes.charCodeAt(at.byte) | at.mask;
  pages[at.key] = btoa(
    bytes.slice(0, at.byte) + String.fromCharCode(value) + bytes.slice(at.byte + 1),
  );
}
/** Every visited chunk's coordinates, page by page in key order. */
export function visitedChunks(pages: Readonly<Record<string, string>>): Vec[] {
  const chunks: Vec[] = [];
  for (const key of Object.keys(pages).sort()) {
    const page = chunkCoordinates(key);
    const encoded = pages[key];
    if (!page || encoded === undefined) {
      continue;
    }
    const bytes = atob(encoded);
    for (let bit = 0; bit < bytes.length * 8; bit++) {
      if (bytes.charCodeAt(Math.floor(bit / 8)) & (1 << (bit % 8))) {
        chunks.push({
          x: page.x * VISITED_PAGE_SIDE + (bit % VISITED_PAGE_SIDE),
          y: page.y * VISITED_PAGE_SIDE + Math.floor(bit / VISITED_PAGE_SIDE),
        });
      }
    }
  }
  return chunks;
}
export function validVisitedPages(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.entries(value).every(([key, encoded]) => {
    const point = chunkCoordinates(key);
    if (
      !point ||
      !validPage(point) ||
      typeof encoded !== "string" ||
      !/^[A-Za-z0-9+/]{43}=$/.test(encoded)
    ) {
      return false;
    }
    const bytes = atob(encoded);
    return (
      bytes.length === PAGE_BYTES &&
      btoa(bytes) === encoded &&
      [...bytes].some((byte) => byte.charCodeAt(0) !== 0)
    );
  });
}
