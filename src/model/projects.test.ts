import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATION_TUNING, SPEAKERS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT } from "../data/galaxies.ts";
import { galaxyProjects, PROJECT_THANKS, PROJECTS } from "../data/projects.ts";
import { GALAXIES } from "../data/storybook.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { ensureStation } from "./flight.ts";
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
import { flightStationContext, worldStationsNear } from "./stations.ts";
import { stationSpecialty } from "./stationServices.ts";

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
    const galaxies = {
      1: "Sunflower",
      2: "Cartwheel",
      3: "Whirlpool",
      4: "Needle",
      5: "Andromeda",
    } as const;
    for (const [galaxy, projects] of Object.entries(PROJECTS)) {
      for (const { cost, name, speaker, thanks } of projects) {
        const row = ECONOMY_DOC.split("\n").find((line) => line.startsWith(`| ${name} `));
        expect(row, name).toBeDefined();
        const cells = row!.split("|").map((cell) => cell.trim());
        expect(cells.slice(1, 6), name).toEqual([
          name,
          galaxies[Number(galaxy) as keyof typeof galaxies],
          String(cost),
          speaker === "settler" ? "Settler" : SPEAKERS[speaker].name,
          `"${thanks}"`,
        ]);
      }
    }
    const route = [1, 3, 4, 5, 2, 6] as const;
    expect(route.map((galaxy) => galaxyProjects(galaxy).length)).toEqual([3, 3, 3, 3, 2, 0]);
    expect(
      route.map((galaxy) => galaxyProjects(galaxy).reduce((sum, project) => sum + project.cost, 0)),
    ).toEqual([790, 1125, 1250, 1375, 1050, 0]);
  });

  it("uses the approved chapter speakers and Art's existing station and channel anchor semantics", () => {
    expect(SPEAKERS.settler.name).toBe("Wick");
    expect(PROJECTS[4]!.map(({ id, site, speaker }) => ({ id, site, speaker }))).toEqual([
      { id: "channelLights", site: "needlePractice", speaker: "elderLoom" },
      { id: "loomHall", site: "station", speaker: "avi" },
      { id: "practiceBerth", site: "needlePractice", speaker: "elderLoom" },
    ]);
    expect(PROJECTS[5]!.map(({ id, site, speaker }) => ({ id, site, speaker }))).toEqual([
      { id: "courierSchool", site: "station", speaker: "pip" },
      { id: "spareBeacon", site: "darkBeacon", speaker: "settler" },
      { id: "routeExchange", site: "pip", speaker: "pip" },
    ]);
  });

  it.each([3, 4, 5] as const)(
    "funds galaxy %i projects in parts and grants each ally exactly once",
    (galaxy) => {
      const projects = PROJECTS[galaxy]!;
      const state = progress();
      expect(projects).toHaveLength(3);
      for (const project of projects) {
        expect(donate(projects, state, 100, project.id)).toEqual({
          amount: 100,
          funded: false,
          kind: "paid",
        });
        expect(projectAllies(projects, state).some(({ project: id }) => id === project.id)).toBe(
          false,
        );
        expect(donate(projects, state, 1000, project.id)).toEqual({
          amount: project.cost - 100,
          funded: true,
          kind: "paid",
        });
        expect(donate(projects, state, 1000, project.id)).toEqual({ kind: "refused" });
        expect(worldChanges(projects, state)).toContainEqual({
          project: project.id,
          revealed: false,
          site: project.site,
        });
        expect(revealWorldChange(projects, state, project.id)).toBe(true);
        expect(revealWorldChange(projects, state, project.id)).toBe(false);
      }
      expect(projectAllies(projects, state)).toEqual(
        projects.map(({ ally, id }) => ({ ally, project: id })),
      );
    },
  );

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
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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

  it("keeps Jobs and held-task access in resolved Phantom without offering any projects", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.unlocked.push(6);
    model.startGalaxy(6);
    Object.assign(model.state.progress[6], { holodisk: true, questComplete: true, resolved: true });
    const flight = model.state.flight!;
    const sites = worldStationsNear(
      flightStationContext(flight),
      ECONOMY,
      6,
      30_000,
      flight.player,
    );
    const jobs = sites.find((site) => stationSpecialty(6, site.id) === "jobs")!;
    const equipment = sites.find((site) => stationSpecialty(6, site.id) === "equipment")!;
    for (const site of [jobs, equipment]) {
      expect(ensureStation(CONTENT, site.id, flight)).not.toBeNull();
    }

    model.state.docked = equipment.id;
    expect(model.stationServices).toMatchObject({
      heldTask: false,
      jobs: false,
      projects: false,
    });
    expect(model.projects).toBeNull();
    expect(model.jobBoard()).toEqual([]);

    model.state.docked = jobs.id;
    expect(model.stationServices).toMatchObject({ heldTask: false, jobs: true, projects: false });
    const offer = model
      .jobBoard()
      .find(({ state, type }) => state === "offer" && type !== "survey")!;
    expect(model.acceptJob(offer.id)).toBe("accepted");

    model.state.docked = equipment.id;
    expect(model.stationServices).toMatchObject({ heldTask: true, jobs: false, projects: false });
    expect(model.jobBoard()).toEqual([expect.objectContaining({ id: offer.id, state: "held" })]);
    expect(model.projects).toBeNull();
  });

  it("offers unlocked projects at a real station without Jobs or an active task", () => {
    const model = docked(1000);
    const flight = model.state.flight!;
    const site = worldStationsNear(
      flightStationContext(flight),
      ECONOMY,
      1,
      30_000,
      flight.player,
    ).find(({ id }) => stationSpecialty(1, id) === "equipment")!;
    expect(ensureStation(CONTENT, site.id, flight)).not.toBeNull();
    model.state.docked = site.id;
    expect(model.stationServices).toMatchObject({ heldTask: false, jobs: false, projects: true });
    expect(model.jobBoard()).toEqual([]);
    expect(model.projects?.map(({ id }) => id)).toEqual(sunflower.map(({ id }) => id));
    expect(model.donationRequest("salvageBeacons")).toMatchObject({
      amount: cost("salvageBeacons"),
    });
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
    const restored = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save()).state
      .progress[1];
    expect(restored.donated).toEqual({ greenhouseRing: cost("greenhouseRing") });
    expect(restored.revealed).toEqual(["greenhouseRing"]);
  });

  it.each([
    [3, "quietCrossing", 300],
    [4, "practiceBerth", 350],
    [5, "routeExchange", 400],
  ] as const)(
    "retains partial funding and one reveal on Continue in galaxy %i",
    (galaxy, id, price) => {
      const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
      model.state.unlocked.push(galaxy);
      model.startGalaxy(galaxy);
      const progress = model.state.progress[galaxy];
      Object.assign(progress, { holodisk: true, questComplete: true, resolved: true });
      model.state.docked = "station:0,0";
      model.state.economy.stardust = price - 1;
      expect(model.donate(id)).toEqual({ amount: price - 1, funded: false, kind: "paid" });
      expect(model.revealWorldChange(galaxy, id)).toBe(false);
      const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
      resumed.continueGame();
      expect(resumed.state.progress[galaxy].donated[id]).toBe(price - 1);
      expect(resumed.state.flight?.galaxy).toBe(galaxy);
      resumed.state.docked = "station:0,0";
      resumed.state.economy.stardust = 1;
      expect(resumed.donate(id)).toEqual({ amount: 1, funded: true, kind: "paid" });
      expect(resumed.revealWorldChange(galaxy, id)).toBe(true);
      const revealed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, resumed.save());
      revealed.continueGame();
      expect(revealed.worldChanges(galaxy)).toContainEqual({
        project: id,
        revealed: true,
        site: galaxyProjects(galaxy).at(-1)!.site,
      });
      expect(revealed.revealWorldChange(galaxy, id)).toBe(false);
    },
  );

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
