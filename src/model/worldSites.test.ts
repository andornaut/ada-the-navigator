import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import {
  oreFieldInCell,
  oreFieldsNear,
  worldOreFieldInCell,
  worldOreFieldsNear,
} from "./oreFields.ts";
import {
  stationInCell,
  stationsNear,
  worldStationById,
  worldStationInCell,
  worldStationIndicatorTarget,
  worldStationsNear,
} from "./stations.ts";
import { wrappedDistance } from "./worldGeometry.ts";

const context = { worldSide: 1152000 };
describe("explicit periodic station and ore placement", () => {
  it("canonicalizes station cell aliases without accepting alias IDs", () => {
    const site = worldStationInCell(context, ECONOMY, 1, { x: -48, y: -48 })!;
    expect(site).not.toBeNull();
    expect(worldStationInCell(context, ECONOMY, 1, { x: 48, y: 48 })).toEqual(site);
    expect(worldStationInCell(context, ECONOMY, 1, { x: -144, y: -144 })).toEqual(site);
    expect(worldStationById(context, ECONOMY, 1, site.id)).toEqual(site);
    expect(worldStationById(context, ECONOMY, 1, "station:48,48")).toBeNull();
    expect(worldStationById(context, ECONOMY, 1, "station:-0,0")).toBeNull();
  });
  it("finds each corner site once through either image and respects discovered IDs", () => {
    const point = { x: 576000, y: 576000 };
    const sites = worldStationsNear(context, ECONOMY, 1, 20000, point);
    expect(sites.length).toBeGreaterThan(0);
    expect(new Set(sites.map((site) => site.id)).size).toBe(sites.length);
    expect(worldStationsNear(context, ECONOMY, 1, 20000, { x: -576000, y: -576000 })).toEqual(
      sites,
    );
    expect(
      worldStationsNear(context, ECONOMY, 1, 20000, {
        x: point.x + context.worldSide,
        y: point.y - context.worldSide,
      }),
    ).toEqual(sites);
    const indicatorPoint = { x: sites[0]!.x + context.worldSide, y: sites[0]!.y };
    const target = worldStationIndicatorTarget(context, ECONOMY, 1, [], indicatorPoint)!;
    expect(target).not.toBeNull();
    expect(
      worldStationIndicatorTarget(context, ECONOMY, 1, [target.id], indicatorPoint)?.id,
    ).not.toBe(target.id);
    for (const first of sites) {
      for (const second of sites) {
        if (first.id !== second.id) {
          expect(wrappedDistance(context.worldSide, first, second)).toBeGreaterThanOrEqual(
            ECONOMY.station.minimumSpacing,
          );
        }
      }
    }
  });
  it("preserves exact unbounded legacy placement and far IDs", () => {
    for (const cell of [
      { x: -48, y: 5 },
      { x: 1300, y: -2048 },
    ]) {
      expect(worldStationInCell({}, ECONOMY, 1, cell)).toEqual(stationInCell(ECONOMY, 1, cell));
      expect(worldOreFieldInCell({}, 2, cell)).toEqual(oreFieldInCell(2, cell));
    }
    const point = { x: 9000000, y: -8000000 };
    expect(worldStationsNear({}, ECONOMY, 1, 25000, point)).toEqual(
      stationsNear(ECONOMY, 1, 25000, point),
    );
    expect(worldOreFieldsNear({}, 2, 25000, point)).toEqual(oreFieldsNear(2, 25000, point));
    expect(worldStationById({}, ECONOMY, 1, "station:1300,-2048")).toEqual(
      stationInCell(ECONOMY, 1, { x: 1300, y: -2048 }),
    );
  });
  it("keeps ore identity and its entire local rock layout across seam aliases", () => {
    const point = { x: -576000, y: -576000 };
    const fields = worldOreFieldsNear(context, 2, 16000, point);
    expect(fields.length).toBeGreaterThan(0);
    expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length);
    expect(
      worldOreFieldsNear(context, 2, 16000, {
        x: point.x + context.worldSide,
        y: point.y - context.worldSide,
      }),
    ).toEqual(fields);
    const field = fields[0]!;
    const [x, y] = field.id.slice(4).split(",").map(Number);
    expect(worldOreFieldInCell(context, 2, { x: x! + 256, y: y! - 256 })).toEqual(field);
    for (const rock of field.rocks) {
      expect(Math.hypot(rock.x - field.x, rock.y - field.y)).toBeLessThanOrEqual(
        ORE_FIELDS.diameter / 2 + 1e-8,
      );
    }
    expect(worldOreFieldsNear(context, 1, 16000, point)).toEqual([]);
  });
});
