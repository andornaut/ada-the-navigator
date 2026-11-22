import type { Conversation, Speaker } from "./conversations.ts";
import type { GalaxyNumber } from "./types.ts";

/** How a project's ally joins the Phantom finale: an enemy behaviour rule, or the whales' current. */
export type ProjectAlly = "chase" | "current" | "escort";

/** A community project Ada can fund with Stardust once its galaxy's chapter is complete. */
export interface CommunityProject {
  readonly ally: ProjectAlly;
  /** The suffix of its effect line's and description's label keys (projectEffect, projectAbout). */
  readonly copy: string;
  /** Stardust to fund it in full, paid in parts. */
  readonly cost: number;
  /** Its shop glyph in the UI manifest (art/projects.md). */
  readonly icon: string;
  readonly id: string;
  readonly name: string;
  /** Where its world change shows: the site's destination or landmark. */
  readonly site: string;
  readonly speaker: Speaker;
  /** The speaker's thank-you line once it is funded. */
  readonly thanks: string;
}

// Each galaxy's community projects (gameplay/economy.md "Donations"), with provisional costs.
// Funding one plays its thank-you line, changes the world at its site, counts toward achievements
// and makes one ally for the finale; none gives combat power outside it.
export const PROJECTS: Readonly<Partial<Record<GalaxyNumber, readonly CommunityProject[]>>> = {
  1: [
    {
      ally: "escort",
      copy: "Greenhouse",
      cost: 300,
      icon: "icon-project-greenhouse-ring",
      id: "greenhouseRing",
      name: "Greenhouse ring",
      site: "growers",
      speaker: "grower",
      thanks: "A whole ring of greenhouses! Now we can grow enough to share.",
    },
    {
      ally: "chase",
      copy: "Crane",
      cost: 265,
      icon: "icon-project-workshop-crane",
      id: "workshopCrane",
      name: "Workshop crane",
      site: "workshop",
      speaker: "workshop",
      thanks: "With this crane we can lift whole ships. Thank you for building with us.",
    },
    {
      ally: "escort",
      copy: "Beacons",
      cost: 225,
      icon: "icon-project-salvage-beacons",
      id: "salvageBeacons",
      name: "Salvage beacons",
      site: "salvagers",
      speaker: "salvager",
      thanks: "These beacons will help us find lost things. Nothing out here stays lost for long.",
    },
  ],
  2: [
    {
      ally: "chase",
      copy: "DockingBay",
      cost: 600,
      icon: "icon-project-docking-bay",
      id: "dockingBay",
      name: "Second docking bay",
      site: "hub",
      speaker: "miner",
      thanks: "A second bay. Nobody has to wait alone anymore.",
    },
    {
      ally: "escort",
      copy: "HubRepairs",
      cost: 450,
      icon: "icon-project-hub-repairs",
      id: "hubRepairs",
      name: "Hub repairs",
      site: "hub",
      speaker: "station",
      thanks: "The hub is good as new. There is room for everyone, and now it shows.",
    },
  ],
  3: [
    {
      ally: "current",
      copy: "Nursery",
      cost: 450,
      icon: "icon-project-nursery-beacon",
      id: "nurseryBeacon",
      name: "Nursery beacon",
      site: "family",
      speaker: "whaleFamily",
      thanks: "The young ones can rest by its light. Thank you for looking after them.",
    },
    {
      ally: "escort",
      copy: "CurrentBuoys",
      cost: 375,
      icon: "icon-project-current-buoys",
      id: "currentBuoys",
      name: "Current-map buoys",
      site: "whalesCurrent",
      speaker: "whaleFamily",
      thanks: "The buoys hum the currents back to us. No one will drift off course now.",
    },
    {
      ally: "escort",
      copy: "QuietCrossing",
      cost: 300,
      icon: "icon-project-quiet-crossing",
      id: "quietCrossing",
      name: "Quiet crossing",
      site: "family",
      speaker: "whaleFamily",
      thanks: "The ships wait here now. The little ones can cross without hurrying.",
    },
  ],
  4: [
    {
      ally: "escort",
      copy: "ChannelLights",
      cost: 525,
      icon: "icon-project-channel-lights",
      id: "channelLights",
      name: "Channel lights",
      site: "needlePractice",
      speaker: "elderLoom",
      thanks: "Young pilots can practise even in the dark now. Patience needs light.",
    },
    {
      ally: "chase",
      copy: "LoomHall",
      cost: 375,
      icon: "icon-project-loom-hall",
      id: "loomHall",
      name: "Loom hall",
      site: "station",
      speaker: "avi",
      thanks: "A hall for teaching. Every pilot here started with a wobbly first gate.",
    },
    {
      ally: "escort",
      copy: "PracticeBerth",
      cost: 350,
      icon: "icon-project-practice-berth",
      id: "practiceBerth",
      name: "Practice berth",
      site: "needlePractice",
      speaker: "elderLoom",
      thanks:
        "A young pilot sat here all morning. By afternoon, they were ready to try the turn again.",
    },
  ],
  5: [
    {
      ally: "escort",
      copy: "CourierSchool",
      cost: 525,
      icon: "icon-project-courier-school",
      id: "courierSchool",
      name: "Courier school",
      site: "station",
      speaker: "pip",
      thanks: "Now every new courier learns to slow down and speak up. Thanks, Ada.",
    },
    {
      ally: "escort",
      copy: "SpareBeacon",
      cost: 450,
      icon: "icon-project-spare-beacon",
      id: "spareBeacon",
      name: "Spare beacon",
      site: "darkBeacon",
      speaker: "settler",
      thanks: "If a beacon ever goes dark again, this one will light the way.",
    },
    {
      ally: "escort",
      copy: "RouteExchange",
      cost: 400,
      icon: "icon-project-route-exchange",
      id: "routeExchange",
      name: "Route exchange",
      site: "pip",
      speaker: "pip",
      thanks:
        "Someone left a note about a turn they missed. It saved the next pilot the same trip.",
    },
  ],
};

/** A galaxy's community projects; a placeholder galaxy has none. */
export function galaxyProjects(galaxy: GalaxyNumber): readonly CommunityProject[] {
  return PROJECTS[galaxy] ?? [];
}

/** Each project's thank-you, a one-line space conversation that plays once, when it is funded. */
export const PROJECT_THANKS: readonly Conversation[] = Object.values(PROJECTS)
  .flat()
  .map(({ id, speaker, thanks }) => ({
    id: `funded:${id}`,
    lines: [{ speaker, text: thanks }],
    priority: "lesson",
    repeat: "never",
    trigger: { kind: "funded", project: id },
  }));
