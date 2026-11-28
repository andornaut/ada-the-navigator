import type { GameContent } from "../../data/types.ts";
import type { FlightState } from "../types.ts";
import { flightWorldContext, worldDelta } from "../world/index.ts";

/**
 * Whether Ada is in battle: an enemy chasing or attacking her is inside the battle square,
 * centred on her and reaching half the game area's width plus the battle margin along each axis.
 * Idle enemies, retaliators not yet hit, fleeing or returning enemies and disabled heavies do not
 * count.
 */
export function inBattle(
  content: GameContent,
  viewportWidth: number,
  flight: Pick<FlightState, "objects" | "player" | "topology">,
): boolean {
  const reach = viewportWidth / 2 + content.tuning.battleMargin;
  return flight.objects.some((object) => {
    const enemy = object.enemy;
    const offset = worldDelta(flightWorldContext(flight), flight.player, object);
    return (
      object.kind === "enemy" &&
      object.hp > 0 &&
      enemy !== undefined &&
      enemy.engaged &&
      !enemy.returning &&
      !enemy.fleeing &&
      !enemy.disabled &&
      Math.abs(offset.x) <= reach &&
      Math.abs(offset.y) <= reach
    );
  });
}
/**
 * Whether Ada is in danger (rules.md): in battle, or with an enemy shot in flight inside the
 * battle square. Danger has no release time.
 */
export function inDanger(
  content: GameContent,
  viewportWidth: number,
  flight: Pick<FlightState, "objects" | "player" | "shots" | "topology">,
): boolean {
  const reach = viewportWidth / 2 + content.tuning.battleMargin;
  return (
    inBattle(content, viewportWidth, flight) ||
    flight.shots.some((shot) => {
      const offset = worldDelta(flightWorldContext(flight), flight.player, shot);
      return shot.enemy && Math.abs(offset.x) <= reach && Math.abs(offset.y) <= reach;
    })
  );
}
