import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATION_TUNING, SPEAKERS } from "../data/conversations.ts";
import { BUILT } from "../data/galaxies.ts";
import { PROJECT_THANKS, PROJECTS } from "../data/projects.ts";
import { GALAXIES } from "../data/storybook.ts";
import { playOpening } from "../testing/launch.ts";
import { GameModel } from "./game.ts";
import {
  donate,
  donationRequest,
  projectAllies,
  type ProjectProgress,
  projectsOffered,
  projectViews,
  revealWorldChange,
  worldChanges,
} from "./projects.ts";
import { restoreSave } from "./save.ts";

// Gameplay's economy doc, with its line wrapping undone.
const ECONOMY_DOC = readFileSync(new URL("../../gameplay/economy.md", import.meta.url), "utf8");

const sunflower = PROJECTS[1]!;
const cost = (id: string) => sunflower.find((project) => project.id === id)!.cost;
const progress = (resolved = true, donated: Record<string, number> = {}): ProjectProgress => ({
  donated,
  resolved,
  revealed: [],
});

describe("community projects", () => {
  it("are Gameplay's per-project table: name, galaxy, price, speaker and thank-you line", () => {
    const galaxies = { 1: "Sunflower", 2: "Cartwheel", 3: "Whirlpool" } as const;
    for (const [galaxy, projects] of Object.entries(PROJECTS)) {
      for (const { cost, name, speaker, thanks } of projects) {
        const row = ECONOMY_DOC.split("\n").find((line) => line.startsWith(`| ${name} `));
        expect(row, name).toBeDefined();
        const cells = row!.split("|").map((cell) => cell.trim());
        expect(cells.slice(1, 6), name).toEqual([
          name,
          galaxies[Number(galaxy) as 1 | 2 | 3],
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
      amount: cost("salvageBeacons") - 120,
      funded: true,
      kind: "paid",
    });
    expect(projectViews(sunflower, paid).find(({ id }) => id === "salvageBeacons")).toMatchObject({
      funded: true,
      paid: cost("salvageBeacons"),
      remaining: 0,
    });
  });

  it("confirm the amount a donation pays, the balance left and what is still needed after", () => {
    expect(donationRequest(sunflower, progress(), 120, "greenhouseRing")).toEqual({
      amount: 120,
      kind: "confirm",
      left: 0,
      stillNeeded: cost("greenhouseRing") - 120,
    });
    const crane = progress(true, { workshopCrane: cost("workshopCrane") - 50 });
    expect(donationRequest(sunflower, crane, 1000, "workshopCrane")).toEqual({
      amount: 50,
      kind: "confirm",
      left: 950,
      stillNeeded: 0,
    });
  });

  it("refuse only at a balance of 0, for a funded project, and before the chapter is complete", () => {
    expect(donate(sunflower, progress(), 0, "greenhouseRing")).toEqual({ kind: "refused" });
    expect(donate(sunflower, progress(), 1, "greenhouseRing").kind).toBe("paid");
    expect(
      donate(
        sunflower,
        progress(true, { salvageBeacons: cost("salvageBeacons") }),
        999,
        "salvageBeacons",
      ),
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
    // Art draws ahead: a project not built yet is a placeholder galaxy's in Gameplay's table.
    const unbuilt = GALAXIES.filter(({ galaxy }) => !BUILT.has(galaxy)).map(({ name }) => name);
    for (const id of Object.keys(art.projects).filter((project) => !ids.includes(project))) {
      const name = ECONOMY_DOC.split("\n")
        .find((line) => line.includes(`\`${id}\``))
        ?.split("|")[1]
        ?.trim();
      const row = ECONOMY_DOC.split("\n").find((line) => line.startsWith(`| ${name} `));
      expect(
        unbuilt.some((galaxy) => row?.includes(`| ${galaxy} `)),
        id,
      ).toBe(true);
    }
    for (const { copy, id, name } of Object.values(PROJECTS).flat()) {
      const row = ECONOMY_DOC.split("\n").find(
        (line) => line.startsWith(`| ${name} `) && line.includes(`\`${id}\``),
      );
      expect(row, name).toBeDefined();
      const cells = row!.split("|").map((cell) => cell.trim());
      expect([cells[3], cells[4]], name).toEqual([
        CONTENT.labels[`projectEffect${copy}`],
        CONTENT.labels[`projectAbout${copy}`],
      ]);
    }
  });

  it("make one ally and one world change per funded project, at its site", () => {
    const funded = progress(true, {
      greenhouseRing: cost("greenhouseRing"),
      salvageBeacons: 120,
      workshopCrane: cost("workshopCrane"),
    });
    expect(projectAllies(sunflower, funded)).toEqual([
      { ally: "escort", project: "greenhouseRing" },
      { ally: "chase", project: "workshopCrane" },
    ]);
    expect(worldChanges(sunflower, funded)).toEqual([
      { project: "greenhouseRing", revealed: false, site: "growers" },
      { project: "workshopCrane", revealed: false, site: "workshop" },
    ]);
  });

  it("play each world change's reveal once, and only once funded", () => {
    const paid = progress(true, { greenhouseRing: cost("greenhouseRing"), salvageBeacons: 1 });
    expect(revealWorldChange(sunflower, paid, "salvageBeacons")).toBe(false);
    expect(revealWorldChange(sunflower, paid, "greenhouseRing")).toBe(true);
    expect(revealWorldChange(sunflower, paid, "greenhouseRing")).toBe(false);
    expect(paid.revealed).toEqual(["greenhouseRing"]);
    expect(worldChanges(sunflower, paid)).toEqual([
      { project: "greenhouseRing", revealed: true, site: "growers" },
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
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
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
    const model = docked(100);
    expect(model.donationRequest("salvageBeacons")).toMatchObject({
      amount: 100,
      stillNeeded: cost("salvageBeacons") - 100,
    });
    expect(model.donate("salvageBeacons")).toMatchObject({ funded: false, kind: "paid" });
    expect(model.state.achievements.projects).toEqual([]);
    expect(model.state.economy.stardust).toBe(0);
    expect(model.state.docked).not.toBeNull();
    expect(model.donationRequest("salvageBeacons")).toEqual({ kind: "refused" });
    model.state.economy.stardust = 1000;
    expect(model.donate("salvageBeacons")).toMatchObject({ funded: true, kind: "paid" });
    // A funded project counts toward Good Cause and Community Builder.
    expect(model.state.achievements.projects).toEqual(["salvageBeacons"]);
    expect(model.state.achievements.unlocked).toContain("goodCause");
    expect(model.state.economy.stardust).toBe(1000 - (cost("salvageBeacons") - 100));
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

  it("keeps donations and reveals across a save", () => {
    const model = docked(1000);
    model.donate("greenhouseRing");
    expect(model.revealWorldChange(1, "greenhouseRing")).toBe(true);
    const restored = new GameModel(CONTENT, model.save()).state.progress[1];
    expect(restored.donated).toEqual({ greenhouseRing: cost("greenhouseRing") });
    expect(restored.revealed).toEqual(["greenhouseRing"]);
  });

  it("rejects a save revealing a project twice, unfunded or from another galaxy", () => {
    const model = docked(1000);
    model.donate("greenhouseRing");
    for (const revealed of [
      ["greenhouseRing", "greenhouseRing"],
      ["workshopCrane"],
      ["hubRepairs"],
    ]) {
      const saved = JSON.parse(model.save()) as {
        progress: Record<string, Record<string, unknown>>;
      };
      saved.progress["1"]!.revealed = revealed;
      expect(restoreSave(saved), JSON.stringify(revealed)).toBeNull();
    }
  });

  it("rejects a save paying an unknown project or more than its price", () => {
    const model = docked(1000);
    for (const donated of [
      { hubRepairs: 100 },
      { greenhouseRing: cost("greenhouseRing") + 1 },
      { greenhouseRing: 1.5 },
    ]) {
      const saved = JSON.parse(model.save()) as {
        progress: Record<string, Record<string, unknown>>;
      };
      saved.progress["1"]!.donated = donated;
      expect(restoreSave(saved), JSON.stringify(donated)).toBeNull();
    }
  });
});
