/** The canonical compact name leaves the base level and unowned previews unnumbered. */
export function compactLevelName(level: number | undefined, label: string): string {
  return level !== undefined && level > 1 ? `${label} [${level}]` : label;
}
