export interface MapFrameClock {
  cancelAnimationFrame(id: number): void;
  requestAnimationFrame(callback: () => void): number;
}

/** Coalesce drawing only. Callers apply every input to their current view before scheduling. */
export function createMapRenderQueue(clock: MapFrameClock, render: () => void) {
  let frame: number | null = null;
  let generation = 0;
  let disposed = false;

  const cancel = () => {
    generation++;
    if (frame !== null) {
      clock.cancelAnimationFrame(frame);
      frame = null;
    }
  };

  return {
    cancel,
    dispose(): void {
      disposed = true;
      cancel();
    },
    schedule(): void {
      if (disposed || frame !== null) {
        return;
      }
      const scheduled = generation;
      frame = clock.requestAnimationFrame(() => {
        if (disposed || scheduled !== generation) {
          return;
        }
        frame = null;
        render();
      });
    },
  };
}

/** Current external presentation inputs, including computed theme, layout, DPR and font status. */
export function mapPresentationContext(element: HTMLElement) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    bounds: { height: rect.height, width: rect.width, x: rect.x, y: rect.y },
    dpr: devicePixelRatio,
    fonts: document.fonts.status,
    style: Array.from(style, (name) => [name, style.getPropertyValue(name)]),
  };
}

/** Keep only the last captured presentation content, so mutation and new identity both work. */
export function createMapPresentationRevision() {
  let previous: string | null = null;
  return {
    changed(context: unknown, state: unknown): boolean {
      const next = JSON.stringify([context, state]);
      const changed = previous !== next;
      previous = next;
      return changed;
    },
    clear(): void {
      previous = null;
    },
  };
}
