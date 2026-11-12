// Ore's look, shared by the ore nugget (art/tools/cartwheel-props.ts), the resource rocks'
// crystals (art/tools/asteroids.ts) and the ore HUD icon (art/tools/cargo-icons.ts): a matte
// ember-brown body inside a warm rust rim, which carries its contrast on the dark galaxies.

// "R" rim facing up or left, "r" rim facing down or right, "L" light, "M" body, "S" shade,
// "D" deep. No white and no glint: ore is matte, so it reads apart from twinkling Stardust.
export const ORE_PALETTE: Readonly<Record<string, string>> = {
  R: "eaa070",
  r: "d68a54",
  L: "a86a42",
  M: "7a4a30",
  S: "5c3424",
  D: "40241a",
};

// The crystals' ramp, lit to shadow: the rim tones on the lit faces, the body on the shaded ones.
export const ORE_RAMP = ["R", "r", "L", "M", "S"].map((k) => `#${ORE_PALETTE[k]!.toUpperCase()}`);

// Outline pixels (a clear 4-neighbour) take the rim: "R" where the clear side is up or left, "r"
// where it is down or right. Interior pixels keep their tone.
export function rimmed(rows: readonly string[]): string[] {
  const clear = (x: number, y: number) => (rows[y]?.[x] ?? ".") === ".";
  return rows.map((row, y) =>
    [...row]
      .map((cell, x) => {
        if (cell === ".") return ".";
        if (clear(x - 1, y) || clear(x, y - 1)) return "R";
        if (clear(x + 1, y) || clear(x, y + 1)) return "r";
        return cell;
      })
      .join(""),
  );
}
