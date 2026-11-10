import type { PrototypeContent, SectorId } from "../data/types.ts";
import {
  activateRouteEncounter,
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  placeDestinationAhead,
  routeBlocked,
  settleRouteEncounters,
  stepFlight,
  teleport as teleportFlight,
} from "./flight.ts";
import { restoreSave } from "./save.ts";
import type { FlightInput, GameState, SectorProgress } from "./types.ts";

function progress(): SectorProgress {
  return {
    deposited: 0,
    disabledEnemies: 0,
    discoveries: 0,
    introduced: false,
    known: [],
    questComplete: false,
    questItem: null,
    resolved: false,
    stage: 0,
  };
}
const first = { 1: "growers", 2: "hub", 3: "whale" } as const;
const required: Record<SectorId, readonly string[]> = {
  1: ["growers", "workshop", "salvagers", "workshop"],
  2: ["hub", "hub", "miner", "visitors", "hub"],
  3: ["whale", "whale", "whale", "family", "whale"],
};
const dialogueKeys: Record<string, string> = { growers: "grower", salvagers: "salvager" };

export class GameModel {
  readonly state: GameState;
  private readonly content: PrototypeContent;
  private previousSeed = 0;
  constructor(content: PrototypeContent, saved?: unknown) {
    this.content = content;
    this.state = restoreSave(saved) ?? {
      dialogue: null,
      flight: null,
      mode: "home",
      notice: "",
      progress: { 1: progress(), 2: progress(), 3: progress() },
      selectedSector: 1,
      unlocked: [1],
      version: 1,
    };
  }
  private get current(): SectorProgress {
    return this.state.progress[this.state.selectedSector];
  }
  private get chapter() {
    return this.content.chapters[this.state.selectedSector];
  }
  private label(id: string): string {
    return this.content.labels[id] ?? "";
  }
  get inDanger(): boolean {
    return (this.state.flight?.dangerFor ?? 0) > 0;
  }
  get objective(): string {
    const p = this.current;
    const stages: Record<SectorId, readonly number[]> = {
      1: [0, 1, 2, 3, 4],
      2: [0, 1, 2, 3, 4, 5],
      3: [0, 1, 2, 3, 4, 5],
    };
    const index = p.questComplete
      ? this.chapter.objectives.length - 1
      : (stages[this.state.selectedSector][p.stage] ?? 0);
    return this.chapter.objectives[index] ?? "";
  }
  private nearest(): string | undefined {
    const f = this.state.flight;
    if (!f || this.state.mode !== "space" || this.state.dialogue) {
      return undefined;
    }
    return f.objects
      .filter(
        (o) =>
          o.kind === "destination" &&
          this.current.known.includes(o.id) &&
          !routeBlocked(o.id, f) &&
          Math.hypot(o.x - f.player.x, o.y - f.player.y) <= this.content.tuning.safeRadius,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - f.player.x, a.y - f.player.y) -
          Math.hypot(b.x - f.player.x, b.y - f.player.y),
      )[0]?.id;
  }
  get contextLabel(): string | undefined {
    const id = this.nearest();
    if (!id) {
      return undefined;
    }
    if (id === "hub" && (this.state.flight?.cargo ?? 0) > 0) {
      return this.label("deposit");
    }
    if ((id === "workshop" || id === "salvagers") && this.current.questItem) {
      return this.label("deliver");
    }
    return this.label("talk");
  }
  destinations(): { id: string; label: string }[] {
    return this.current.known.map((id) => ({
      id,
      label: this.chapter.dialogue[dialogueKeys[id] ?? id]?.speaker ?? this.chapter.name,
    }));
  }
  private panel(context: string, text: string, title = this.chapter.name): void {
    this.state.dialogue = {
      choices: [{ id: "continue", label: this.label("continue") }],
      context,
      text,
      title,
    };
  }
  private exchange(key: string): void {
    const entry = this.chapter.dialogue[key];
    if (!entry) {
      return;
    }
    this.panel(key, entry.text, entry.speaker);
    if (entry.optional && this.label("askMore")) {
      this.state.dialogue?.choices.unshift({ id: "optional", label: this.label("askMore") });
    }
  }
  private launch(): void {
    this.current.questItem = null;
    const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    const seed = randomSeed === this.previousSeed ? (randomSeed + 1) >>> 0 : randomSeed;
    this.previousSeed = seed;
    this.state.flight = createFlight(this.content, this.state.selectedSector, seed, this.current);
    this.state.mode = "space";
    this.state.dialogue = null;
    for (const id of this.current.known) {
      ensureDestination(this.content, id, this.state.flight);
    }
    this.ensureWhaleDebris();
  }
  startSector(id: SectorId): void {
    if (!this.state.unlocked.includes(id) || this.state.mode === "space") {
      return;
    }
    this.state.selectedSector = id;
    if (this.current.stage > 0 || this.current.introduced || this.current.resolved) {
      this.launch();
      return;
    }
    this.state.dialogue = {
      choices: this.chapter.openingChoices.map((label, i) => ({ id: String(i), label })),
      context: "opening",
      text: this.chapter.opening,
      title: this.chapter.name,
    };
  }
  private home(forced: boolean): void {
    if (!forced && this.inDanger) {
      this.state.notice = this.label("travelUnavailable");
      return;
    }
    this.current.questItem = null;
    this.previousSeed = this.state.flight?.seed ?? this.previousSeed;
    this.state.mode = "home";
    this.state.flight = null;
    this.state.dialogue = null;
    if (this.current.questComplete && !this.current.resolved) {
      this.state.dialogue = {
        choices: this.chapter.resolutionChoices.map((label, i) => ({ id: String(i), label })),
        context: "resolution",
        text: this.chapter.resolution,
        title: this.chapter.name,
      };
    }
  }
  returnHome(): void {
    this.home(false);
  }
  teleport(id: string): void {
    const f = this.state.flight;
    if (
      !f ||
      this.state.mode !== "space" ||
      this.state.dialogue ||
      !this.current.known.includes(id)
    ) {
      return;
    }
    if (this.inDanger) {
      this.state.notice = this.label("travelUnavailable");
      return;
    }
    ensureDestination(this.content, id, f);
    teleportFlight(this.content, id, f);
  }
  private complete(): void {
    this.current.questComplete = true;
    this.state.notice = this.label("chapterComplete");
  }
  step(dt: number, input: FlightInput): void {
    const f = this.state.flight;
    if (
      !f ||
      this.state.mode !== "space" ||
      this.state.dialogue ||
      !Number.isFinite(dt) ||
      dt <= 0
    ) {
      return;
    }
    this.ensureRequiredApproaches();
    const previousFreshDistance = f.freshDistance;
    for (const event of stepFlight(this.content, dt, input, f)) {
      if (event.type === "depleted") {
        this.home(true);
        this.state.notice = this.label("shieldDepleted");
        return;
      }
      if (event.type === "enemyDisabled") {
        this.current.disabledEnemies++;
      }
      if (event.type === "discovered" && !this.current.known.includes(event.id)) {
        this.current.known.push(event.id);
        this.current.discoveries++;
      }
      if (
        event.type === "debrisCleared" &&
        f.sector === 3 &&
        this.current.stage <= 1 &&
        !f.objects.some((o) => o.id.startsWith("whale-debris:") && o.hp > 0)
      ) {
        this.current.stage = 2;
      }
    }
    if (!this.current.introduced && f.freshDistance >= this.content.tuning.introFreshDistance) {
      ensureDestination(this.content, first[f.sector], f);
      if (
        f.freshDistance > previousFreshDistance &&
        !this.current.known.includes(first[f.sector])
      ) {
        this.placePending(first[f.sector]);
      }
    }
    if (
      this.current.introduced &&
      !this.current.questComplete &&
      f.freshDistance >=
        this.content.tuning.introFreshDistance +
          this.current.stage * this.content.tuning.encounterFreshDistance
    ) {
      const id = required[f.sector][this.current.stage];
      if (id) {
        ensureDestination(this.content, id, f);
        if (f.freshDistance > previousFreshDistance && !this.current.known.includes(id)) {
          this.placePending(id);
        }
      }
    }
    this.ensureRequiredApproaches();
    this.ensureWhaleDebris();
    const intro = first[f.sector];
    if (
      !this.current.introduced &&
      this.current.known.includes(intro) &&
      this.nearest() === intro
    ) {
      this.current.introduced = true;
      this.current.stage = Math.max(1, this.current.stage);
      if (f.sector === 1) {
        this.current.questItem = "food";
      }
      this.ensureWhaleDebris();
      if (f.sector === 3 && this.current.stage === 2) {
        this.current.stage = 3;
        this.exchange("freed");
      } else {
        this.exchange(f.sector === 1 ? "grower" : intro);
      }
    } else if (input.use) {
      this.interact();
    }
  }
  private ensureRequiredApproaches(): void {
    const f = this.state.flight;
    if (!f || this.current.questComplete) {
      return;
    }
    for (const object of [...f.objects]) {
      if (object.kind === "destination" && !this.current.known.includes(object.id)) {
        ensureRouteEncounter(this.content, object.id, f);
      }
    }
  }
  private placePending(id: string): void {
    const f = this.state.flight;
    if (!f) {
      return;
    }
    activateRouteEncounter(this.content, id, f);
    const old = f.objects.find((o) => o.id === id);
    const before = old ? { x: old.x, y: old.y } : null;
    const debris = id === "whale" ? f.objects.filter((o) => o.id.startsWith("whale-debris:")) : [];
    const destination = placeDestinationAhead(this.content, id, f);
    if (before) {
      for (const guard of f.objects.filter((object) => object.routeId === id)) {
        const dx = destination.x - before.x;
        const dy = destination.y - before.y;
        guard.x += dx;
        guard.y += dy;
        if (guard.enemy) {
          guard.enemy.position.x += dx;
          guard.enemy.position.y += dy;
          guard.enemy.home.x += dx;
          guard.enemy.home.y += dy;
        }
      }
      for (const object of debris) {
        object.x += destination.x - before.x;
        object.y += destination.y - before.y;
        if (!f.objects.includes(object)) {
          f.objects.push(object);
        }
      }
      if (destination.x !== before.x || destination.y !== before.y) {
        settleRouteEncounters(this.content, f);
      }
    }
  }
  private ensureWhaleDebris(): void {
    const f = this.state.flight;
    if (!f || f.sector !== 3 || this.current.stage >= 2) {
      return;
    }
    const whale = f.objects.find((o) => o.id === "whale");
    if (!whale || f.objects.some((o) => o.id.startsWith("whale-debris:"))) {
      return;
    }
    const tuning = this.content.tuning.whaleDebris;
    for (let i = 0; i < tuning.count; i++) {
      const angle = (i * Math.PI * 2) / tuning.count;
      f.objects.push({
        hp: tuning.hp,
        id: `whale-debris:${i}`,
        kind: "debris",
        radius: tuning.radius,
        x: whale.x + Math.cos(angle) * tuning.spacing,
        y: whale.y + Math.sin(angle) * tuning.spacing,
      });
    }
  }
  interact(): void {
    const id = this.nearest();
    const f = this.state.flight;
    if (!id || !f) {
      return;
    }
    const p = this.current;
    if (f.sector === 1) {
      if (id === "growers" && p.stage === 1) {
        p.questItem = "food";
        this.exchange("grower");
      } else if (id === "workshop" && p.stage === 1 && p.questItem === "food") {
        p.stage = 2;
        p.questItem = "toolkit";
        this.exchange("workshop");
      } else if (id === "workshop" && p.stage === 2) {
        p.questItem = "toolkit";
        this.exchange("workshop");
      } else if (id === "salvagers" && p.stage === 2 && p.questItem === "toolkit") {
        p.stage = 3;
        p.questItem = "parts";
        this.exchange("salvager");
      } else if (id === "salvagers" && p.stage === 3) {
        p.questItem = "parts";
        this.exchange("salvager");
      } else if (id === "workshop" && p.stage === 3 && p.questItem === "parts") {
        p.stage = 4;
        p.questItem = null;
        this.complete();
        this.exchange("deliveryComplete");
      } else {
        this.exchange(dialogueKeys[id] ?? id);
      }
    } else if (f.sector === 2) {
      if (id === "hub") {
        p.deposited += f.cargo;
        f.cargo = 0;
        const [a, b, c] = this.content.tuning.miningMilestones;
        if (p.stage === 1 && p.deposited >= a) {
          p.stage = 2;
          this.exchange("firstDeposit");
        } else if (p.stage === 4 && p.deposited >= c) {
          p.stage = 5;
          this.complete();
          this.exchange("approach");
        } else {
          this.exchange("hub");
        }
        if (p.stage === 2 && p.deposited >= b) {
          ensureDestination(this.content, "miner", f);
        }
      } else if (
        id === "miner" &&
        p.stage === 2 &&
        p.deposited >= this.content.tuning.miningMilestones[1]
      ) {
        p.stage = 3;
        this.exchange("miner");
      } else if (id === "visitors" && p.stage === 3) {
        p.stage = 4;
        this.exchange("visitors");
      } else {
        this.exchange(id);
      }
    } else if (id === "whale" && p.stage === 1) {
      this.exchange("trapped");
    } else if (id === "whale" && p.stage === 2) {
      p.stage = 3;
      this.exchange("freed");
    } else if (id === "family" && p.stage === 3) {
      p.stage = 4;
      this.exchange("family");
    } else if (id === "whale" && p.stage === 4) {
      p.stage = 5;
      this.complete();
      this.exchange("reunion");
    } else {
      this.exchange(id);
    }
  }
  choose(id: string): void {
    const dialogue = this.state.dialogue;
    if (!dialogue || !dialogue.choices.some((c) => c.id === id)) {
      return;
    }
    if (id === "optional") {
      const entry = this.chapter.dialogue[dialogue.context];
      if (entry?.optional) {
        this.panel(dialogue.context, entry.optional, entry.speaker);
      }
      return;
    }
    if (dialogue.context === "opening") {
      this.launch();
      return;
    }
    if (dialogue.context === "resolution") {
      this.current.resolved = true;
      const next = this.state.selectedSector + 1;
      if (next <= 3 && !this.state.unlocked.includes(next as SectorId)) {
        this.state.unlocked.push(next as SectorId);
      }
      this.panel("closing", this.chapter.closing);
      return;
    }
    this.state.dialogue = null;
  }
  save(): string {
    return JSON.stringify(this.state);
  }
}
