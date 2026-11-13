// Speed jet colours by engine level: pale blue at base, orange at level 2, purple at level 3, on
// every paint scheme. Widths, lengths and the halo's alpha ramp are the same at every level.
export const JET_LENGTH = { base: 6, scale: 24, exponent: 2 };
export const JET_LEVELS = [
  { level: 1, halo: "#70ace8", outer: ["#5b93cc", "#b9ecff"], core: ["#8cc4f0", "#ffffff"] },
  { level: 2, halo: "#ff8f1f", outer: ["#ea6a00", "#ffd59a"], core: ["#ffb24d", "#ffffff"] },
  { level: 3, halo: "#a66bff", outer: ["#8652e7", "#e6ccff"], core: ["#b98cff", "#ffffff"] },
] as const;

export function jetLayers({
  halo,
  outer,
  core,
}: {
  halo: string;
  outer: readonly [string, string];
  core: readonly [string, string];
}) {
  return [
    { name: "halo", color: halo, width: 2.4, length: 1.1, alpha: { from: 0.6, to: 1, max: 0.5 } },
    { name: "outer", colors: outer, width: 1.6, length: 1 },
    { name: "core", colors: core, width: 0.8, length: 0.55 },
  ];
}
