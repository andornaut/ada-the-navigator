export const FONT_ROLES = { body: "font-body", heading: "font-title" } as const;

export interface SettingsLabels {
  readonly aimControls: string;
  readonly close: string;
  readonly moveControls: string;
  readonly settings: string;
  readonly sound?: string;
  readonly screenShake?: string;
}

export interface ControlVisibility {
  readonly aim: boolean;
  readonly move: boolean;
}

export interface FeedbackSettings {
  readonly sound: boolean;
  readonly screenShake: boolean;
}

export interface SettingsOptions {
  readonly labels: SettingsLabels;
  readonly onFeedbackChange?: (settings: FeedbackSettings) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onVisibilityChange: (visibility: ControlVisibility) => void;
}

const STYLE = `
@font-face{
  font-family:AdaUI;
  src:url('/art/ui/fonts/liberation/LiberationSans-Regular.ttf') format('truetype');
  font-weight:400;
  font-display:swap
}

@font-face{
  font-family:AdaUI;
  src:url('/art/ui/fonts/liberation/LiberationSans-Bold.ttf') format('truetype');
  font-weight:700;
  font-display:swap
}

.ada-controls{
  position:absolute;
  inset:0;
  pointer-events:none;
  font:16px AdaUI,'Liberation Sans',sans-serif;
  color:#172335;
  z-index:10
}

.ada-controls button{
  font:inherit;
  min-height:48px;
  min-width:48px;
  color:inherit;
  border:2px solid #172335;
  border-radius:8px;
  background:#fff8e6;
  cursor:pointer;
  pointer-events:auto;
  padding:8px 16px
}

.ada-controls button:focus-visible,.ada-controls input:focus-visible{
  outline:3px solid #5078b4;
  outline-offset:4px
}

.ada-controls .ada-settings-open{
  position:absolute;
  right:max(8px,env(safe-area-inset-right));
  top:max(8px,env(safe-area-inset-top))
}

.ada-controls [data-control]{
  position:absolute;
  bottom:20px;
  width:74px;
  height:74px;
  pointer-events:auto;
  touch-action:none
}

.ada-controls [data-control=move-joystick]{
  left:20px
}

.ada-controls [data-control=aim-joystick]{
  right:20px
}

.ada-controls .ada-use{
  position:absolute;
  left:50%;
  bottom:max(24px,env(safe-area-inset-bottom));
  transform:translateX(-50%);
  max-width:calc(100% - 32px)
}

.ada-controls .ada-modal{
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  background:#101926b3;
  pointer-events:auto;
  padding:16px;
  box-sizing:border-box
}

.ada-controls [hidden]{
  display:none!important
}

.ada-controls .ada-card{
  box-sizing:border-box;
  width:max-content;
  min-width:min(50%,480px);
  max-width:100%;
  max-height:100%;
  overflow:auto;
  padding:16px;
  background:#fff8e6;
  border:2px solid #172335;
  border-radius:0;
  border-image:url('/art/ui/sprites/ui-settings-card.png') 2 fill / 2px stretch
}

.ada-controls .ada-card header{
  display:grid;
  grid-template-columns:48px minmax(0,1fr) 48px;
  align-items:center;
  gap:8px;
  margin-bottom:8px
}

.ada-controls h2{
  font-size:24px;
  line-height:28px;
  text-align:center;
  margin:0;
  font-weight:700;
  overflow-wrap:anywhere
}

.ada-controls .ada-close{
  padding:0;
  border:0;
  background:transparent;
  display:grid;
  place-items:center
}
.ada-controls .ada-close::before{
  content:"";
  width:24px;
  height:24px;
  background:url('/art/ui/sprites/ui-close.png') 0 0 / 48px 24px
}
.ada-controls .ada-close:active::before{
  background-position:-24px 0
}

.ada-controls label{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  min-height:48px;
  line-height:20px;
  cursor:pointer
}

.ada-controls label span{
  overflow-wrap:anywhere
}

.ada-controls input{
  width:32px;
  height:20px;
  flex:none;
  accent-color:#36764f
}

`;

// Intrinsic browser text measurement keeps the card centred without shrinking its fonts.
export function createSettings(parent: HTMLElement, options: SettingsOptions) {
  const root = document.createElement("div");
  root.className = "ada-controls";
  root.dataset.fontRole = FONT_ROLES.body;
  const style = document.createElement("style");
  style.textContent = STYLE;
  const openButton = document.createElement("button");
  openButton.className = "ada-settings-open";
  openButton.dataset.action = "settings";
  openButton.textContent = options.labels.settings;
  openButton.setAttribute("aria-haspopup", "dialog");
  openButton.setAttribute("aria-expanded", "false");
  const useButton = document.createElement("button");
  useButton.className = "ada-use";
  useButton.hidden = true;
  const joystickTargets = ["move", "aim"].map((side) => {
    const target = document.createElement("div");
    target.dataset.control = `${side}-joystick`;
    target.setAttribute("role", "group");
    target.setAttribute(
      "aria-label",
      side === "move" ? options.labels.moveControls : options.labels.aimControls,
    );
    return target;
  });
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = document.createElement("section");
  card.className = "ada-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", options.labels.settings);
  const header = document.createElement("header");
  const spacer = document.createElement("span");
  const title = document.createElement("h2");
  title.textContent = options.labels.settings;
  title.dataset.fontRole = FONT_ROLES.heading;
  const closeButton = document.createElement("button");
  closeButton.className = "ada-close";
  closeButton.dataset.action = "close-settings";
  closeButton.setAttribute("aria-label", options.labels.close);
  header.append(spacer, title, closeButton);
  const visibility = { aim: true, move: true };
  const row = (side: keyof ControlVisibility, label: string) => {
    const element = document.createElement("label");
    const caption = document.createElement("span");
    caption.textContent = label;
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = true;
    toggle.addEventListener("change", () => {
      visibility[side] = toggle.checked;
      options.onVisibilityChange({ ...visibility });
    });
    element.append(caption, toggle);
    return element;
  };
  card.append(
    header,
    row("move", options.labels.moveControls),
    row("aim", options.labels.aimControls),
  );
  const feedback = { screenShake: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, sound: true };
  for (const key of ["sound", "screenShake"] as const) {
    const caption = options.labels[key];
    if (!caption) {
      continue;
    }
    const element = document.createElement("label");
    const text = document.createElement("span");
    text.textContent = caption;
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = feedback[key];
    toggle.addEventListener("change", () => {
      feedback[key] = toggle.checked;
      options.onFeedbackChange?.({ ...feedback });
    });
    element.append(text, toggle);
    card.append(element);
  }
  options.onFeedbackChange?.({ ...feedback });
  modal.append(card);
  root.append(style, ...joystickTargets, openButton, useButton, modal);
  parent.append(root);
  let disposed = false;
  let open = false;
  let previousFocus: HTMLElement | undefined;
  const setOpen = (value: boolean) => {
    if (disposed || value === open) {
      return;
    }
    open = value;
    modal.hidden = !open;
    openButton.setAttribute("aria-expanded", String(open));
    if (open) {
      previousFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      closeButton.focus();
    } else {
      previousFocus?.focus();
    }
    options.onOpenChange(open);
  };
  openButton.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));
  // A full outside click closes the card; dragging out of the card does not.
  let outsidePress: { readonly id: number; readonly x: number; readonly y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outsidePress =
      event.target === modal
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : undefined;
  });
  modal.addEventListener("pointercancel", () => {
    outsidePress = undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      outsidePress &&
      event.target === modal &&
      Math.hypot(event.clientX - outsidePress.x, event.clientY - outsidePress.y) <= 10
    ) {
      setOpen(false);
    }
    outsidePress = undefined;
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const targets = [...card.querySelectorAll<HTMLElement>("button,input")];
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  return {
    close: () => setOpen(false),
    dispose(): void {
      if (disposed) {
        return;
      }
      setOpen(false);
      disposed = true;
      root.remove();
    },
    isOpen: () => open,
    joystickTargets,
    open: () => setOpen(true),
    root,
    useButton,
  };
}
