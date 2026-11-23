import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";
import { HOSTILE_STATION_SIGNATURE } from "../../src/data/enemySignatures.ts";
import { models } from "./station-model.ts";
import { candidateLayout, type LegacyLayout } from "./station-sidecars.ts";
import { paintedStationHull } from "./hostile-station-surfaces.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

type Entry = {
  id: string;
  path: string;
  archetype?: string;
  top?: string;
  hardpoint?: string;
  directionIndex?: number;
  width: number;
  height: number;
  pivot: { x: number; y: number };
} & Record<string, unknown>;

const variants = [
  {
    key: "phantom",
    manifest: "manifest.json",
    directory: "enemies",
    prefix: "enemy-",
    position: 6,
  },
  {
    key: "andromeda",
    manifest: "andromeda/manifest.json",
    directory: "andromeda/enemies",
    prefix: "enemy-garnet-",
    position: 4,
  },
] as const;

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const round = (x: number) => Math.round(x * 1000) / 1000;

export function exportStationVariants(art: string, output: string): void {
  const legacy = read(art + "enemies/hostileStation-hardpoints.json") as LegacyLayout;
  for (const spec of variants) {
    const dir = `/art/${spec.directory}/`;
    const files = `${output}public${dir}`;
    const evidence = `${output}${spec.key}/`;
    const manifest = read(art + spec.manifest) as {
      assets: Entry[];
      sidecars: Record<string, Record<string, string>>;
    };
    const station = manifest.assets.filter(({ archetype }) => archetype === "hostileStation");
    const directSize = (parts: Entry[]) => {
      const sizes = new Set(parts.flatMap(({ width, height }) => [width, height]));
      if (sizes.size !== 1)
        throw new Error(`Unexpected native station part size in ${spec.manifest}`);
      return [...sizes][0]!;
    };
    const { layout, clearance } = candidateLayout(models[spec.key], legacy, {
      base: directSize(station.filter(({ hardpoint }) => hardpoint !== undefined)),
      top: directSize(station.filter(({ top }) => top !== undefined)),
    });
    const frame = layout.frame;
    if (clearance.columns < 1)
      throw new Error(`Station viewport exceeds checked envelope: ${spec.key}`);
    const hulls = station.filter(
      ({ hardpoint, top }) => hardpoint === undefined && top === undefined,
    );
    if (hulls.length !== ENEMY_HEADINGS) throw new Error(`Incomplete station hull: ${spec.key}`);
    const rows = Array.from({ length: ENEMY_HEADINGS }, (_, heading) => {
      const id = `${spec.prefix}hostileStation-${heading}`;
      const original = hulls.find((row) => row.id === id && row.directionIndex === heading);
      if (!original) throw new Error(`Missing station heading ${id}`);
      const root = paintedStationHull(
        models[spec.key],
        frame,
        heading,
        `${spec.key} hostile station ${heading}`,
      );
      if (
        Math.min(root.bounds.left, root.bounds.top) < 0 ||
        Math.max(root.bounds.right, root.bounds.bottom) > frame
      ) {
        throw new Error(`Paint extends beyond the authored frame: ${id}`);
      }
      return { original, ...root };
    });

    const replacement = new Map<string, Entry>();
    const sheets = new Map<string, string>();
    const perPage = clearance.columns ** 2;
    const wide = clearance.columns * frame;
    for (let start = 0; start < rows.length; start += perPage) {
      const page = rows.slice(start, start + perPage);
      const name = `hostileStation-${spec.key}-sheet-${start / perPage + 1}.svg`;
      const layoutPage = packAtlas(
        { compare: () => 0, widths: [wide], maxSize: wide, extrude: 0 },
        [{ value: name, rectangles: page.map(() => ({ width: frame, height: frame })) }],
      )?.pages[0];
      if (!layoutPage) throw new Error(`Cannot pack ${name}`);
      const roots = page.map(({ original, svg }, index) => {
        const { x, y } = layoutPage.placed[0]!.at[index]!;
        replacement.set(original.id, {
          ...original,
          path: dir + name,
          svgSheet: true,
          width: frame,
          height: frame,
          displayWidth: clearance.intrinsic,
          displayHeight: clearance.intrinsic,
        });
        return `<svg id="${original.id}" x="${x}" y="${y}" ${svg.trimEnd().slice("<svg ".length)}`;
      });
      const height = layoutPage.height;
      sheets.set(
        name,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${height}" viewBox="0 0 ${wide} ${height}">${roots.join("")}</svg>\n`,
      );
    }

    const sidecar = `hostileStation-${spec.key}-hardpoints.json`;
    const tier = HOSTILE_STATION_SIGNATURE.tiers.find(
      ({ position }) => position === spec.position,
    )!.count;
    const audit = {
      family: spec.key,
      position: spec.position,
      activeSlots: tier,
      coordinateBasis: "raw frame px from top left",
      clearance,
      headings: layout.headings.map((head, index) => ({
        ...head,
        rawFrame: frame,
        authoredPaintedBounds: rows[index]!.bounds,
        hullPivot: [frame / 2, frame / 2],
        slots: head.hardpoints.map(({ id, anchor, pivot, collision }, slot) => {
          const weapon =
            id === HOSTILE_STATION_SIGNATURE.special.mount ? "ringBurst" : "rapidMissile";
          const top = weapon === "ringBurst" ? "dome" : "pod";
          return {
            id,
            active: slot < tier,
            weapon,
            anchor,
            pivot,
            collision,
            muzzleTipsByAim: layout.tops[top]!.map(({ muzzles }) =>
              muzzles.map(([x, y]) => [round(x + pivot[0]), round(y + pivot[1])]),
            ),
          };
        }),
      })),
    };
    mkdirSync(files, { recursive: true });
    mkdirSync(evidence, { recursive: true });
    for (const [name, svg] of sheets) writeFileSync(files + name, svg);
    writeFileSync(files + sidecar, JSON.stringify(layout) + "\n");
    writeFileSync(
      evidence + "selection.json",
      JSON.stringify(
        {
          manifest: `public/art/${spec.manifest}`,
          assets: [...replacement.values()],
          sidecars: {
            hostileStation: { ...manifest.sidecars.hostileStation, hardpoints: dir + sidecar },
          },
        },
        null,
        2,
      ) + "\n",
    );
    writeFileSync(evidence + "geometry.json", JSON.stringify(audit) + "\n");
    for (const [heading, { svg }] of rows.entries())
      writeFileSync(evidence + `hull-${heading}.svg`, svg);
  }
}
