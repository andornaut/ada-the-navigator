import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const staticIcons = [
  "achievements",
  "ammo-energy",
  "ammo-missile",
  "ammo-shell",
  "exit",
  "exit-disc",
  "exit-disc-held",
  "exit-disc-press",
  "icon-aim-controls",
  "icon-browser-menu",
  "icon-cargo-20",
  "icon-cargo-20-disabled",
  "icon-fps-counter",
  "icon-holodisk",
  "icon-holodisk-20",
  "icon-install",
  "icon-ios-share",
  "icon-move-controls",
  "icon-ore-20",
  "icon-reduced-motion",
  "icon-shop-check",
  "icon-shop-engine-tuning",
  "icon-shop-engine-tuning-disabled",
  "icon-shop-shield",
  "icon-shop-shield-disabled",
  "icon-shop-ship-paint",
  "icon-shop-ship-paint-disabled",
  "icon-shop-tractor-beam",
  "icon-shop-tractor-beam-disabled",
  "icon-shop-upgrade-badge",
  "icon-shop-upgrade-badge-disabled",
  "icon-sound",
  "icon-stardust-20",
  "icon-tow-20",
  "icon-tow-20-disabled",
  "icon-use-control",
  "map-beacon",
  "map-close",
  "map-destination",
  "map-growers",
  "map-holodisk",
  "map-hostile-station",
  "map-job",
  "map-job-delivery",
  "map-job-hunt",
  "map-job-rescue",
  "map-job-survey",
  "map-nebula",
  "map-recentre",
  "map-salvagers",
  "map-station",
  "map-workshop",
  "map-wreck",
  "map-zoom-in",
  "map-zoom-out",
  "menu",
  "menu-disabled",
  "menu-held",
  "menu-press",
  "pause",
  "pause-disabled",
  "pause-held",
  "pause-press",
  "settings",
  "shield",
  "weapon-heavyMissile",
  "weapon-laser",
  "weapon-multiLaser",
  "weapon-phaser",
  "weapon-rapidMissile",
  "weapon-scattershot",
];

export const jobsAndProjects = [
  "icon-job-activity",
  "icon-job-activity-disabled",
  "icon-job-delivery",
  "icon-job-delivery-disabled",
  "icon-job-hunt",
  "icon-job-hunt-disabled",
  "icon-job-rescue",
  "icon-job-rescue-disabled",
  "icon-job-survey",
  "icon-job-survey-disabled",
  "icon-project-channel-lights",
  "icon-project-channel-lights-disabled",
  "icon-project-courier-school",
  "icon-project-courier-school-disabled",
  "icon-project-current-buoys",
  "icon-project-current-buoys-disabled",
  "icon-project-docking-bay",
  "icon-project-docking-bay-disabled",
  "icon-project-greenhouse-ring",
  "icon-project-greenhouse-ring-disabled",
  "icon-project-hub-repairs",
  "icon-project-hub-repairs-disabled",
  "icon-project-loom-hall",
  "icon-project-loom-hall-disabled",
  "icon-project-nursery-beacon",
  "icon-project-nursery-beacon-disabled",
  "icon-project-practice-berth",
  "icon-project-practice-berth-disabled",
  "icon-project-quiet-crossing",
  "icon-project-quiet-crossing-disabled",
  "icon-project-route-exchange",
  "icon-project-route-exchange-disabled",
  "icon-project-salvage-beacons",
  "icon-project-salvage-beacons-disabled",
  "icon-project-spare-beacon",
  "icon-project-spare-beacon-disabled",
  "icon-project-workshop-crane",
  "icon-project-workshop-crane-disabled",
];

const sheetIds = new Set([...staticIcons, ...jobsAndProjects]);
const marker = new URL("../../art/ui/icon-output.txt", import.meta.url);
const mode = existsSync(marker) ? readFileSync(marker, "utf8").trim() : "loose";
if (mode !== "loose" && mode !== "sheets") {
  throw new Error("Art UI icon output must be loose or sheets");
}

const publicIcons = new URL("../../public/art/ui/icons/", import.meta.url);
const authoredIcons = new URL("../../art/ui/icons/", import.meta.url);
const generatedIcons = new URL("../../.check-results/ui-icon-sources/", import.meta.url);
export function usesUiIconSheet(id: string): boolean {
  return mode === "sheets" && sheetIds.has(id);
}
const glyph = (directory: URL, id: string) => new URL(`${id}.svg`, directory);

// Raster producers use the installed vector roster even before staged SVGs have been drawn.
export function hasUiIcon(id: string): boolean {
  return usesUiIconSheet(id) || existsSync(glyph(publicIcons, id));
}

export function readUiIcon(id: string): string {
  if (!usesUiIconSheet(id)) return readFileSync(glyph(publicIcons, id), "utf8");
  const authored = glyph(authoredIcons, id);
  const source = existsSync(authored) ? authored : glyph(generatedIcons, id);
  if (!existsSync(source)) throw new Error(`Generate the selected UI source before packing: ${id}`);
  return readFileSync(source, "utf8");
}

export function writeUiIcon(id: string, svg: string): void {
  const output = usesUiIconSheet(id) ? generatedIcons : publicIcons;
  mkdirSync(output, { recursive: true });
  writeFileSync(glyph(output, id), svg);
}
