/**
 * TriageMain.ts - Triage Room, build step 1 orchestrator (room, four casualties, Start, scenario line).
 * Owns: run creation (seeded), building the room shell and casualty figures, Start handling.
 * Expects @inputs wired by the scene bootstrap (see References). The object carrying this script is the
 * room root: its Y position is the FLOOR height (about -150 cm below the eyes); x/z origin = start position.
 * Public API for tests: getRunState(), startRun(), isStarted(), regenerate(seed, forceBlack), restart(), onRunStarted (Event).
 * restart() (step 5): rebuilds everything with a NEW random seed whose cases / slots differ from the last run, and starts
 * it. With a fixed seed set (or "Use demo seed") a restart repeats that fixed layout - that is what a fixed seed means.
 * Logs "TRIAGE_RUN_STATE {json}" on creation and "TRIAGE_STARTED" when Start is pressed.
 * Must not: author text/UI (UI modules do that) or implement check/START logic (later build steps).
 */
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { TriageStartUI } from "./TriageStartUI"
import { TriageScenarioUI } from "./TriageScenarioUI"
import { CASUALTY_TABLE, CasualtyId } from "./TriageData"
import { DEMO_SEED, ForceBlack, RunLayout, ROOM, generateRun, layoutSignature, resolveSeed, validateRun } from "./TriageLayout"
import { TriageFigureBuilder } from "./TriageFigureBuilder"
import { lookFor } from "./TriageFigurePose"

export interface CasualtyState {
  id: CasualtyId
  sceneObjectName: string
  slot: string
  behind: boolean
  walks: boolean
  correctTag: string
  pose: string
  /** world-space cm */
  position: { x: number; y: number; z: number }
  /** floor-relative cm */
  floorPosition: { x: number; z: number }
}

export interface RunState {
  started: boolean
  seed: number
  seedFixed: boolean
  forceBlack: string
  blackIncluded: boolean
  behindId: string
  walkerId: string
  casualties: CasualtyState[]
  minorZone: { x: number; z: number; diameterCm: number }
  violations: string[]
}

@component
export class TriageMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageMain - room, casualties, Start (step 1)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Start panel UI module")
  startUI!: TriageStartUI
  @input
  @hint("Scenario line UI module")
  scenarioUI!: TriageScenarioUI
  @input
  @hint("Empty object that holds the runtime-built casualties")
  casualtiesRoot!: SceneObject
  @input
  @hint("Empty object that holds the runtime-built room shell (outline + wall)")
  roomShellRoot!: SceneObject
  @input
  @hint("Box RenderMesh primitive")
  boxMesh!: RenderMesh
  @input
  @hint("Sphere RenderMesh primitive")
  sphereMesh!: RenderMesh
  @input
  @hint("Unlit material used (cloned and tinted) for figures and room shell")
  figureMaterial!: Material
  @input
  @hint("Lit material for the casualty figures: Uber PBR with Vertex Color = Base Color (soft, matte)")
  litMaterial!: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Layout seed. 0 or negative = random each run; a positive number gives the same layout every time")
  seed: number = 0

  @input
  @widget(new ComboBoxWidget([new ComboBoxItem("auto", "auto"), new ComboBoxItem("on", "on"), new ComboBoxItem("off", "off")]))
  @hint("Black (Expectant) casualty: auto = about 1 run in 3. Only honoured when a fixed seed is set")
  forceBlack: string = "auto"

  @input
  @hint("Demo seed for the video: Black case ON, a walker (W1), a breathing non-walker (D, groaning) behind you to the right, C at the wall, X front-left. Overrides Seed and Black. Layout is documented in devpost/build-log.md")
  useDemoSeed: boolean = false

  @input
  @hint("Scenario line shown after Start")
  scenarioText: string = "A gas cylinder burst in the college canteen. The fire is out. You're the first trained volunteer inside — four people need you."

  @input
  @widget(new SliderWidget(1, 15, 0.5))
  @hint("Seconds the scenario line stays before fading")
  scenarioHoldSeconds: number = 6

  @input
  @widget(new SliderWidget(0.5, 5, 0.5))
  @hint("Seconds the scenario line takes to fade")
  scenarioFadeSeconds: number = 2

  @input
  @hint("Measured size in cm of a scale-1 box primitive")
  boxUnitCm: number = 1

  @input
  @hint("Measured size in cm of a scale-1 sphere primitive")
  sphereUnitCm: number = 1
  @ui.group_end

  private _onRegenerated = new Event<RunState>()
  /** Fires after every (re)generation, once the new casualty objects exist (step 2 cards rebuild on it). */
  get onRegenerated(): PublicApi<RunState> {
    return this._onRegenerated.publicApi()
  }

  private _onRunStarted = new Event<RunState>()
  get onRunStarted(): PublicApi<RunState> {
    return this._onRunStarted.publicApi()
  }

  private run!: RunLayout
  private seedFixed = false
  private started = false
  private builder!: TriageFigureBuilder
  private casualtyObjects: { [id: string]: SceneObject } = {}

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    if (!this.startUI || !this.scenarioUI || !this.casualtiesRoot || !this.roomShellRoot || !this.boxMesh || !this.sphereMesh || !this.figureMaterial) {
      print("TriageMain: required @input not wired - check the scene bootstrap")
      return
    }
    this.builder = new TriageFigureBuilder({
      box: this.boxMesh,
      sphere: this.sphereMesh,
      material: this.figureMaterial,
      litMaterial: this.litMaterial,
      boxUnitCm: this.boxUnitCm,
      sphereUnitCm: this.sphereUnitCm,
    })
    this.buildRoomShell()
    this.regenerate(this.configuredSeed(), this.configuredForceBlack())
    this.startUI.onStart.add(() => this.startRun())
  }

  /** The seed the inspector asks for: the demo seed, or the Seed field (0 = random). */
  configuredSeed(): number {
    return this.useDemoSeed ? DEMO_SEED : this.seed
  }

  configuredForceBlack(): string {
    return this.useDemoSeed ? "on" : this.forceBlack
  }

  /** (Re)creates the run layout + casualty objects (hidden until Start). */
  regenerate(seed: number, forceBlack: string): RunState {
    const r = resolveSeed(seed, Date.now())
    return this.applyRun(r.seed, r.fixed, forceBlack)
  }

  private restartCount = 0

  /**
   * Restart (build step 5): clear everything of the last run (casualties with their dots, bands and groan source are
   * destroyed; cards, clock, call-out, groan / arrow and debrief reset through onRegenerated) and start a new run.
   * No arguments: use the inspector settings - a random seed whose cases / slots differ from the last run, or the
   * fixed / demo seed if one is set. With a seed (tests): that seed, fixed.
   */
  restart(seed?: number, forceBlack?: string): RunState {
    let state: RunState
    if (seed !== undefined) {
      state = this.regenerate(seed, forceBlack || "auto")
    } else if (this.configuredSeed() > 0) {
      state = this.regenerate(this.configuredSeed(), this.configuredForceBlack())
    } else {
      const prev = this.run ? layoutSignature(this.run) : ""
      let pick = 1
      for (let i = 0; i < 40; i++) {
        pick = (Math.floor(Date.now() + i * 104729 + this.restartCount * 7919) % 2147483646) + 1
        if (layoutSignature(generateRun(pick, "auto")) !== prev) break
      }
      this.restartCount++
      state = this.applyRun(pick, false, "auto")
    }
    this.startRun()
    return state
  }

  private applyRun(seedValue: number, fixed: boolean, forceBlack: string): RunState {
    this.seedFixed = fixed
    const fb: ForceBlack = fixed && (forceBlack === "on" || forceBlack === "off") ? forceBlack : "auto"
    this.run = generateRun(seedValue, fb)
    this.started = false
    this.buildCasualties()
    this.casualtiesRoot.enabled = false
    const state = this.getRunState()
    print("TRIAGE_RUN_STATE " + JSON.stringify(state))
    this._onRegenerated.invoke(state)
    return state
  }

  /** Press-Start behaviour (also callable by tests). */
  startRun(): void {
    if (this.started) return
    this.started = true
    this.casualtiesRoot.enabled = true
    this.startUI.hide()
    this.scenarioUI.showScenario(this.scenarioText, this.scenarioHoldSeconds, this.scenarioFadeSeconds)
    print("TRIAGE_STARTED")
    this._onRunStarted.invoke(this.getRunState())
  }

  /** True once the first run layout exists. */
  isReady(): boolean {
    return !!this.run
  }

  /** The builder that made the casualties (the call-out uses it to animate the walker). */
  getFigureBuilder(): TriageFigureBuilder {
    return this.builder
  }

  getCasualtyObject(id: string): SceneObject | null {
    const o = this.casualtyObjects[id]
    return o && !isNull(o) ? o : null
  }

  isStarted(): boolean {
    return this.started
  }

  getRunState(): RunState {
    const rootPos = this.sceneObject.getTransform().getWorldPosition()
    const list: CasualtyState[] = this.run.casualties.map((c) => {
      const def = CASUALTY_TABLE[c.id]
      const obj = this.casualtyObjects[c.id]
      const wp = obj ? obj.getTransform().getWorldPosition() : new vec3(rootPos.x + c.x, rootPos.y, rootPos.z + c.z)
      return {
        id: c.id,
        sceneObjectName: "Casualty_" + c.id,
        slot: c.slot,
        behind: c.behind,
        walks: def.walks,
        correctTag: def.correctTag,
        pose: def.pose,
        position: { x: Math.round(wp.x * 10) / 10, y: Math.round(wp.y * 10) / 10, z: Math.round(wp.z * 10) / 10 },
        floorPosition: { x: c.x, z: c.z },
      }
    })
    return {
      started: this.started,
      seed: this.run.seed,
      seedFixed: this.seedFixed,
      forceBlack: this.run.forceBlack,
      blackIncluded: this.run.blackIncluded,
      behindId: this.run.behindId,
      walkerId: this.run.walkerId,
      casualties: list,
      minorZone: { x: ROOM.minorZone.x, z: ROOM.minorZone.z, diameterCm: ROOM.minorZone.diameterCm },
      violations: validateRun(this.run),
    }
  }

  private buildCasualties(): void {
    for (const id in this.casualtyObjects) {
      const o = this.casualtyObjects[id]
      if (o && !isNull(o)) o.destroy()
    }
    this.casualtyObjects = {}
    const dot = [0.55, 0.95, 1.0]
    // each casualty gets its own clothing colour, skin tone and hair, chosen by the run's seed
    this.run.casualties.forEach((c, i) => {
      const look = lookFor(this.run.seed, i, c.id === "W1")
      this.casualtyObjects[c.id] = this.builder.buildCasualty(this.casualtiesRoot, c.id, c.x, c.z, c.yawDeg, c.needsBackrest, dot, look)
    })
  }

  /** Light play-area outline on the floor + a front wall the seated casualty leans against. */
  private buildRoomShell(): void {
    const edge = [0.5, 0.62, 0.78]
    const hw = ROOM.halfWidth
    const zF = ROOM.frontWallZ
    const zB = ROOM.backZ
    const len = zB - zF
    const midZ = (zF + zB) / 2
    this.builder.createPart(this.roomShellRoot, "OutlineLeft", "box", [-hw, 0.5, midZ], [4, 1, len], edge)
    this.builder.createPart(this.roomShellRoot, "OutlineRight", "box", [hw, 0.5, midZ], [4, 1, len], edge)
    this.builder.createPart(this.roomShellRoot, "OutlineBack", "box", [0, 0.5, zB], [hw * 2, 1, 4], edge)
    this.builder.createPart(this.roomShellRoot, "Wall", "box", [0, 60, zF - 3], [hw * 2, 120, 6], [0.5, 0.58, 0.7])
  }
}
