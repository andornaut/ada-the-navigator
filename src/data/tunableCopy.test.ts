import { describe, expect, it } from "vitest";

import { fill } from "../model/shop.ts";
import { CONTENT } from "./content.ts";

describe("tunable count copy", () => {
  it("preserves current wording when consumers provide current counts", () => {
    expect(fill(CONTENT.labels.contractObjective!, { have: 7, need: 30 })).toBe(
      "Deposit ore at the hub: 7 of 30.",
    );
    expect(fill(CONTENT.labels.shipLevel!, { max: 3, n: 2 })).toBe("Level 2 of 3");
    expect(fill(CONTENT.labels.shipHolodisks!, { n: 4, total: 6 })).toBe("Holodisks: 4 of 6");
  });

  it("uses the supplied requirement and counts rather than embedded maxima", () => {
    expect(fill(CONTENT.labels.contractObjective!, { have: 12, need: 47 })).toBe(
      "Deposit ore at the hub: 12 of 47.",
    );
    expect(fill(CONTENT.labels.shipLevel!, { max: 9, n: 5 })).toBe("Level 5 of 9");
    expect(fill(CONTENT.labels.shipHolodisks!, { n: 8, total: 11 })).toBe("Holodisks: 8 of 11");
  });
});
