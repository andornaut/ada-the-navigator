import { describe, expect, it } from "vitest";

import capitalFile from "../../public/art/enemies/capital-hardpoints.json";
import frigateFile from "../../public/art/enemies/frigate-hardpoints.json";
import gadgetFile from "../../public/art/enemies/gadget-hardpoints.json";
import exported from "../../tools/enemy-hardpoints.json";
import { enemyCatalog, type EnemyDefinition } from "./enemy-catalog.ts";
import { exportHardpoints } from "./enemy-hardpoints.ts";

interface ArtFile {
  fill: string[];
  frame: number;
  hardpoints: { id: string; role: string }[];
  tiers: { mounts: Record<string, { weapon: string } | null>; positions: number[] }[];
}
const art: Record<"capital" | "frigate", ArtFile> = {
  capital: capitalFile as ArtFile,
  frigate: frigateFile as ArtFile,
};

describe("hardpoint export for Art", () => {
  it("matches the catalog's frigate and capital layouts and Art's retaliator mount", () => {
    // Regenerate tools/enemy-hardpoints.json from exportHardpoints() after a layout change.
    expect(exported).toEqual(exportHardpoints());
  });

  it("gives the retaliator's aimed gun a turret mount the model does not track", () => {
    expect(exportHardpoints().archetypes.retaliator).toEqual({
      hardpoints: [{ fire: "bolt", id: "turret", offset: [0, 0], order: 0, role: "turret" }],
      sizeRatio: enemyCatalog.retaliator.sizeRatio,
    });
    expect(enemyCatalog.retaliator.hardpoints).toEqual([]);
  });

  it("lists the catalog's hardpoints, then its other weapon mounts in fill order", () => {
    const ids = (archetype: string) =>
      exportHardpoints().archetypes[archetype]!.hardpoints.map((part) => `${part.id}:${part.role}`);
    expect(ids("capital")).toEqual([
      "command:command",
      "engine-left:engine",
      "engine-right:engine",
      "weapon-left:turret",
      "weapon-right:turret",
      "weapon-rear-left:turret",
      "weapon-rear-right:turret",
      "claw-left:turret",
      "claw-right:turret",
      "stern-left:turret",
      "stern-right:turret",
    ]);
    expect(ids("frigate")).toEqual([
      "engine:engine",
      "port:turret",
      "starboard:turret",
      "spine:turret",
      "bow:turret",
    ]);
  });

  it.each(["frigate", "capital"] as const)(
    "lists every %s hardpoint with Art's id and role, and every mount at Art's offset",
    (archetype) => {
      const file = art[archetype];
      const listed = exportHardpoints().archetypes[archetype]!.hardpoints;
      expect(listed.map((part) => part.id).sort()).toEqual(
        file.hardpoints.map((part) => part.id).sort(),
      );
      for (const part of listed) {
        expect(part.role).toBe(file.hardpoints.find(({ id }) => id === part.id)!.role);
      }
      const definition: EnemyDefinition = enemyCatalog[archetype];
      for (const id of file.fill) {
        const offset = definition.mounts!.offsets[id]!;
        expect(listed.find((part) => part.id === id)!.offset, id).toEqual([offset.x, offset.y]);
      }
    },
  );

  it.each(["frigate", "capital"] as const)(
    "arms each %s mount with Art's weapon at every tier, null where Art caps it",
    (archetype) => {
      const file = art[archetype];
      const mounts = (enemyCatalog[archetype] as EnemyDefinition).mounts!;
      expect(mounts.fill).toEqual(file.fill);
      expect(mounts.tiers.map((tier) => tier.positions)).toEqual(
        file.tiers.map((tier) => tier.positions),
      );
      file.tiers.forEach((tier, index) => {
        const catalog = mounts.tiers[index]!.mounts;
        for (const id of file.fill) {
          expect(catalog[id]?.weapon ?? null, `${id} ${tier.positions.join("-")}`).toBe(
            tier.mounts[id]?.weapon ?? null,
          );
        }
      });
    },
  );

  it("gives Gadget's capital the capital's mounts and tiers", () => {
    const gadget = gadgetFile as ArtFile;
    expect(gadget.fill).toEqual(art.capital.fill);
    expect(gadget.tiers).toEqual(art.capital.tiers);
  });
});
