/** One last admitted scene presentation, without evaluating model knowledge under a UI cover. */
export function createCoveredPaint<T>() {
  let flight: object | null = null;
  let markers: readonly T[] = [];
  return (
    current: object | null,
    covered: boolean,
    eligible: boolean,
    read: () => readonly T[],
  ): readonly T[] => {
    if (!eligible || current !== flight) {
      flight = current;
      markers = [];
    }
    if (current && eligible && !covered) {
      markers = read();
    }
    return markers;
  };
}
