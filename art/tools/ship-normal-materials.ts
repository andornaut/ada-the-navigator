import { readFileSync } from "node:fs";

import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { filled, over, rgba } from "./paint.ts";
import { SPACE_BG } from "./palette.ts";
import { jetLayers } from "./ship-jet-layers.ts";

/** Preserve the canonical homepage outer shade as an opaque normal-only material. */
export function normalJetLayers(
  engine: Parameters<typeof jetLayers>[0] & { readonly level: number },
) {
  const title = JSON.parse(
    readFileSync(new URL("../../public/art/title-screen.json", import.meta.url), "utf8"),
  ) as { ship: { jetSpeed: number } };
  return jetLayers(engine).map((layer) => {
    if (!layer.color || !layer.alpha) return layer;
    const alpha =
      Math.min(
        1,
        Math.max(0, (title.ship.jetSpeed - layer.alpha.from) / (layer.alpha.to - layer.alpha.from)),
      ) * layer.alpha.max;
    const shade = filled(rgba(SPACE_BG), 1, 1);
    over(shade, filled(rgba(layer.color, Math.round(alpha * 255)), 1, 1));
    let normalColor =
      "#" +
      [...shade.data.slice(0, 3)].map((channel) => channel.toString(16).padStart(2, "0")).join("");
    if (engine.level === 1) {
      const [L, a, b] = toOklab(rgb(normalColor));
      normalColor = hex(fromOklab(L * 0.55, a * 0.9, b * 0.9));
    }
    return { ...layer, normalColor };
  });
}
