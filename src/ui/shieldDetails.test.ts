import { expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { shieldDetails } from "./shieldDetails.ts";

it.each([
  [1, "Shield"],
  [2, "Shield [2]"],
  [3, "Shield [3]"],
] as const)(
  "shows current level %s and uses existing meter rounding with actual capacity",
  (level, title) => {
    const view = { capacity: 15, level, rechargeDelay: 17, shield: 7.6 };
    const before = { ...view };
    expect(shieldDetails("Shield", view)).toEqual({
      quantity: "8 / 15 HP",
      text:
        "Recharges after 17 seconds without damage. " +
        `Ore fuels recharge above ${ECONOMY.shieldRecharge.freeCapacity * 100}%. ` +
        "If depleted, Astra jumps you home and you lose half your ore.",
      title,
    });
    expect(view).toEqual(before);
  },
);
