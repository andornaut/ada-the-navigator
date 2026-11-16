import { expect, it } from "vitest";

import { retainModalUnderlay } from "./modalUnderlay.ts";

it("retains the original semantically closed modal as inert and restores its original ARIA state", () => {
  const attributes = new Map([["aria-hidden", "false"]]);
  const modal = {
    getAttribute: (key: string) => attributes.get(key) ?? null,
    hidden: false,
    removeAttribute: (key: string) => attributes.delete(key),
    setAttribute: (key: string, value: string) => attributes.set(key, value),
  };
  const leave = retainModalUnderlay(modal as unknown as HTMLElement);
  modal.hidden = true;
  expect(attributes.has("data-ada-modal-underlay")).toBe(true);
  expect(attributes.has("inert")).toBe(true);
  expect(attributes.get("aria-hidden")).toBe("true");
  leave();
  leave();
  expect(modal.hidden).toBe(true);
  expect(attributes.has("data-ada-modal-underlay")).toBe(false);
  expect(attributes.has("inert")).toBe(false);
  expect(attributes.get("aria-hidden")).toBe("false");
});
