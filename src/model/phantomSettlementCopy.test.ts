import { describe, expect, it } from "vitest";

import { phantomSettlementCopy } from "./phantomSettlementCopy.ts";

describe("Phantom settlement copy order", () => {
  it("uses the first exchange even when the third destination is visited first", () => {
    expect(phantomSettlementCopy([], "phantomSettlement3")).toBe("phantomSettlement1");
    expect(phantomSettlementCopy(["phantomSettlement3"], "phantomSettlement2")).toBe(
      "phantomSettlement2",
    );
    expect(
      phantomSettlementCopy(["phantomSettlement3", "phantomSettlement2"], "phantomSettlement1"),
    ).toBe("phantomSettlement3");
  });

  it("retains each destination's assigned exchange after later liberations and JSON round trips", () => {
    const freed = JSON.parse(
      JSON.stringify(["phantomSettlement3", "phantomSettlement1", "phantomSettlement2"]),
    ) as string[];
    expect(phantomSettlementCopy(freed, "phantomSettlement3")).toBe("phantomSettlement1");
    expect(phantomSettlementCopy(freed, "phantomSettlement1")).toBe("phantomSettlement2");
    expect(phantomSettlementCopy(freed, "phantomSettlement2")).toBe("phantomSettlement3");
    expect(freed).toEqual(["phantomSettlement3", "phantomSettlement1", "phantomSettlement2"]);
  });

  it("refuses invented destinations and malformed liberation records", () => {
    expect(phantomSettlementCopy([], "invented")).toBeNull();
    expect(phantomSettlementCopy(["invented"], "phantomSettlement1")).toBeNull();
    expect(
      phantomSettlementCopy(["phantomSettlement1", "phantomSettlement1"], "phantomSettlement2"),
    ).toBeNull();
  });
});
