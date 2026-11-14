/** Approved shield detail copy; numeric values come from current ship and economy tuning. */
export const SHIELD_DETAILS = {
  description:
    "Recharges after {delay} seconds without damage. Ore fuels recharge above {freePercent}%. " +
    "If depleted, Astra jumps you home and you lose half your ore.",
  quantity: "{current} / {maximum} HP",
} as const;
