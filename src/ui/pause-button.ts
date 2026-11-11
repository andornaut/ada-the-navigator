import { type PauseFrame, pauseFrames } from "./pause.ts";

const UI_ROOT = "/art/ui/";

// Chibi's touch pause button (ui-pause): rest, then its press frames once on a press, then held
// until release. Activating it pauses. Its frames come from the UI manifest's sheet; until they
// load it shows the sheet's first frame.
export function createPauseButton(
  root: HTMLElement,
  label: string,
  onPause: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ada-pause";
  button.dataset.action = "pause";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.hidden = true;
  root.append(button);
  let frames: Readonly<Record<"held" | "press" | "rest", readonly PauseFrame[]>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const showFrame = (frame: PauseFrame | undefined) => {
    button.style.setProperty("--pause-frame", `${-(frame?.x ?? 0)}px`);
  };
  const rest = () => {
    clearTimeout(timer);
    showFrame(frames?.rest[0]);
  };
  const press = () => {
    clearTimeout(timer);
    const steps = frames?.press ?? [];
    const play = (index: number) => {
      const frame = steps[index];
      if (!frame) {
        showFrame(frames?.held[0]);
        return;
      }
      showFrame(frame);
      timer = setTimeout(() => play(index + 1), frame.duration);
    };
    play(0);
  };
  button.addEventListener("pointerdown", press);
  for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
    button.addEventListener(type, rest);
  }
  button.addEventListener("click", () => {
    rest();
    onPause();
  });
  void fetch(`${UI_ROOT}manifest.json`)
    .then((response) => response.json() as Promise<{ sprites?: { json: string; key: string }[] }>)
    .then((manifest) => {
      const entry = manifest.sprites?.find((sprite) => sprite.key === "ui-pause");
      return entry
        ? fetch(`${UI_ROOT}${entry.json}`).then((response) => response.json())
        : undefined;
    })
    .then((sheet: unknown) => {
      if (sheet) {
        frames = pauseFrames(sheet as Parameters<typeof pauseFrames>[0]);
        rest();
      }
    })
    .catch(() => undefined);
  return button;
}
