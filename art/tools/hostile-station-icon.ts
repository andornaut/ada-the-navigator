import type { Craft } from "./crafts.ts";
import { svg } from "./enemies.ts";
import { type HeavyCraft, planOffset } from "./heavies.ts";

/** A UI mask from the complete native physical assembly, with no new model geometry. */
export function hostileStationIcon(craft: HeavyCraft): string {
  const parts = [
    ...craft.hull,
    ...craft.hardpoints.flatMap(({ offset, model }) => {
      const [ox, oy] = planOffset(craft.sizeRatio, offset);
      return [...model.intact, ...model.top!.parts].map((part) => ({
        ...part,
        plan: part.plan.map(([x, y]) => [x + ox, y + oy] as const),
      }));
    }),
  ];
  const assembled: Craft = {
    name: "map-hostile-station",
    title: "Hostile station silhouette",
    frame: craft.frame,
    parts,
    mouths: [],
    mouthWidth: 0,
    cuts: [],
  };
  return svg(assembled, 0)
    .replace(`width="${craft.frame}" height="${craft.frame}"`, 'width="24" height="24"')
    .replace(/fill="#[0-9a-f]{6}"/gi, 'fill="#181425"')
    .replace("<svg ", '<svg aria-hidden="true" ');
}
