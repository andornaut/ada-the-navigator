import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { rgba } from "./paint.ts";
import { paintRegions } from "./ship-paths.ts";
import type { Fragment } from "./ship-surface.ts";

/** Raster and SVG exports share the same opaque material regions and closed contours. */
export function paintShip(target: RgbaImage, fragments: readonly Fragment[]): void {
  for (const { color, loops } of paintRegions(fragments)) {
    const ink = rgba(color),
      ys = loops.flatMap((loop) => loop.map((p) => p[1]));
    if (!ys.length) continue;
    for (
      let y = Math.max(0, Math.floor(Math.min(...ys)));
      y <= Math.min(target.height - 1, Math.ceil(Math.max(...ys)));
      y++
    ) {
      const cuts: { x: number; step: number }[] = [];
      for (const loop of loops)
        for (let i = 0; i < loop.length; i++) {
          const a = loop[i]!,
            b = loop[(i + 1) % loop.length]!;
          if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5))
            cuts.push({
              x: a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]),
              step: b[1] > a[1] ? 1 : -1,
            });
        }
      cuts.sort((a, b) => a.x - b.x);
      let winding = 0,
        last = 0;
      for (const cut of cuts) {
        if (winding)
          for (
            let x = Math.max(0, Math.ceil(last - 0.5));
            x < Math.min(target.width, Math.ceil(cut.x - 0.5));
            x++
          )
            target.data.set(ink, (y * target.width + x) * 4);
        winding += cut.step;
        last = cut.x;
      }
    }
  }
}
