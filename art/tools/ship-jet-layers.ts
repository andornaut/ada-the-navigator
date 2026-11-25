// Ada's exhaust: a teardrop plume in two flat tones, the outer flame and its core, rooted at
// the centre of each engine mouth. Widths are half widths in ship units and lengths are
// multiples of the jet length; both are the same at every Engine level, on every paint.
export const JET_LENGTH = { base: 6, scale: 24, exponent: 2 };
// The plume outline as [fraction of the layer's length, fraction of its half width].
export const JET_PROFILE = [
  [0, 0.8],
  [0.1, 1],
  [0.22, 1],
  [0.45, 0.72],
  [0.75, 0.3],
  [1, 0],
] as const;
// The outer flame reaches 1.1 jet lengths and the core 0.55.
export const JET_SHAPE = {
  outer: { width: 5.8, length: 1.1 },
  core: { width: 1.6, length: 0.55 },
} as const;
/** A plume's widest half width and longest reach in ship units at jet length `length`. */
export const plumeReach = (length: number) => ({
  halfWidth: JET_SHAPE.outer.width,
  length: length * JET_SHAPE.outer.length,
});
// Reverse plumes: the same layers at this share of the widths, on a jet length in ship units of
// `reach * (base + scale * f)`, so they outreach the forward plumes, which the wings partly hide.
export const RETRO_JET = { width: 0.85, reach: 1, length: { base: 14.85, scale: 23.1 } } as const;
// Colours by Engine level at f = 0 and f = 1: pale blue at base, red at level 2 and
// amber-yellow at level 3.
export const JET_LEVELS = [
  { level: 1, outer: ["#5b93cc", "#b9ecff"], core: ["#8cc4f0", "#ffffff"] },
  { level: 2, outer: ["#a62c22", "#e74b35"], core: ["#f0895d", "#ffcab0"] },
  { level: 3, outer: ["#b77d22", "#e8ba3c"], core: ["#f3d46c", "#fff0a6"] },
] as const;
// The same levels on a light field.
export const LIGHT_FIELD_JET_LEVELS = [
  { level: 1, outer: ["#1767b3", "#1767b3"], core: ["#2585d0", "#64caff"] },
  { level: 2, outer: ["#9e3027", "#9e3027"], core: ["#cf4935", "#ee7960"] },
  { level: 3, outer: ["#91620e", "#91620e"], core: ["#d49b22", "#f2cf62"] },
] as const;

type Pair = readonly [string, string];
const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** The two plume layers in draw order, their widths scaled for reverse exhaust. */
export function jetLayers({ core, outer }: { core: Pair; outer: Pair }, width = 1) {
  return [
    {
      name: "outer",
      colors: outer,
      ...JET_SHAPE.outer,
      width: round(JET_SHAPE.outer.width * width),
    },
    { name: "core", colors: core, ...JET_SHAPE.core, width: round(JET_SHAPE.core.width * width) },
  ];
}
