import { ECONOMY } from "../data/economy.ts";
import { SHIELD_DETAILS } from "../data/shieldDetails.ts";
import { compactLevelName } from "./compactLevelName.ts";
import { detailCount } from "./detailQuantity.ts";
import type { StatusView } from "./statusPill.ts";

/** Uses the HUD meter's existing current-HP rounding without changing shield state. */
export function shieldDetails(
  label: string,
  view: Pick<StatusView, "capacity" | "level" | "rechargeDelay" | "shield">,
) {
  return {
    quantity: SHIELD_DETAILS.quantity
      .replace("{current}", detailCount(Math.max(0, Math.round(view.shield))))
      .replace("{maximum}", detailCount(view.capacity)),
    text: SHIELD_DETAILS.description
      .replace("{delay}", detailCount(view.rechargeDelay))
      .replace("{freePercent}", detailCount(ECONOMY.shieldRecharge.freeCapacity * 100)),
    title: compactLevelName(view.level, label),
  };
}
