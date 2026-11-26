import type { CapitalBossHud } from "../data/capitalBosses.ts";
import type { Vec } from "../data/types.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { flightWorldContext } from "./flightTopology.ts";
import type { FlightState, SpaceObject } from "./types.ts";
import { worldDistance } from "./worldContacts.ts";

/** The active flight owns its actor; between flights the progress record owns it. */
export type CapitalBossProgress = {
  readonly firstHardpointLost?: true;
  readonly site: Vec;
} & (
  | { readonly phase: "active" }
  | { readonly actor: SpaceObject; readonly phase: "away" }
  | {
      cacheClaimed?: boolean;
      readonly outcome: "defeated" | "salvaged";
      readonly phase: "resolved";
    }
);

/** Cartwheel holds one canonical ore field until its carrier is resolved. */
export type CartwheelClaimProgress = CapitalBossProgress & {
  readonly fieldId: string;
  readonly fieldSite: Vec;
};

/** Required encounter outcomes are independent of the world's paging and guard records. */
export type RequiredCapitalBossProgress =
  | { readonly phase: "hidden" | "revealed" | "active" }
  | { readonly actors: readonly SpaceObject[]; readonly phase: "away" }
  | { readonly outcome: "defeated" | "disabled"; readonly phase: "resolved" };

type BossIdentity = Pick<CapitalBossHud, "captain" | "id" | "ship">;

/** Look up the one active or paged encounter actor without forcing its region to load. */
export function capitalBossActor(flight: FlightState, id: string): SpaceObject | null | undefined {
  return flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
}

/** Only loaded, engaged combat or Ada's actual resolution action contributes the HUD. */
export function encounterBossHud(
  identity: BossIdentity,
  flight: FlightState,
  canSalvage: (object: SpaceObject) => boolean,
): CapitalBossHud | null {
  const object = flight.objects.find(({ id }) => id === identity.id);
  const enemy = object?.enemy;
  if (!object || !enemy || enemy.hp <= 0 || enemy.salvaged) {
    return null;
  }
  const definition = enemyEquipmentDefinition(flight.galaxy, enemy);
  if (
    enemy.disabled
      ? !canSalvage(object)
      : !enemy.engaged ||
        enemy.returning ||
        enemy.fleeing ||
        worldDistance(flightWorldContext(flight), object, flight.player) > definition.perception
  ) {
    return null;
  }
  return {
    captain: identity.captain,
    disabled: enemy.disabled,
    hull: enemy.hp,
    id: identity.id,
    maxHull: definition.hp,
    ship: identity.ship,
  };
}
