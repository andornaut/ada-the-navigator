import { ECONOMY } from "../../data/economy.ts";
import { JOB_TUNING } from "../../data/jobs.ts";
import type { GameContent } from "../../data/types.ts";
import { speedFraction } from "../shipPhysics.ts";
import type { FlightState } from "../types.ts";
import { noLevels, shipTuning } from "../upgrades.ts";

/**
 * Fraction of maxSpeed requested by a movement deflection from 0 (just past the dead zone)
 * to 1 (full reach). No input requests no speed; any input requests at least minSpeedFraction.
 */
export function movementSpeedFraction(
  tuning: Pick<GameContent["tuning"], "minSpeedFraction" | "speedCurveExponent">,
  deflection: number,
): number {
  const m = Math.min(1, Math.max(0, deflection));
  if (!m) {
    return 0;
  }
  return tuning.minSpeedFraction + (1 - tuning.minSpeedFraction) * m ** tuning.speedCurveExponent;
}
/**
 * Current ship speed as a fraction of Ada's maximum speed at her engine level, clamped to
 * [0, 1], for jets. Flights without levels use the base engine.
 */
export function shipSpeedFraction(
  content: GameContent,
  flight: Pick<FlightState, "velocity"> & Partial<Pick<FlightState, "levels">>,
): number {
  const physics = shipTuning(ECONOMY, content, flight.levels ?? noLevels()).physics;
  return speedFraction(physics.maxSpeed, flight.velocity);
}

/**
 * While a tow line is attached, Ada's current handling scaled by the tow multipliers
 * (gameplay/quests.md "Tow handling"): a lower top speed, slower speed changes, wider turns.
 */
export function towing<
  T extends {
    accelerationSeconds: number;
    brakingSeconds: number;
    maxSpeed: number;
    turnSeconds: number;
  },
>(flight: Pick<FlightState, "tow">, physics: T): T {
  if (!flight.tow) {
    return physics;
  }
  const { responseScale, topSpeedScale, turnScale } = JOB_TUNING.tow;
  return {
    ...physics,
    accelerationSeconds: physics.accelerationSeconds * responseScale,
    brakingSeconds: physics.brakingSeconds * responseScale,
    maxSpeed: physics.maxSpeed * topSpeedScale,
    turnSeconds: physics.turnSeconds * turnScale,
  };
}
