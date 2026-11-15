import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { describe, expect, it } from "vitest";

import { weaponDetailTree } from "./weaponDetailTree.ts";

const slots = {
  button: [],
  card: ["header", "body", "footer"],
  text: [],
  weaponDetail: ["footer"],
} as const;

describe("Weapon detail layout configuration", () => {
  it("uses the native content port and a single primary Close with the existing action", () => {
    const data = { closeLabel: "Close", lines: ["Current description"], title: "Laser" };
    const tree = weaponDetailTree(data);
    validateLayoutTree(slots, tree);
    expect(tree).toEqual({
      component: "weaponDetail",
      key: "weapon-detail",
      kind: "component",
      props: data,
      slots: {
        footer: [
          {
            component: "button",
            key: "dismiss",
            kind: "component",
            props: { actionId: "dismiss-weapon-detail", label: "Close", role: "primary" },
          },
        ],
      },
    });
  });

  it("retains reconciliation identity while accepting current caller content without formatting it", () => {
    const before = weaponDetailTree({ closeLabel: "Close", lines: [], title: "Laser" });
    const data = { closeLabel: "Back", lines: ["Ammo: 0", "Unlimited"], title: "Rapid Missile" };
    const next = weaponDetailTree(data);
    validateLayoutTree(slots, next);
    expect(next.key).toBe(before.key);
    expect(next).toMatchObject({
      props: data,
      slots: {
        footer: [
          {
            key: "dismiss",
            props: { actionId: "dismiss-weapon-detail", label: "Back", role: "primary" },
          },
        ],
      },
    });
  });
});
