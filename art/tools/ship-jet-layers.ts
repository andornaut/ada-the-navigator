// Speed jet colours by engine level: pale blue at base, red at level 2, amber-yellow at level 3, on
// every paint scheme. Widths, lengths and the halo's alpha ramp are the same at every level.
export const JET_LENGTH = { base: 6, scale: 24, exponent: 2 };
export const JET_LEVELS = [
  { level: 1, halo: "#70ace8", outer: ["#5b93cc", "#b9ecff"], core: ["#8cc4f0", "#ffffff"] },
  { level: 2, halo: "#e34a3c", outer: ["#a62c22", "#e74b35"], core: ["#f0895d", "#ffcab0"] },
  { level: 3, halo: "#e3b13f", outer: ["#b77d22", "#e8ba3c"], core: ["#f3d46c", "#fff0a6"] },
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
