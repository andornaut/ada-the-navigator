import { ECONOMY } from "../data/economy.ts";
import type { FlightState } from "./types.ts";
import type { ShipTuning } from "./upgrades.ts";

type RechargeState = Pick<
  FlightState,
  "cargo" | "shield" | "shieldRechargeCredit" | "shieldOreSpent" | "sinceDamage"
>;
type RechargeTuning = Pick<ShipTuning, "shieldMax" | "shieldRechargeDelay" | "shieldRechargeRate">;

/** Whether recharge can restore shield with carried ore, paid credit or the free floor. */
export function canRechargeShield(ship: RechargeTuning, state: RechargeState): boolean {
  return (
    state.shield > 0 &&
    state.shield < ship.shieldMax &&
    (state.cargo > 0 ||
      (state.shieldRechargeCredit ?? 0) > 0 ||
      state.shield < ship.shieldMax * ECONOMY.shieldRecharge.freeCapacity)
  );
}

/** Restores at the normal rate, buying credit only when needed. Returns whole ore actually paid. */
export function rechargeShield(
  ship: RechargeTuning,
  seconds: number,
  state: RechargeState,
): number {
  if (!canRechargeShield(ship, state) || !Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  const active = Math.min(seconds, Math.max(0, state.sinceDamage - ship.shieldRechargeDelay));
  let restoration = Math.min(ship.shieldMax - state.shield, ship.shieldRechargeRate * active);
  let spent = 0;
  // Capacity-relative float tolerance prevents billing another ore for arithmetic residue.
  const epsilon = ship.shieldMax * 1e-12;
  while (restoration > epsilon) {
    const credit = state.shieldRechargeCredit ?? 0;
    if (credit > 0) {
      const healed = Math.min(restoration, credit * ship.shieldMax);
      state.shield += healed;
      restoration -= healed;
      const left = credit - healed / ship.shieldMax;
      state.shieldRechargeCredit = left > 1e-12 ? left : 0;
    } else if (state.cargo > 0) {
      state.cargo--;
      spent++;
      state.shieldOreSpent = (state.shieldOreSpent ?? 0) + 1;
      state.shieldRechargeCredit = ECONOMY.shieldRecharge.capacityPerOre;
    } else {
      state.shield += Math.min(
        restoration,
        Math.max(0, ship.shieldMax * ECONOMY.shieldRecharge.freeCapacity - state.shield),
      );
      break;
    }
  }
  if (ship.shieldMax - state.shield <= epsilon) {
    state.shield = ship.shieldMax;
  }
  return spent;
}
