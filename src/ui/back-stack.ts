// What back does in the game, as in Chibi: it closes the innermost open card or defers the update
// offer; during flight with nothing open it pauses (opens Settings), and with Settings open it
// resumes by closing it. Cards join the stack as they are created, innermost last, and leave it
// with the function register returns.
export interface BackLayer {
  back(): void;
  isOpen(): boolean;
}

export interface BackStack {
  // Closes the innermost open layer, if any, and says whether one was.
  back(): boolean;
  register(layer: BackLayer): () => void;
}

export function createBackStack(): BackStack {
  const layers: BackLayer[] = [];
  return {
    back() {
      for (let index = layers.length - 1; index >= 0; index--) {
        const layer = layers[index]!;
        if (layer.isOpen()) {
          layer.back();
          return true;
        }
      }
      return false;
    },
    register(layer) {
      layers.push(layer);
      return () => {
        const index = layers.indexOf(layer);
        if (index >= 0) {
          layers.splice(index, 1);
        }
      };
    },
  };
}

export type BackOutcome = "closed" | "none" | "paused";

// One back press: the innermost open layer closes, or flight pauses, or nothing happens.
export function pressBack(stack: BackStack, inFlight: boolean, pause: () => void): BackOutcome {
  if (stack.back()) {
    return "closed";
  }
  if (inFlight) {
    pause();
    return "paused";
  }
  return "none";
}

// Back is the browser's own on the start screen while no card or offer covers it.
export function backReleased(startScreen: boolean, cardOpen: boolean): boolean {
  return startScreen && !cardOpen;
}
