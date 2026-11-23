/** Readout refreshes, in ms; the frame rate itself is the game loop's. */
const REFRESH_MS = 500;

/**
 * Settings controls the readout using its device preference. `fps` reads
 * the game loop's measured frame rate.
 */
export function createFpsCounter(host: HTMLElement, fps: () => number) {
  const readout = document.createElement("div");
  readout.className = "ada-fps";
  readout.setAttribute("aria-hidden", "true");
  readout.hidden = true;
  host.append(readout);
  let timer: ReturnType<typeof setInterval> | undefined;
  const paint = () => {
    readout.textContent = `${Math.round(fps())} FPS`;
  };
  const stop = () => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  return {
    dispose(): void {
      stop();
      readout.remove();
    },
    readout,
    set(on: boolean): void {
      readout.hidden = !on;
      stop();
      if (on) {
        paint();
        timer = setInterval(paint, REFRESH_MS);
      }
    },
  };
}
