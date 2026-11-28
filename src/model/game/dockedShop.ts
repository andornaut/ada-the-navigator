import { ECONOMY } from "../../data/economy.ts";
import type { RoutePosition } from "../../data/galaxies.ts";
import { HOLODISKS } from "../../data/holodisks.ts";
import {
  type ShopItem,
  type ShopRow,
  stationShopRows,
  stationStock,
  stationStocks,
} from "../shop.ts";
import {
  type StationServices,
  stationShopCategories,
  type StationStockCategory,
} from "../stations/commerce/index.ts";
import { HUB_STATION } from "../stations/index.ts";
import type { EconomyState, GameState } from "../types.ts";

type DockedShopState = Readonly<
  Pick<GameState, "docked" | "flight" | "progress" | "stationRestock">
>;

/** Resolve the station's context, eligible stock, and existing visit without mutating the economy. */
export function dockedShopSupply(
  services: StationServices | null,
  position: RoutePosition,
  docked: DockedShopState,
) {
  const { docked: id, flight } = docked;
  const galaxy = flight?.galaxy;
  const categories = services && id ? stationShopCategories(services, id) : undefined;
  if (!id || !galaxy || !categories) {
    return undefined;
  }
  const holodisk = holodiskRow(docked);
  const eligible = stationStock(ECONOMY, position, id);
  const stock = {
    ammo: categories.includes("ammo") ? eligible.ammo : [],
    equipment: categories.includes("equipment")
      ? holodisk
        ? eligible.equipment.slice(0, 3)
        : eligible.equipment
      : [],
    weapons: categories.includes("weapons") ? eligible.weapons : [],
  };
  const station = { galaxy, stationId: id };
  const state = docked.stationRestock;
  const visit = state && { ...station, state, stock };
  return { categories, holodisk, station, stock, visit };
}

type DockedShopSupply = NonNullable<ReturnType<typeof dockedShopSupply>>;

export function dockedShopOffers(supply: DockedShopSupply, item: ShopItem): boolean {
  return item.kind === "holodisk"
    ? supply.holodisk !== null
    : stationStocks(supply.stock, item, supply.visit);
}

export function dockedShopGroups(economy: EconomyState, supply: DockedShopSupply) {
  const { categories, holodisk, stock, visit } = supply;
  const group = (category: StationStockCategory) => {
    const rows = stationShopRows(ECONOMY, economy, stock, category, visit);
    if (category === "equipment" && holodisk) {
      rows.unshift(holodisk);
    }
    return { category, rows };
  };
  return [group(categories[0]), group(categories[1])] as const;
}

/**
 * The hub's holodisk row, first in Equipment once Cartwheel's space quest is complete:
 * Owned once bought (gameplay/economy.md). Null at any other station or before then.
 */
function holodiskRow(state: DockedShopState): ShopRow | null {
  const galaxy = state.flight?.galaxy;
  if (state.docked !== HUB_STATION || galaxy !== 2) {
    return null;
  }
  const progress = state.progress[galaxy];
  if (!progress.questComplete) {
    return null;
  }
  return {
    inUse: false,
    item: { kind: "holodisk" },
    level: null,
    owned: progress.holodisk,
    price: progress.holodisk ? null : HOLODISKS.hubPrice,
  };
}
