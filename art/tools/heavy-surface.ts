import { amber, coral, coralRear, coralSide, ink, plate, visor, visorSide } from "./crafts.ts";

type Armour = readonly [deck: string, flank: string, shadow: string, trim: string];

const armour = {
  core: {
    frigate: ["#809caa", "#58717f", "#405563", "#bdccd0"],
    capital: ["#777f9c", "#555c77", "#394159", "#a8b2c6"],
  },
  cartwheel: {
    frigate: ["#8d9f89", "#627967", "#43594b", "#bdc9b8"],
    capital: ["#788e85", "#536d65", "#38524d", "#acbeb6"],
  },
  andromeda: {
    frigate: ["#9b91af", "#706985", "#514c68", "#c5bbd0"],
    capital: ["#8584aa", "#5c5e83", "#3e4165", "#afafd0"],
  },
  needle: {
    frigate: ["#879eaf", "#607889", "#40586a", "#bbcad6"],
    capital: ["#887b9c", "#605573", "#443952", "#b4a8c2"],
  },
} satisfies Record<string, Record<"frigate" | "capital", Armour>>;

const frigateSurface = /^frigate-(?:\d+|engine-intact-\d+)\.svg$/;
const capitalSurface = /^capital-(?:\d+|(?:engine-left|engine-right|command)-intact-\d+)\.svg$/;

/** Paints the intact armour. Other sprites keep the producer's regular family colours. */
export function heavySurface(
  family: keyof typeof armour,
  file: string,
  svg: string,
): string | undefined {
  const palette = armour[family];
  const material = frigateSurface.test(file)
    ? palette.frigate
    : capitalSurface.test(file)
      ? palette.capital
      : undefined;
  if (!material) return undefined;

  const [deck, flank, shadow, trim] = material;
  const fills: Readonly<Record<string, string>> = {
    [coral]: deck,
    [coralSide]: flank,
    [coralRear]: shadow,
    [plate]: trim,
    [amber]: "#d8ded7",
    [ink]: ink,
    [visor]: visor,
    [visorSide]: visorSide,
  };
  return svg.replace(/fill="(#[0-9a-f]{6})"/g, (_, colour: string) => {
    const fill = fills[colour];
    if (!fill) throw new Error(`${file}: ${colour} has no heavy armour material`);
    return `fill="${fill}"`;
  });
}
