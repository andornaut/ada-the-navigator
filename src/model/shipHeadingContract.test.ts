import { describe, expect, it } from "vitest";

import {
  readShipHeadingContract,
  SHIP_HEADING_CONTRACT,
  SHIP_HEADING_VERSION,
  SHIP_HEADINGS,
} from "./shipHeadingContract.ts";

describe("player heading contract", () => {
  it("identifies the complete 64-heading player package independently of geometry encoding", () => {
    expect(SHIP_HEADINGS).toBe(64);
    expect(SHIP_HEADING_VERSION).toBe(2);
    expect(readShipHeadingContract({ count: 64, version: 2 })).toBe(SHIP_HEADING_CONTRACT);
  });

  it("rejects missing, legacy, malformed and incompatible descriptors", () => {
    for (const value of [
      undefined,
      null,
      [],
      {},
      { count: 32, version: 1 },
      { count: 32, version: 2 },
      { count: 64, version: 1 },
      { count: "64", version: 2 },
      { count: 64, version: "2" },
    ]) {
      expect(readShipHeadingContract(value)).toBeUndefined();
    }
  });
});
