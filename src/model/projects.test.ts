import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONVERSATION_TUNING, SPEAKERS } from "../data/conversations.ts";
import { PROJECT_THANKS, PROJECTS } from "../data/projects.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { GameModel } from "./game.ts";
import {
  donate,
  donationRequest,
  projectAllies,
  type ProjectProgress,
  projectsOffered,
  projectViews,
  worldChanges,
} from "./projects.ts";
import { restoreSave } from "./save.ts";
import { playOpening } from "./test-launch.ts";

// Gameplay's economy doc, with its line wrapping undone.
const ECONOMY_DOC = readFileSync(new URL("../../gameplay/economy.md", import.meta.url), "utf8");

const sunflower = PROJECTS[1];
const progress = (resolved = true, donated: Record<string, number> = {}): ProjectProgress => ({
  donated,
  resolved,
});

describe("community projects", () => {
  it("are Gameplay's per-project table: name, galaxy, price, speaker and thank-you line", () => {
    const galaxies = { 1: "Sunflower", 2: "Cartwheel", 3: "Whirlpool" } as const;
    for (const [sector, projects] of Object.entries(PROJECTS)) {
      for (const { cost, name, speaker, thanks } of projects) {
        const row = ECONOMY_DOC.split("\n").find((line) => line.startsWith(`| ${name} `));
        expect(row, name).toBeDefined();
        const cells = row!.split("|").map((cell) => cell.trim());
        expect(cells.slice(1, 6), name).toEqual([
          name,
          galaxies[Number(sector) as 1 | 2 | 3],
          String(cost),
          SPEAKERS[speaker].name,
          `"${thanks}"`,
        ]);
      }
    }
    expect(Object.values(PROJECTS).flat()).toHaveLength(7);
  });

  it("are offered once the galaxy's chapter is complete", () => {
    expect(projectsOffered(progress(false))).toBe(false);
    expect(projectsOffered(progress(true))).toBe(true);
  });

  it("pay as much of the remaining cost as the balance covers, and keep part payments", () => {
    const paid = progress();
    expect(donate(sunflower, paid, 120, "salvageBeacons")).toEqual({
      amount: 120,
      funded: false,
      kind: "paid",
    });
    expect(paid.donated).toEqual({ salvageBeacons: 120 });
    expect(donate(sunflower, paid, 1000, "salvageBeacons")).toEqual({
      amount: 180,
      funded: true,
      kind: "paid",
    });
    expect(projectViews(sunflower, paid).find(({ id }) => id === "salvageBeacons")).toMatchObject({
      funded: true,
      paid: 300,
      remaining: 0,
    });
  });

  it("confirm the amount a donation pays, the balance left and what is still needed after", () => {
    expect(donationRequest(sunflower, progress(), 120, "greenhouseRing")).toEqual({
      amount: 120,
      kind: "confirm",
      left: 0,
      stillNeeded: 380,
    });
    expect(
      donationRequest(sunflower, progress(true, { workshopCrane: 350 }), 1000, "workshopCrane"),
    ).toEqual({ amount: 50, kind: "confirm", left: 950, stillNeeded: 0 });
  });

  it("refuse only at a balance of 0, for a funded project, and before the chapter is complete", () => {
    expect(donate(sunflower, progress(), 0, "greenhouseRing")).toEqual({ kind: "refused" });
    expect(donate(sunflower, progress(), 1, "greenhouseRing").kind).toBe("paid");
    expect(
      donate(sunflower, progress(true, { salvageBeacons: 300 }), 999, "salvageBeacons"),
    ).toEqual({ kind: "refused" });
    expect(donate(sunflower, progress(false), 999, "salvageBeacons")).toEqual({ kind: "refused" });
    expect(donate(sunflower, progress(), 999, "hubRepairs")).toEqual({ kind: "refused" });
  });

  it("show Gameplay's effect line and description, keyed by Art's project ids", () => {
    const art = JSON.parse(
      readFileSync(new URL("../../public/art/projects.json", import.meta.url), "utf8"),
    ) as { projects: Record<string, unknown> };
    const ids = Object.values(PROJECTS)
      .flat()
      .map(({ id }) => id);
    expect(Object.keys(art.projects).every((id) => ids.includes(id))).toBe(true);
    for (const { copy, id, name } of Object.values(PROJECTS).flat()) {
      const row = ECONOMY_DOC.split("\n").find(
        (line) => line.startsWith(`| ${name} `) && line.includes(`\`${id}\``),
      );
      expect(row, name).toBeDefined();
      const cells = row!.split("|").map((cell) => cell.trim());
      expect([cells[3], cells[4]], name).toEqual([
        PROTOTYPE.labels[`projectEffect${copy}`],
        PROTOTYPE.labels[`projectAbout${copy}`],
      ]);
    }
  });

  it("make one ally and one world change per funded project, at its site", () => {
    const funded = progress(true, { greenhouseRing: 500, salvageBeacons: 120, workshopCrane: 400 });
    expect(projectAllies(sunflower, funded)).toEqual([
      { ally: "escort", project: "greenhouseRing" },
      { ally: "chase", project: "workshopCrane" },
    ]);
    expect(worldChanges(sunflower, funded)).toEqual([
      { project: "greenhouseRing", site: "growers" },
      { project: "workshopCrane", site: "workshop" },
    ]);
  });

  it("thank Ada once each, as a one-line space conversation by the project's speaker", () => {
    expect(PROJECT_THANKS.map(({ id }) => id)).toEqual(
      Object.values(PROJECTS)
        .flat()
        .map(({ id }) => `funded:${id}`),
    );
    for (const conversation of PROJECT_THANKS) {
      expect(conversation.lines).toHaveLength(1);
      expect(conversation.repeat).toBe("never");
    }
  });
});

// A docked first flight in Sunflower with its chapter complete and Stardust to give.
function docked(stardust: number) {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  Object.assign(model.state.progress[1], { holodisk: true, questComplete: true, resolved: true });
  model.state.dialogue = null;
  model.state.economy.stardust = stardust;
  model.state.flight!.objects = [];
  model.state.docked = "station:0,0";
  return model;
}

describe("donating at a station", () => {
  it("offers the docked galaxy's projects only once its chapter is complete, and only docked", () => {
    const model = docked(1000);
    expect(model.projects?.map(({ id }) => id)).toEqual(sunflower.map(({ id }) => id));
    model.state.progress[1].resolved = false;
    expect(model.projects).toBeNull();
    model.state.progress[1].resolved = true;
    model.state.docked = null;
    expect(model.projects).toBeNull();
  });

  it("spends the Stardust, and funding the last part closes the card and thanks Ada", () => {
    const model = docked(200);
    expect(model.donationRequest("salvageBeacons")).toMatchObject({
      amount: 200,
      stillNeeded: 100,
    });
    expect(model.donate("salvageBeacons")).toMatchObject({ funded: false, kind: "paid" });
    expect(model.state.economy.stardust).toBe(0);
    expect(model.state.docked).not.toBeNull();
    expect(model.donationRequest("salvageBeacons")).toEqual({ kind: "refused" });
    model.state.economy.stardust = 1000;
    expect(model.donate("salvageBeacons")).toMatchObject({ funded: true, kind: "paid" });
    expect(model.state.economy.stardust).toBe(900);
    expect(model.state.docked).toBeNull();
    const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
    const thanks = sunflower.find(({ id }) => id === "salvageBeacons")!.thanks;
    const shown: string[] = [];
    for (let t = 0; t < CONVERSATION_TUNING.cooldownSeconds * 4; t += 0.5) {
      model.step(0.5, idle);
      if (model.conversation) {
        shown.push(model.conversation.text);
      }
    }
    expect(shown).toContain(thanks);
  });

  it("keeps donations across a save, and loads saves from before projects", () => {
    const model = docked(1000);
    model.donate("greenhouseRing");
    const saved = JSON.parse(model.save()) as { progress: Record<string, Record<string, unknown>> };
    expect(new GameModel(PROTOTYPE, model.save()).state.progress[1].donated).toEqual({
      greenhouseRing: 500,
    });
    delete saved.progress["1"]!.donated;
    expect(restoreSave(saved)?.progress[1].donated).toEqual({});
  });

  it("rejects a save paying an unknown project or more than its price", () => {
    const model = docked(1000);
    for (const donated of [{ hubRepairs: 100 }, { greenhouseRing: 501 }, { greenhouseRing: 1.5 }]) {
      const saved = JSON.parse(model.save()) as {
        progress: Record<string, Record<string, unknown>>;
      };
      saved.progress["1"]!.donated = donated;
      expect(restoreSave(saved), JSON.stringify(donated)).toBeNull();
    }
  });
});
