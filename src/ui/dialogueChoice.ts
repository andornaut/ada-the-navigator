import { uiIconUrl } from "../data/uiIconUrl.ts";
import { units } from "./layout/css.ts";
import { STORY_CHOICE_QUEST_ICON_SIZE } from "./layout/storyPage.ts";

function questMarker(): HTMLImageElement {
  const image = document.createElement("img");
  image.alt = "";
  image.src = uiIconUrl("map-destination");
  image.style.width = units(STORY_CHOICE_QUEST_ICON_SIZE);
  image.style.height = units(STORY_CHOICE_QUEST_ICON_SIZE);
  return image;
}

export function showDialogueChoiceStatus(
  button: HTMLButtonElement,
  label: string,
  status: "completed" | "quest",
): void {
  const marker = status === "quest" ? questMarker() : document.createElement("span");
  if (status === "completed") {
    marker.textContent = "✓";
  }
  marker.dataset.dialogueStatus = status;
  marker.setAttribute("aria-hidden", "true");
  marker.style.flex = "none";
  button.setAttribute(
    "aria-label",
    `${label}, ${status === "quest" ? "Advances the quest" : "Topic completed"}`,
  );
  button.append(marker);
}
