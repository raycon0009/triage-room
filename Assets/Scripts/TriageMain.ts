/**
 * TriageMain.ts - Triage Room, build step 1 orchestrator (room, four casualties, Start, scenario line).
 * Owns: run creation (seeded), building the room shell and casualty figures, Start handling.
 * Expects @inputs wired by the scene bootstrap (see References). The object carrying this script is the
 * room root: its Y position is the FLOOR height (about -150 cm below the eyes); x/z origin = start position.
 * Public API for tests: getRunState(), startRun(), isStarted(), regenerate(seed, forceBlack), onRunStarted (Event).
 * Logs "TRIAGE_RUN_STATE {json}" on creation and "TRIAGE_STARTED" when Start is pressed.
 * Must not: author text/UI (UI modules do that) or implement check/START logic (later build steps).
 */
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { TriageStartUI } from "./TriageStartUI"
import { TriageScenarioUI } from "./TriageScenarioUI"
import { CASUALTY_TABLE, CasualtyId } from "./TriageData"
import { ForceBlack, RunLayout, ROOM, generateRun, resolveSeed, validateRun } from "./TriageLayout"
import { TriageFigureBuilder } from "./TriageFigureBuilder"

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
      boxUnitCm: this.boxUnitCm,
      sphereUnitCm: this.sphereUnitCm,
    })
    this.buildRoomShell()
    this.regenerate(this.seed, this.forceBlack)
    this.startUI.onStart.add(() => this.startRun())
  }

  /** (Re)creates the run layout + casualty objects (hidden until Start). */
  regenerate(seed: number, forceBlack: string): RunState {
    const r = resolveSeed(seed, Date.now())
    this.seedFixed = r.fixed
    const fb: ForceBlack = r.fixed && (forceBlack === "on" || forceBlack === "off") ? forceBlack : "auto"
    this.run = generateRun(r.seed, fb)
    this.started = false
    this.buildCasualties()
    this.casualtiesRoot.enabled = false
    const state = this.getRunState()
    print("TRIAGE_RUN_STATE " + JSON.stringify(state))
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
    for (const c of this.run.casualties) {
      this.casualtyObjects[c.id] = this.builder.buildCasualty(this.casualtiesRoot, c.id, c.x, c.z, c.yawDeg, c.needsBackrest, dot)
    }
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
