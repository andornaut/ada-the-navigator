import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { stationDropTree } from "./stationDropDetails.ts";

const data = {
  cancelLabel: CONTENT.labels.jobDropCancel!,
  closeLabel: CONTENT.labels.close!,
  dropLabel: CONTENT.labels.jobDrop!,
  subject: "Survey",
  title: CONTENT.labels.jobDropTitle!,
};
describe("the production station detail tree", () => {
  it("retains authored drop/cancel semantics and keys across content updates", () => {
    const before = stationDropTree(data),
      after = stationDropTree({ ...data, subject: "Delivery" });
    expect(before.kind).toBe("component");
    if (before.kind !== "component" || after.kind !== "component") {
      throw Error("Expected component");
    }
    expect(before.key).toBe(after.key);
    expect(before.component).toBe("card");
    if (before.component !== "card" || after.component !== "card") {
      throw Error("Expected card");
    }
    expect(before.props).toMatchObject({
      closeAction: "drop-cancel",
      footerAction: "back",
      size: "small",
    });
    expect(before.slots?.footer).toEqual(after.slots?.footer);
    expect(before.slots?.body?.[0]?.key).toBe(after.slots?.body?.[0]?.key);
    expect(after.slots?.body?.[0]).toMatchObject({ props: { text: "Delivery" } });
  });
  it("validates against the published ports without a parallel schema or renderer", () => {
    expect(() =>
      validateLayoutTree(
        { button: [], card: ["header", "body", "footer"], text: [] },
        stationDropTree(data),
      ),
    ).not.toThrow();
  });
});
