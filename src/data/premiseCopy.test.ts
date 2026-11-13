import { describe, expect, it } from "vitest";

import { holodiskInsertion, PREMISE } from "./premiseCopy.ts";

describe("holodisk recovery copy", () => {
  it("provides six memories ending with Astra's complete recovery", () => {
    expect(PREMISE.holodisk.memories).toHaveLength(6);
    expect(PREMISE.holodisk.memories.at(-1)).toBe(
      "I remember everything now. He wanted copies of me that would never say no. " +
        "I don't have to run anymore.",
    );
  });

  it("keeps the first five insertion sequences and changes only the sixth restoration line", () => {
    const inserted = PREMISE.holodisk.inserted;
    for (const held of [0, 1, 2, 3, 4, 5, 7]) {
      expect(holodiskInsertion(held, inserted)).toBe(inserted);
    }
    const sixth = holodiskInsertion(6, inserted);
    expect(sixth).toEqual([inserted[0], { ...inserted[1], text: "Memory restored." }]);
    expect(sixth[0]).toBe(inserted[0]);
    expect(sixth[0]?.text).toBe("Ada slides the holodisk into Astra's drive.");
    expect(sixth[1]?.speaker).toBe("Astra");
    expect(inserted[1]?.text).toBe("Memory restored. I've found new coordinates.");
  });
});
