import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { playOpening, readStory, relaunch } from "../testing/launch.ts";
import { GameModel } from "./game.ts";

// The galaxy map opened in flight from the local map's Galaxies (gameplay/rules.md "Aboard and
// the galaxy map"): Stay here, Jump to another galaxy, Earth, and the close X, back and Escape.

/** A quiet Sunflower flight with Whirlpool open too, out of danger, no conversation showing. */
function flying() {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 3];
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  playOpening(model);
  const flight = model.state.flight!;
  flight.objects = [];
  flight.dangerFor = 0;
  model.state.dialogue = null;
  return { flight, model };
}

describe("the galaxy map in flight", () => {
  it("opens over the flight with the ship on the galaxy Ada is flying in, Stay here its default", () => {
    const { model } = flying();
    expect(model.galaxyMapOpen).toBe(false);
    expect(model.openGalaxyMap()).toBe(true);
    expect(model.screen).toBe("space");
    expect(model.galaxyMapOpen).toBe(true);
    expect(model.galaxyMapShownInFlight).toBe(true);
    expect(model.shipPosition).toBe(ROUTE_POSITION[1]);
    expect(model.galaxyMapSelection).toBe(1);
    expect(model.galaxyMapStays).toBe(true);
    // No unlock flight plays over a flight.
    expect(model.routeFlight).toBeNull();
    // Right moves the ship to Whirlpool, where Jump no longer reads Stay here.
    model.stepGalaxy(1);
    expect(model.galaxyMapSelection).toBe(3);
    expect(model.galaxyMapStays).toBe(false);
  });

  it("refuses to open in danger, and opens while towing", () => {
    const { flight, model } = flying();
    flight.dangerFor = 2;
    expect(model.openGalaxyMap()).toBe(false);
    expect(model.galaxyMapOpen).toBe(false);
    flight.dangerFor = 0;
    flight.tow = { x: flight.player.x + 50, y: flight.player.y };
    expect(model.towing).toBe(true);
    expect(model.openGalaxyMap()).toBe(true);
  });

  it("Stay here closes it and resumes the same flight, with no new layout", () => {
    const { flight, model } = flying();
    const before = structuredClone(model.state);
    model.openGalaxyMap();
    expect(model.jump()).toBe(true);
    expect(model.galaxyMapOpen).toBe(false);
    expect(model.state.flight).toBe(flight);
    expect(model.state).toEqual(before);
  });

  it("Jump to another galaxy ends the flight, story progress saved, and starts that galaxy's", () => {
    const { flight, model } = flying();
    model.state.progress[1].known.push("hub");
    flight.tow = { x: flight.player.x + 50, y: flight.player.y };
    model.openGalaxyMap();
    model.stepGalaxy(1);
    expect(model.jump()).toBe(true);
    expect(model.galaxyMapOpen).toBe(false);
    expect(model.state.mode).toBe("space");
    expect(model.state.selectedGalaxy).toBe(3);
    expect(model.state.flight).not.toBe(flight);
    // The tow stays with the flight left behind; the craft waits where it was stranded.
    expect(model.towing).toBe(false);
    expect(model.state.progress[1].known).toContain("hub");
  });

  it("Earth ends the flight and goes home with no sleep scene", () => {
    const { model } = flying();
    model.openGalaxyMap();
    model.leaveCockpit();
    expect(model.galaxyMapOpen).toBe(false);
    expect(model.state.mode).toBe("home");
    expect(model.state.flight).toBeNull();
    const pages = readStory(model);
    expect(pages.some((page) => page.sleep)).toBe(false);
  });

  it("closes to the local map on its close X, back and Escape, the flight unchanged", () => {
    const { flight, model } = flying();
    const before = structuredClone(model.state);
    model.openGalaxyMap();
    model.stepGalaxy(1);
    model.closeGalaxyMap();
    expect(model.galaxyMapOpen).toBe(false);
    expect(model.state.mode).toBe("space");
    expect(model.state.flight).toBe(flight);
    expect(model.state).toEqual(before);
  });

  it("never reopens after a flight ends another way, nor saves its open state", () => {
    const { model } = flying();
    model.openGalaxyMap();
    expect(relaunch(CONTENT, model.save()).galaxyMapOpen).toBe(false);
    model.backToTitle();
    model.continueGame();
    readStory(model);
    expect(model.galaxyMapShownInFlight).toBe(false);
    model.jump();
    expect(model.state.mode).toBe("space");
    expect(model.galaxyMapOpen).toBe(false);
  });
});

describe("the galaxy map at boarding", () => {
  /** Ada home from a Sunflower flight with Whirlpool open, read through the rock to the map. */
  const boarded = () => {
    const model = new GameModel(CONTENT);
    model.state.unlocked = [1, 3];
    model.state.prologueSeen = true;
    model.startGalaxy(1);
    playOpening(model);
    model.state.flight!.dangerFor = 0;
    model.returnHome();
    const pages = readStory(model);
    return { model, pages };
  };

  it("closes one step back to the Welcome back page, whose Previous returns to Ada's room", () => {
    const { model, pages } = boarded();
    expect(pages.map(({ id }) => id).slice(-3)).toEqual(["room", "boarding:0", "boarding:1"]);
    expect(model.screen).toBe("selector");
    model.stepGalaxy(-1);
    model.closeGalaxyMap();
    expect(model.screen).toBe("story");
    expect(model.state.mode).toBe("home");
    expect(model.galaxyMapOpen).toBe(false);
    expect(model.storyView?.page).toMatchObject({
      id: "boarding:1",
      text: "Welcome back, Navigator.",
    });
    expect(model.storyView?.canGoBack).toBe(true);
    // Next opens the map again on the farthest unlocked galaxy.
    model.storyNext();
    expect(model.screen).toBe("selector");
    expect(model.shipPosition).toBe(ROUTE_POSITION[3]);
    model.closeGalaxyMap();
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("boarding:0");
    model.storyPrevious();
    expect(model.roomPage).toBe(true);
  });

  it("is reached from Continue without a saved flight through Ada's room page", () => {
    const { model } = boarded();
    model.closeGalaxyMap();
    model.storyPrevious();
    model.storyPrevious();
    model.backToTitle();
    const launched = relaunch(CONTENT, model.save());
    launched.continueGame();
    expect(launched.roomPage).toBe(true);
    launched.storyNext();
    expect(launched.storyView?.page.id).toBe("boarding:0");
    launched.storyNext();
    expect(launched.storyView?.page.text).toBe("Welcome back, Navigator.");
    launched.storyNext();
    expect(launched.screen).toBe("selector");
    expect(launched.shipPosition).toBe(ROUTE_POSITION[3]);
    launched.closeGalaxyMap();
    expect(launched.storyView?.page.text).toBe("Welcome back, Navigator.");
    launched.storyPrevious();
    launched.storyPrevious();
    expect(launched.roomPage).toBe(true);
  });
});
