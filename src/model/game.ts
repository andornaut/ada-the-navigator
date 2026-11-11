import { ECONOMY } from "../data/economy.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import type { PrototypeContent, SectorId, Weapon } from "../data/types.ts";
import {
  activateRouteEncounter,
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  ensureStation,
  placeDestinationAhead,
  routeBlocked,
  settleRouteEncounters,
  stepFlight,
  syncFlightRegion,
  teleport as teleportFlight,
  undockFlight,
} from "./flight.ts";
import { restoreSave } from "./save.ts";
import {
  buy,
  fill,
  type PurchaseRequest,
  type PurchaseResult,
  requestPurchase,
  selectPaint,
  type ShopItem,
  type ShopRow,
  shopRows,
  type ShopTab,
  weaponName,
} from "./shop.ts";
import type { FlightInput, GameState, SectorProgress } from "./types.ts";
import { newEconomy, shipTuning } from "./upgrades.ts";
import {
  loseEquippedWeapon,
  ownedForSave,
  ownedWeapons,
  selectFlightWeapon,
  type WeaponChoice,
  weaponsLocked,
} from "./weapons.ts";

export function newProgress(): SectorProgress {
  return {
    deposited: 0,
    disabledEnemies: 0,
    discoveries: 0,
    holodisk: false,
    introduced: false,
    known: [],
    questComplete: false,
    questItem: null,
    resolved: false,
    stage: 0,
    stations: [],
  };
}
const progress = newProgress;
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
      announceGalaxy: false,
      dialogue: null,
      docked: null,
      economy: newEconomy(ECONOMY),
      flight: null,
      mode: "home",
      notice: "",
      progress: { 1: progress(), 2: progress(), 3: progress() },
      prologueSeen: false,
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
    // After the space quest, recovering the holodisk comes before the return home.
    const last = this.chapter.objectives.length - 1;
    const index = p.questComplete
      ? last - (p.holodisk ? 0 : 1)
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
  weapons(): WeaponChoice[] {
    return this.state.mode === "space" && this.state.flight ? ownedWeapons(this.state.flight) : [];
  }
  /** A change refused by the weapon lock shows the weaponLocked notice. */
  selectWeapon(weapon: Weapon): boolean {
    const flight = this.state.flight;
    if (this.state.mode !== "space" || this.state.dialogue || this.state.docked || !flight) {
      return false;
    }
    if (
      weapon !== flight.weapon &&
      weaponsLocked(flight) &&
      ownedWeapons(flight).some((choice) => choice.id === weapon)
    ) {
      this.state.notice = this.label("weaponLocked");
      return false;
    }
    const selected = selectFlightWeapon(weapon, flight);
    this.pullLoadout();
    return selected;
  }
  destinations(): { id: string; label: string }[] {
    return [
      ...this.current.known.map((id) => ({
        id,
        label: this.chapter.dialogue[dialogueKeys[id] ?? id]?.speaker ?? this.chapter.name,
      })),
      ...this.current.stations.map((id) => ({ id, label: this.label("station") })),
    ];
  }
  /** Ada's shield capacity with bought upgrades. */
  get shieldMax(): number {
    const levels = this.state.flight?.levels ?? this.state.economy.levels;
    return shipTuning(ECONOMY, this.content, levels).shieldMax;
  }
  /** During a flight its loadout is authoritative; the economy mirrors it. */
  private pullLoadout(): void {
    const flight = this.state.flight;
    if (!flight) {
      return;
    }
    const economy = this.state.economy;
    const owned = ownedForSave(flight);
    economy.ownedWeapons = owned;
    // A granted weapon in use saves as the last real selection that is still owned.
    if (flight.weapon === "basic" || owned.includes(flight.weapon)) {
      economy.weapon = flight.weapon;
    } else if (economy.weapon !== "basic" && !owned.includes(economy.weapon)) {
      economy.weapon = "basic";
    }
    economy.levels = structuredClone(flight.levels);
  }
  /** Purchases change the economy, which then refreshes the flight's loadout. */
  private pushLoadout(): void {
    const flight = this.state.flight;
    if (!flight) {
      return;
    }
    const economy = this.state.economy;
    const before = shipTuning(ECONOMY, this.content, flight.levels).shieldMax;
    // A bought weapon stops being granted; other granted weapons stay for the flight.
    const granted = (flight.grantedWeapons ?? []).filter(
      (weapon) => !economy.ownedWeapons.includes(weapon),
    );
    flight.ownedWeapons = [...economy.ownedWeapons, ...granted];
    if (granted.length) {
      flight.grantedWeapons = granted;
    } else {
      delete flight.grantedWeapons;
    }
    flight.levels = structuredClone(economy.levels);
    // A bought shield level adds its capacity to the current charge.
    const after = shipTuning(ECONOMY, this.content, flight.levels).shieldMax;
    flight.shield = Math.min(after, flight.shield + Math.max(0, after - before));
  }
  shopRows(tab: ShopTab): ShopRow[] {
    this.pullLoadout();
    return shopRows(ECONOMY, this.state.economy, tab);
  }
  requestPurchase(item: ShopItem): PurchaseRequest {
    this.pullLoadout();
    return requestPurchase(ECONOMY, this.state.economy, item);
  }
  /** Purchases happen only while docked. */
  buy(item: ShopItem): PurchaseResult {
    if (!this.state.docked) {
      return { kind: "refused", reason: "notForSale" };
    }
    this.pullLoadout();
    const result = buy(ECONOMY, item, this.state.economy);
    this.pushLoadout();
    return result;
  }
  selectPaint(scheme: string): boolean {
    return selectPaint(ECONOMY, scheme, this.state.economy);
  }
  undock(): void {
    const id = this.state.docked;
    if (id && this.state.flight) {
      undockFlight(this.content, id, this.state.flight);
    }
    this.state.docked = null;
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
    this.state.flight = createFlight(
      this.content,
      this.state.selectedSector,
      seed,
      this.current,
      this.state.economy,
    );
    this.state.mode = "space";
    this.state.dialogue = null;
    this.state.docked = null;
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
    this.pullLoadout();
    this.previousSeed = this.state.flight?.seed ?? this.previousSeed;
    this.state.mode = "home";
    this.state.flight = null;
    this.state.dialogue = null;
    this.state.docked = null;
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
    const station = this.current.stations.includes(id);
    if (
      !f ||
      this.state.mode !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      !(this.current.known.includes(id) || station)
    ) {
      return;
    }
    if (this.inDanger) {
      this.state.notice = this.label("travelUnavailable");
      return;
    }
    if (station) {
      ensureStation(this.content, id, f);
    } else {
      ensureDestination(this.content, id, f);
    }
    teleportFlight(this.content, id, f);
  }
  /**
   * Shield depletion quantum jumps Ada home: the flight ends, the equipped weapon and
   * its levels are lost unless it is Basic, and recharging costs a flat fee.
   */
  private jumpHome(): void {
    const flight = this.state.flight;
    if (!flight) {
      return;
    }
    // Losing a run-only granted weapon loses nothing saved, so the notice omits it.
    const equipped = flight.weapon;
    const granted = equipped !== "basic" && (flight.grantedWeapons ?? []).includes(equipped);
    const lost = loseEquippedWeapon(flight);
    this.pullLoadout();
    const economy = this.state.economy;
    const fee = Math.min(ECONOMY.jumpFee, economy.stardust);
    economy.stardust -= fee;
    this.home(true);
    this.state.notice = [
      this.label("jumpHome"),
      lost && !granted
        ? fill(this.label("jumpWeaponLost"), { weapon: weaponName(this.content.labels, lost) })
        : "",
      fee > 0 ? fill(this.label("jumpRecharge"), { amount: fee }) : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  private complete(): void {
    this.current.questComplete = true;
    if (this.current.holodisk) {
      this.state.notice = this.label("chapterComplete");
    }
  }
  /** Unlocks the next galaxy once its holodisk, space quest and home resolution are done. */
  private unlockNext(): void {
    const p = this.current;
    const next = this.state.selectedSector + 1;
    if (
      p.holodisk &&
      p.questComplete &&
      p.resolved &&
      next <= 3 &&
      !this.state.unlocked.includes(next as SectorId)
    ) {
      this.state.unlocked.push(next as SectorId);
      // Galaxy four's story is in development, so only a galaxy with a story is announced.
      this.state.announceGalaxy = Object.hasOwn(this.content.chapters, next);
    }
  }
  /**
   * Ada inserts a recovered holodisk into Astra's drive at once; `giver` names the outpost
   * that hands it over first.
   */
  private recoverHolodisk(giver?: string): void {
    const p = this.current;
    p.holodisk = true;
    const f = this.state.flight;
    if (f) {
      f.objects = f.objects.filter(
        (object) => !(object.kind === "destination" && object.id === "holodisk"),
      );
    }
    this.unlockNext();
    if (p.questComplete) {
      this.state.notice = this.label("chapterComplete");
    }
    if (giver) {
      this.panel("holodiskHandover", this.content.premise.holodisk.handover, giver);
    } else {
      this.insertion(0);
    }
  }
  /** The insertion panels, then Astra's memory line for the current galaxy. */
  private insertion(index: number): void {
    const { inserted, memories } = this.content.premise.holodisk;
    // Astra, who speaks the last insertion line, continues with the memory.
    const memory = { speaker: inserted.at(-1)?.speaker, text: memories[this.state.selectedSector] };
    const lines = [...inserted, memory];
    const line = lines[index];
    if (line) {
      this.panel(`holodisk:${index}`, line.text, line.speaker);
    } else {
      this.state.dialogue = null;
    }
  }
  /** The hub's holodisk confirm; while Ada is short of Stardust, Buy refuses. */
  private offerHolodisk(): void {
    const price = HOLODISKS.hubPrice;
    const left = this.state.economy.stardust - price;
    this.state.dialogue = {
      choices: [
        { id: "buy", label: this.label("confirmBuy"), ...(left < 0 ? { refused: true } : {}) },
        { id: "cancel", label: this.label("confirmCancel") },
      ],
      context: "holodiskOffer",
      text: [
        fill(this.label("stardustAmount"), { amount: price }),
        left < 0 ? "" : fill(this.label("confirmLeft"), { amount: left }),
      ]
        .filter(Boolean)
        .join("\n"),
      title: fill(this.label("confirmTitle"), { name: this.content.premise.holodisk.name }),
    };
  }
  /** Buys the hub's holodisk; a balance short of the price refuses and keeps the confirm. */
  buyHolodisk(): boolean {
    const economy = this.state.economy;
    if (
      this.state.dialogue?.context !== "holodiskOffer" ||
      this.current.holodisk ||
      economy.stardust < HOLODISKS.hubPrice
    ) {
      return false;
    }
    economy.stardust -= HOLODISKS.hubPrice;
    this.recoverHolodisk();
    return true;
  }
  step(dt: number, input: FlightInput): void {
    const f = this.state.flight;
    if (
      !f ||
      this.state.mode !== "space" ||
      this.state.dialogue ||
      this.state.docked ||
      !Number.isFinite(dt) ||
      dt <= 0
    ) {
      return;
    }
    this.ensureRequiredApproaches();
    const previousFreshDistance = f.freshDistance;
    const events = stepFlight(this.content, dt, input, f);
    this.pullLoadout();
    for (const event of events) {
      if (event.type === "depleted") {
        this.jumpHome();
        return;
      }
      if (event.type === "stardust") {
        this.state.economy.stardust += event.amount;
      }
      if (event.type === "stationDiscovered" && !this.current.stations.includes(event.id)) {
        this.current.stations.push(event.id);
      }
      if (event.type === "docked") {
        this.state.docked = event.id;
      }
      if (event.type === "enemyDisabled") {
        this.current.disabledEnemies++;
      }
      // Reaching the guarded holodisk recovers it; it never becomes a travel destination.
      if (event.type === "discovered" && event.id === "holodisk") {
        if (this.holodiskWaypoint) {
          this.recoverHolodisk();
        }
        continue;
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
    if (this.holodiskWaypoint) {
      ensureDestination(this.content, "holodisk", f);
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
  /** After the reunion, the whale's family gives Ada a waypoint to galaxy three's holodisk. */
  private get holodiskWaypoint(): boolean {
    return this.state.flight?.sector === 3 && this.current.questComplete && !this.current.holodisk;
  }
  private ensureRequiredApproaches(): void {
    const f = this.state.flight;
    if (!f || (this.current.questComplete && !this.holodiskWaypoint)) {
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
    syncFlightRegion(this.content, f);
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
    const destination = f.objects.find(
      (object) => object.kind === "destination" && object.id === id,
    );
    if (destination) {
      destination.persistent = true;
    }
    const p = this.current;
    if (f.sector === 1) {
      // Once their exchange is running, any outpost gives Ada the holodisk.
      if (p.questComplete && !p.holodisk) {
        this.recoverHolodisk(this.chapter.dialogue[dialogueKeys[id] ?? id]?.speaker);
      } else if (id === "growers" && p.stage === 1) {
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
      if (id === "hub" && p.questComplete && !p.holodisk) {
        p.deposited += f.cargo;
        f.cargo = 0;
        this.offerHolodisk();
      } else if (id === "hub") {
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
      if (this.state.prologueSeen) {
        this.boarding(0);
      } else {
        this.prologue(0, 0);
      }
      return;
    }
    const boarding = /^boarding:(\d+)$/.exec(dialogue.context);
    if (boarding) {
      this.boarding(Number(boarding[1]) + 1);
      return;
    }
    const prologue = /^prologue(-answer)?:(\d+):(\d+)$/.exec(dialogue.context);
    if (prologue) {
      this.continuePrologue(Boolean(prologue[1]), Number(prologue[2]), Number(prologue[3]), id);
      return;
    }
    if (dialogue.context === "resolution") {
      this.current.resolved = true;
      this.unlockNext();
      this.panel("closing", this.chapter.closing);
      return;
    }
    if (dialogue.context === "holodiskOffer" && id === "buy") {
      this.buyHolodisk();
      return;
    }
    if (dialogue.context === "holodiskHandover") {
      this.insertion(0);
      return;
    }
    const inserted = /^holodisk:(\d+)$/.exec(dialogue.context);
    if (inserted) {
      this.insertion(Number(inserted[1]) + 1);
      return;
    }
    this.state.dialogue = null;
  }
  /**
   * Shows prologue step `index`. `asked` is a bit mask of the step's optional questions
   * already answered, which leave its choices.
   */
  private prologue(index: number, asked: number): void {
    const step = this.content.premise.prologue[index];
    if (!step) {
      return;
    }
    const questions = (step.questions ?? [])
      .map(({ question }, i) => ({ id: `ask:${i}`, label: question }))
      .filter((_, i) => (asked & (1 << i)) === 0);
    this.state.dialogue = {
      choices: [...questions, { id: "continue", label: step.choice ?? this.label("continue") }],
      context: `prologue:${index}:${asked}`,
      text: step.text,
      title: step.speaker ?? this.content.premise.title,
    };
  }
  /** Shows boarding panel `index`, then jumps after the last. */
  private boarding(index: number): void {
    const { boarding, boardingNewGalaxy } = this.content.premise;
    let line = boarding[index];
    // The first boarding after a galaxy unlocks announces it once, in place of the last line.
    if (line && index === boarding.length - 1 && this.state.announceGalaxy) {
      line = boardingNewGalaxy;
      this.state.announceGalaxy = false;
    }
    if (line) {
      this.panel(`boarding:${index}`, line.text, line.speaker ?? this.content.premise.title);
    } else {
      this.launch();
    }
  }
  private continuePrologue(answer: boolean, index: number, asked: number, id: string): void {
    const steps = this.content.premise.prologue;
    const step = steps[index];
    const question = /^ask:(\d+)$/.exec(id);
    const answered = question ? step?.questions?.[Number(question[1])] : undefined;
    if (!step) {
      this.state.dialogue = null;
    } else if (answer) {
      this.prologue(index, asked);
    } else if (answered && question) {
      this.state.dialogue = {
        choices: [{ id: "continue", label: this.label("continue") }],
        context: `prologue-answer:${index}:${asked | (1 << Number(question[1]))}`,
        text: answered.answer,
        title: step.speaker ?? this.content.premise.title,
      };
    } else if (index + 1 < steps.length) {
      this.prologue(index + 1, 0);
    } else {
      this.state.prologueSeen = true;
      this.launch();
    }
  }
  save(): string {
    this.pullLoadout();
    return JSON.stringify(this.state);
  }
}
