/**
 * TriageDebrief.ts - the debrief (build steps 4 and 5): end trigger, ONE readable panel, numbered floor map, Restart.
 * Owns:
 *  - the end trigger: when all four casualties are tagged (and a called-out walker has arrived) it waits a moment and
 *    calls TriageRunClock.endRun("all-tagged"). Time's up arrives through the clock's own endRun("time").
 *  - the "Scene clear" button (TriageSceneClear), which ends the run with "scene-clear" when the player says they are done;
 *  - the debrief, opened by TriageRunClock.onRunEnded for any reason (under the summary: when everyone came into view):
 *      * ONE upright panel (UI Kit BackPlate) about 1.2 m in front of the start position, centred slightly below eye
 *        level and small enough to sit fully in view. Top: the summary in two large white lines. Below: one row per
 *        casualty, numbered 1-4; anyone missed is row 1.. with "NOT REACHED" as the biggest, flashing text. A row is
 *        "2 Dazed . 6 s . 0 extra" / "You GREEN  Correct YELLOW" / one short explanation line. Tag words keep their
 *        colour; everything else is white. The smallest text on the panel is at least twice the size of step 4's
 *        explanation lines (58), so the wording is short rather than the text small.
 *      * the flat top-down map on the floor in front of the start position, each casualty a marker at their real
 *        position (scaled down) carrying the same number 1-4 as their row; the start position is marked.
 *      * a flashing "NOT REACHED" over every real casualty who was missed.
 *      * a Restart button at waist height just above the map (pinching it restarts: TriageMain.restart()).
 *  The timer, arrow, groan and open cards are already off at the end (TriageRunClock / TriageBehindCue).
 * Public API (for tests): isOpen(), getReason(), getEntries(), getSummary(), getPanelObject(), getPanelSizeCm(),
 *   getPanelCornersWorld(), getRowTexts(id), getRowTextColour(id, name), getRowTextSize(id, name), getMinTextSize(),
 *   getTextExtents(), getMarkerNumber(id), getMarkerObject(id), getRestartButtonObject(), getFlashLevel(),
 *   isNotReachedFlashing(id), getWorldFlashObject(id), getRetiredCount(), setViewerOverride(position), endGraceSeconds, flashHz.
 * Restart: the old debrief is hidden at once and destroyed 0.5 s later, so the interactor that pinched Restart lets go of
 *   the button before it is destroyed (destroying a targeted Interactable gives "Object is null").
 */
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { TriageMain } from "./TriageMain"
import { TriageCheckCards } from "./TriageCheckCards"
import { TriageRunClock, EndReason } from "./TriageRunClock"
import { TriageCallOut } from "./TriageCallOut"
import { TriageSceneClear } from "./TriageSceneClear"
import { TriageFigureBuilder, TAG_BAND_COLOUR } from "./TriageFigureBuilder"
import { CASUALTY_TABLE } from "./TriageData"
import { ROOM } from "./TriageLayout"
import { DebriefEntry, DebriefSummary, buildEntry, orderRows, summarize } from "./TriageScoring"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { DEBRIEF_SIZES, TEXT_SMALL, addPressPop, clamp01, easeOutCubic, finishMotion, lerp, showPanel } from "./TriageUi"
import {
  COL_B, COL_C, COL_D, COL_YOU_WORD, LEFT, MARGIN, PANEL_W, PAUSE_AFTER_TIMES_UP, REVEAL_FADE_SECONDS, RIGHT,
  RevealStep, layoutPanel, pitch, revealSchedule,
} from "./TriageDebriefLayout"

const TAG_TEXT_COLOUR: { [tag: string]: vec4 } = {
  Red: new vec4(1, 0.45, 0.45, 1),
  Yellow: new vec4(1, 0.92, 0.35, 1),
  Green: new vec4(0.45, 1, 0.55, 1),
  Black: new vec4(1, 1, 1, 1),
}
const WHITE = new vec4(1, 1, 1, 1)
const FLASH_DIM = new vec4(1, 0.3, 0.3, 1) // the flash alternates between this red and white (white = the bright phase)

// ---- panel layout: see TriageDebriefLayout.ts (pure, tested in Node)
const GUTTER_Z = 0.6
/** How long an old debrief stays (hidden) before it is destroyed, so the interactor that pressed Restart lets go first */
const RETIRE_SECONDS = 0.5
/** After "Yes, scene clear" the debrief panel appears this long after the run ends (no Time's up panel) */
const SCENE_CLEAR_PAUSE = 0.6
/** the panel itself fades and scales in over this long once it appears */
const PANEL_IN = 0.26
const PANEL_FROM = 0.92

interface RowParts {
  id: string
  row: number
  texts: { [name: string]: Text }
  sizes: { [name: string]: number }
  colors: { [name: string]: vec4 }
  notReached: Text | null
  worldFlash: SceneObject | null
  worldFlashText: Text | null
  marker: SceneObject | null
  markerNumber: Text | null
  missed: boolean
}

@component
export class TriageDebrief extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageDebrief - debrief panel, map, restart (steps 4-5)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Run orchestrator (room, casualty positions, restart)")
  main!: TriageMain
  @input
  @hint("Check cards (records: tag, time, extra checks)")
  cards!: TriageCheckCards
  @input
  @hint("Run clock (end state: onRunEnded, endRun)")
  clock!: TriageRunClock
  @input
  @hint("Call-out (the end waits until a called-out walker has arrived)")
  callOut!: TriageCallOut
  @input
  @hint("The camera object (things that stand up face the viewer)")
  cameraObject!: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(60, 200, 5))
  @hint("Distance of the map and the panel in front of the start position (cm)")
  mapForwardCm: number = 120

  @input
  @widget(new SliderWidget(0.08, 0.3, 0.01))
  @hint("Map scale: room cm to map cm")
  mapScale: number = 0.16

  @input
  @widget(new SliderWidget(0, 20, 1))
  @hint("How far below eye level the centre of the panel sits (cm)")
  panelDropCm: number = 3

  @input
  @widget(new SliderWidget(0, 3, 0.1))
  @hint("Pause after the last tag before the debrief opens (s)")
  endGraceSeconds: number = 1.2

  @input
  @widget(new SliderWidget(0.5, 6, 0.5))
  @hint("At time's up the Time's up panel is shown alone for this long, then the debrief panel appears (s)")
  timesUpSeconds: number = 2

  @input
  @widget(new SliderWidget(0, 4, 0.1))
  @hint("Flash speed of NOT REACHED (flashes per second). 0 holds it at its bright phase (for a screenshot)")
  flashHz: number = 1.8
  @ui.group_end

  private builder: TriageFigureBuilder | null = null
  private root: SceneObject | null = null
  private map: SceneObject | null = null
  private panel: SceneObject | null = null
  private panelSize = { w: PANEL_W, h: 0 }
  private restartObj: SceneObject | null = null
  private rows: { [id: string]: RowParts } = {}
  private summaryTexts: Text[] = []
  /** the "in view" lines under the summary (when everyone came into view; started before seeing everyone) */
  private viewTexts: Text[] = []
  private viewLines: string[] = []
  private panelTexts: { id: string; name: string; text: Text; size: number; obj: SceneObject }[] = []
  private billboards: SceneObject[] = []
  private entries: DebriefEntry[] = []
  private summary: DebriefSummary | null = null
  private reason: EndReason | null = null
  private open = false
  private sinceOpen = 0
  private graceLeft = -1
  private flash = 1
  private pendingRestart = false
  // reveal (time's up -> pause -> panel -> NOT REACHED rows + marker over the real person -> the other rows one by one)
  private plan: RevealStep[] = []
  private panelAt = 0
  private panelStarted = false
  private revealT = 0
  private revealed: { [key: string]: boolean } = {}
  private revealLog: { kind: string; id: string | null; t: number }[] = []
  private panelPlate: RoundedRectangle | null = null
  private timesUpHidden = false
  private viewerOverride: vec3 | null = null
  private sceneClear: TriageSceneClear | null = null
  /**
   * Old debriefs waiting to be destroyed. clear() hides the old debrief at once but destroys it a moment later: the
   * Restart button inside it is still held by the interactor that just pinched it (a hand's cursor, or LEAF's scripted
   * interactor), and destroying an Interactable while it is targeted makes that interactor touch a dead object
   * ("Object is null"). Disabled, its colliders are off, so the interactor lets go first.
   * destroyAt stays -1 until the first frame after clear(): a restart rebuilds the whole run in that frame (0.3 s or more
   * in the preview) and getTime() does not move during a frame, so a timer set inside it would be used up by the rebuild.
   */
  private retired: { obj: SceneObject; destroyAt: number }[] = []

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private onStart(): void {
    if (!this.main || !this.cards || !this.clock || !this.callOut || !this.cameraObject) {
      print("TriageDebrief: required @input not wired - check the scene bootstrap")
      return
    }
    this.builder = new TriageFigureBuilder({
      box: this.main.boxMesh,
      sphere: this.main.sphereMesh,
      material: this.main.figureMaterial,
      boxUnitCm: this.main.boxUnitCm,
      sphereUnitCm: this.main.sphereUnitCm,
    })
    this.sceneClear = new TriageSceneClear({
      host: this,
      parent: this.sceneObject,
      main: this.main,
      cards: this.cards,
      clock: this.clock,
      callOut: this.callOut,
      cameraObject: this.cameraObject,
    })
    this.clock.onRunEnded.add((r) => this.openDebrief(r))
    this.main.onRegenerated.add(() => this.clear())
    this.main.onRunStarted.add(() => {
      this.graceLeft = -1
    })
  }

  // ------------------------------------------------------------------ public API

  setViewerOverride(p: vec3 | null): void {
    this.viewerOverride = p
  }
  /** The "Scene clear" button and its question (null before the Lens has started). */
  getSceneClear(): TriageSceneClear | null {
    return this.sceneClear
  }
  isOpen(): boolean {
    return this.open
  }
  getReason(): EndReason | null {
    return this.reason
  }
  /** Entries in debrief order (row 1 first; anyone missed first). */
  getEntries(): DebriefEntry[] {
    return this.entries.slice()
  }
  getSummary(): DebriefSummary | null {
    return this.summary
  }
  getMapObject(): SceneObject | null {
    return this.map && !isNull(this.map) ? this.map : null
  }
  getPanelObject(): SceneObject | null {
    return this.panel && !isNull(this.panel) ? this.panel : null
  }
  getPanelSizeCm(): { width: number; height: number } {
    return { width: this.panelSize.w, height: this.panelSize.h }
  }
  /** The four corners of the panel in world space (top-left, top-right, bottom-right, bottom-left). */
  getPanelCornersWorld(): vec3[] {
    const p = this.getPanelObject()
    if (!p) return []
    const t = p.getTransform()
    const c = t.getWorldPosition()
    const rot = t.getWorldRotation()
    const r = rot.multiplyVec3(new vec3(1, 0, 0))
    const u = rot.multiplyVec3(new vec3(0, 1, 0))
    const hw = this.panelSize.w / 2
    const hh = this.panelSize.h / 2
    return [
      c.add(r.uniformScale(-hw)).add(u.uniformScale(hh)),
      c.add(r.uniformScale(hw)).add(u.uniformScale(hh)),
      c.add(r.uniformScale(hw)).add(u.uniformScale(-hh)),
      c.add(r.uniformScale(-hw)).add(u.uniformScale(-hh)),
    ]
  }
  getSummaryLines(): string[] {
    return this.summaryTexts.map((t) => t.text)
  }
  /** The lines under the summary about when everyone came into view (head direction, not eye tracking). */
  getViewLines(): string[] {
    return this.viewTexts.map((t) => t.text)
  }
  /** The text of every line of a casualty's row: number, name, stats, youLabel, youWord, correctLabel, correctWord, explanation, notReached. */
  getRowTexts(id: string): { [name: string]: string } {
    const out: { [name: string]: string } = {}
    const r = this.rows[id]
    if (!r) return out
    for (const k in r.texts) out[k] = r.texts[k].text
    return out
  }
  getRowTextColour(id: string, name: string): vec4 | null {
    const r = this.rows[id]
    return r && r.texts[name] ? r.texts[name].textFill.color : null
  }
  getRowTextSize(id: string, name: string): number {
    const r = this.rows[id]
    return r && r.sizes[name] ? r.sizes[name] : 0
  }
  /** The smallest text size on the panel (summary and all rows). */
  getMinTextSize(): number {
    let m = 1e9
    for (const p of this.panelTexts) m = Math.min(m, p.size)
    return m === 1e9 ? 0 : m
  }
  getMaxTextSize(): number {
    let m = 0
    for (const p of this.panelTexts) m = Math.max(m, p.size)
    return m
  }
  /** Each text's measured box in panel coordinates (cm): for "does everything fit in the panel" checks. */
  getTextExtents(): { id: string; name: string; size: number; left: number; right: number; top: number; bottom: number }[] {
    const out: { id: string; name: string; size: number; left: number; right: number; top: number; bottom: number }[] = []
    if (!this.panel) return out
    const content = this.panel.getChild(0)
    const cy = content.getTransform().getLocalPosition().y
    for (const p of this.panelTexts) {
      if (isNull(p.obj)) continue
      const pos = p.obj.getTransform().getLocalPosition()
      const b = p.text.getBoundingBox()
      out.push({ id: p.id, name: p.name, size: p.size, left: pos.x + b.left, right: pos.x + b.right, top: pos.y + cy + b.top, bottom: pos.y + cy + b.bottom })
    }
    return out
  }
  getMarkerObject(id: string): SceneObject | null {
    const r = this.rows[id]
    return r && r.marker && !isNull(r.marker) ? r.marker : null
  }
  /** The number written on a casualty's map marker (matches their panel row). */
  getMarkerNumber(id: string): string {
    const r = this.rows[id]
    return r && r.markerNumber ? r.markerNumber.text : ""
  }
  getRestartButtonObject(): SceneObject | null {
    return this.restartObj && !isNull(this.restartObj) ? this.restartObj : null
  }
  /** 0.3 .. 1: the current brightness of the "Not reached" flash (1 = the bright, white phase). */
  getFlashLevel(): number {
    return this.flash
  }
  /** True when the casualty is shown as "Not reached" with the flashing text on the panel and over the real person. */
  isNotReachedFlashing(id: string): boolean {
    const r = this.rows[id]
    if (!r || !r.missed || !r.notReached) return false
    return r.notReached.enabled && r.notReached.sceneObject.enabled && !!r.worldFlash && r.worldFlash.enabled
  }
  /** Position (world) of the flashing "NOT REACHED" over the real casualty. */
  getWorldFlashObject(id: string): SceneObject | null {
    const r = this.rows[id]
    return r && r.worldFlash && !isNull(r.worldFlash) ? r.worldFlash : null
  }
  /** What appeared and when (seconds since the debrief opened), in order: "panel", then "missed" rows, then "row"s. */
  getRevealLog(): { kind: string; id: string | null; t: number }[] {
    return this.revealLog.slice()
  }
  /** The planned order and offsets (seconds after the panel starts to appear). */
  getRevealPlan(): RevealStep[] {
    return this.plan.slice()
  }
  /** True once the panel and every row are fully in. */
  isRevealDone(): boolean {
    return this.open && this.panelStarted && this.revealT >= this.revealEnd()
  }
  /** Test hook: jump to the end of the reveal (panel and every row fully in, Time's up stepped aside). */
  skipReveal(): void {
    if (!this.open) return
    if (this.reason === "time") this.clock.hideTimesUp()
    this.timesUpHidden = true
    this.sinceOpen = Math.max(this.sinceOpen, this.panelAt)
    this.startPanel()
    this.revealT = this.revealEnd() + 1
    this.applyReveal()
    finishMotion()
  }
  private revealEnd(): number {
    let end = PANEL_IN
    for (const st of this.plan) end = Math.max(end, st.at + REVEAL_FADE_SECONDS)
    return end
  }
  /** Same code path as pinching the Restart button. */
  pressRestart(): void {
    this.pendingRestart = true
  }
  /** Old (hidden) debriefs not yet destroyed; 0 about half a second after a restart. */
  getRetiredCount(): number {
    return this.retired.filter((r) => !isNull(r.obj)).length
  }

  // ------------------------------------------------------------------ end trigger (everyone tagged)

  private allTagged(): boolean {
    const recs = this.cards.getRecords()
    if (recs.length === 0) return false
    for (const r of recs) if (r.tag === null) return false
    return true
  }

  private watchEnd(dt: number): void {
    if (!this.clock.isRunning() || this.clock.isEnded()) {
      this.graceLeft = -1
      return
    }
    const phase = this.callOut.getPhase()
    const walkerBusy = phase === "standing" || phase === "walking"
    if (this.allTagged() && !walkerBusy) {
      if (this.graceLeft < 0) this.graceLeft = this.endGraceSeconds
      this.graceLeft -= dt
      if (this.graceLeft <= 0) {
        this.graceLeft = -1
        this.clock.endRun("all-tagged")
      }
    } else {
      this.graceLeft = -1
    }
  }

  // ------------------------------------------------------------------ per frame

  private eye(): vec3 {
    return this.viewerOverride ? this.viewerOverride : this.cameraObject.getTransform().getWorldPosition()
  }

  private tick(): void {
    if (!this.main || !this.clock) return
    this.destroyRetired()
    if (this.pendingRestart) {
      // done here, not inside the button's own event, because restarting destroys the button
      this.pendingRestart = false
      if (this.open) {
        this.main.restart()
        return
      }
    }
    if (!this.main.isStarted()) return
    const dt = getDeltaTime()
    if (!this.open) {
      this.watchEnd(dt)
      return
    }
    this.sinceOpen += dt
    if (this.reason === "time" && !this.timesUpHidden && this.sinceOpen >= this.timesUpSeconds) {
      this.timesUpHidden = true
      this.clock.hideTimesUp() // fades out; a short pause follows before the panel appears
    }
    if (!this.panelStarted && this.sinceOpen >= this.panelAt) this.startPanel()
    if (this.panelStarted) {
      this.revealT += dt
      this.applyReveal()
    }

    // the "Not reached" flash: between the dim red and bright white; with flashHz 0 it holds the bright phase
    this.flash = 0.65 + 0.35 * Math.sin(this.sinceOpen * Math.PI * 2 * this.flashHz + Math.PI / 2)
    const k = Math.max(0, Math.min(1, (this.flash - 0.3) / 0.7))
    const eye = this.eye()
    for (const id in this.rows) {
      const r = this.rows[id]
      if (!r.missed) continue
      const a = this.rowAlpha(r)
      const col = new vec4(FLASH_DIM.r + (1 - FLASH_DIM.r) * k, FLASH_DIM.g + (1 - FLASH_DIM.g) * k, FLASH_DIM.b + (1 - FLASH_DIM.b) * k, a)
      if (r.notReached && !isNull(r.notReached)) r.notReached.textFill.color = col
      if (r.worldFlashText && !isNull(r.worldFlashText)) r.worldFlashText.textFill.color = col
      if (r.worldFlash && !isNull(r.worldFlash)) this.faceViewer(r.worldFlash, eye)
      if (r.marker && !isNull(r.marker)) {
        const s = 1 + 0.35 * (0.5 + 0.5 * Math.sin(this.sinceOpen * Math.PI * 2 * this.flashHz + Math.PI / 2))
        r.marker.getTransform().setLocalScale(new vec3(s, 1, s))
      }
    }
    if (this.panel && !isNull(this.panel)) this.faceViewer(this.panel, eye)
    if (this.restartObj && !isNull(this.restartObj)) this.faceViewer(this.restartObj, eye)
    for (const o of this.billboards) if (!isNull(o)) this.faceViewer(o, eye)
  }

  /** The panel appears: enabled, then it fades and scales in; the Restart button comes with it. */
  private startPanel(): void {
    if (this.panelStarted) return
    this.panelStarted = true
    this.revealT = 0
    if (this.panel && !isNull(this.panel)) this.panel.enabled = true
    if (this.restartObj && !isNull(this.restartObj)) showPanel(this.restartObj)
    this.revealLog.push({ kind: "panel", id: null, t: this.sinceOpen })
    print("TRIAGE_REVEAL panel " + Math.round(this.sinceOpen * 100) / 100)
  }

  /** 0..1: how far a row (and the marker over the real person) has come in. */
  private rowAlpha(r: RowParts): number {
    if (!this.panelStarted) return 0
    const st = this.plan.filter((x) => x.id === r.id)[0]
    if (!st) return 1
    return clamp01((this.revealT - st.at) / REVEAL_FADE_SECONDS)
  }

  /** Apply the reveal state: the panel's own fade + scale, then each row's fade, in the planned order. */
  private applyReveal(): void {
    if (!this.panel || isNull(this.panel)) return
    const pk = easeOutCubic(this.revealT / PANEL_IN)
    const sc = lerp(PANEL_FROM, 1, pk)
    this.panel.getTransform().setLocalScale(new vec3(sc, sc, sc))
    if (this.panelPlate && !isNull(this.panelPlate)) this.panelPlate.opacity = pk
    for (const t of this.summaryTexts) this.setAlpha(t, WHITE, pk)
    for (const t of this.viewTexts) this.setAlpha(t, WHITE, pk)
    for (const st of this.plan) {
      if (st.id === null) continue
      const r = this.rows[st.id]
      if (!r) continue
      const key = st.kind + ":" + st.id
      if (!this.revealed[key] && this.revealT >= st.at) {
        this.revealed[key] = true
        this.revealLog.push({ kind: st.kind, id: st.id, t: this.sinceOpen })
        print("TRIAGE_REVEAL " + st.kind + " " + st.id + " " + Math.round(this.sinceOpen * 100) / 100)
      }
      const a = this.rowAlpha(r) * pk
      for (const name in r.texts) {
        if (name === "notReached") continue // its colour (flashing) is set each frame with this alpha
        this.setAlpha(r.texts[name], r.colors[name], a)
      }
      if (r.missed && r.worldFlash && !isNull(r.worldFlash)) {
        const rr = r.worldFlash.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
        if (rr) rr.opacity = this.rowAlpha(r)
      }
    }
  }

  private setAlpha(t: Text, base: vec4, a: number): void {
    if (isNull(t)) return
    t.textFill.color = new vec4(base.r, base.g, base.b, a)
  }

  /** Stand upright and face the viewer (turn about the vertical axis only). */
  private faceViewer(o: SceneObject, eye: vec3): void {
    const t = o.getTransform()
    const p = t.getWorldPosition()
    t.setWorldRotation(quat.fromEulerVec(new vec3(0, Math.atan2(eye.x - p.x, eye.z - p.z), 0)))
  }

  // ------------------------------------------------------------------ open / clear

  private destroyRetired(): void {
    if (this.retired.length === 0) return
    const now = getTime()
    const keep: { obj: SceneObject; destroyAt: number }[] = []
    for (const r of this.retired) {
      if (isNull(r.obj)) continue
      if (r.destroyAt < 0) r.destroyAt = now + RETIRE_SECONDS
      if (now >= r.destroyAt) r.obj.destroy()
      else keep.push(r)
    }
    this.retired = keep
  }

  private clear(): void {
    if (this.root && !isNull(this.root)) {
      // hide now, destroy shortly (see `retired`)
      this.root.enabled = false
      this.retired.push({ obj: this.root, destroyAt: -1 })
    }
    this.root = null
    this.map = null
    this.panel = null
    this.restartObj = null
    this.rows = {}
    this.summaryTexts = []
    this.viewTexts = []
    this.viewLines = []
    this.panelTexts = []
    this.billboards = []
    this.entries = []
    this.summary = null
    this.reason = null
    this.open = false
    this.sinceOpen = 0
    this.graceLeft = -1
    this.pendingRestart = false
    this.panelSize = { w: PANEL_W, h: 0 }
    this.plan = []
    this.panelAt = 0
    this.panelStarted = false
    this.revealT = 0
    this.revealed = {}
    this.revealLog = []
    this.panelPlate = null
    this.timesUpHidden = false
  }

  private openDebrief(reason: EndReason): void {
    if (this.open) return
    this.clear()
    this.open = true
    this.reason = reason
    this.sinceOpen = 0

    const records = this.cards.getRecords()
    const raw: DebriefEntry[] = []
    for (const r of records) {
      raw.push(
        buildEntry({
          def: CASUALTY_TABLE[r.id],
          poseLabel: this.main.getCasualtyPose(r.id).label,
          poseShort: this.main.getCasualtyPose(r.id).short,
          tag: r.tag,
          openSeconds: r.openSeconds,
          extraChecks: r.extraChecks,
          calledOut: r.calledOut,
          calledOutAtSeconds: r.calledOutAtSeconds,
        }),
      )
    }
    this.entries = orderRows(raw) // anyone missed first; rows numbered 1..n
    const used = Math.min(this.clock.getElapsed(), this.clock.getDuration())
    this.summary = summarize(this.entries, used, this.main.getMode() === "learn" ? "Learn" : "")
    this.viewLines = this.main.getFirstSeen().lines()

    this.root = global.scene.createSceneObject("DebriefRoot")
    this.root.setParent(this.sceneObject)
    this.plan = revealSchedule(this.entries)
    this.buildMap()
    this.buildPanel()
    this.buildRestart()
    // at time's up the Time's up panel is shown alone for a moment, then a short pause, then the panel appears
    this.panelAt = reason === "time" ? this.timesUpSeconds + PAUSE_AFTER_TIMES_UP : reason === "scene-clear" ? SCENE_CLEAR_PAUSE : 0.1
    if (this.panel) this.panel.enabled = false
    if (this.restartObj) this.restartObj.enabled = false
    print("TRIAGE_DEBRIEF " + reason + " " + this.summary.text + " | " + this.viewLines.join(" | "))
  }

  // ------------------------------------------------------------------ map

  private floorY(): number {
    return this.main.sceneObject.getTransform().getWorldPosition().y
  }

  private mapOrigin(): vec3 {
    return new vec3(0, this.floorY() + 0.5, -this.mapForwardCm)
  }

  private buildMap(): void {
    const b = this.builder!
    const s = this.mapScale
    const midZ = (ROOM.frontWallZ + ROOM.backZ) / 2
    const W = ROOM.halfWidth * 2 * s
    const H = (ROOM.backZ - ROOM.frontWallZ) * s
    const origin = this.mapOrigin()
    const state = this.main.getRunState()

    this.map = global.scene.createSceneObject("DebriefMap")
    this.map.setParent(this.root!)
    this.map.getTransform().setWorldPosition(origin)
    // lies flat: no rotation at all
    b.createPart(this.map, "MapBase", "box", [0, 0, 0], [W, 0.6, H], [0.42, 0.5, 0.66])
    const edge = [0.75, 0.83, 0.97]
    b.createPart(this.map, "EdgeFront", "box", [0, 0.2, -H / 2], [W, 0.8, 0.6], edge)
    b.createPart(this.map, "EdgeBack", "box", [0, 0.2, H / 2], [W, 0.8, 0.6], edge)
    b.createPart(this.map, "EdgeLeft", "box", [-W / 2, 0.2, 0], [0.6, 0.8, H], edge)
    b.createPart(this.map, "EdgeRight", "box", [W / 2, 0.2, 0], [0.6, 0.8, H], edge)
    // the green MINOR zone, scaled
    const mz = state.minorZone
    const zoneD = mz.diameterCm * s
    b.createPart(this.map, "MapMinorZone", "sphere", [mz.x * s, 0.5, (mz.z - midZ) * s], [zoneD, 0.5, zoneD], TAG_BAND_COLOUR.Green)

    // my start position
    const startZ = (0 - midZ) * s
    b.createPart(this.map, "StartMarker", "box", [0, 1, startZ], [3.2, 1.2, 3.2], [1, 1, 1])
    const startLabel = global.scene.createSceneObject("StartLabel")
    startLabel.setParent(this.map)
    startLabel.getTransform().setLocalPosition(new vec3(0, 8, startZ))
    this.addText(startLabel, "StartText", "You start here", 100, WHITE, 0, 0, "center", 30)
    this.billboards.push(startLabel)

    // casualties at their real positions (where they are NOW: a called-out walker stands in the green circle)
    const room = this.main.sceneObject.getTransform().getWorldPosition()
    for (const e of this.entries) {
      const c = state.casualties.filter((x) => x.id === e.id)[0]
      if (!c) continue
      const obj = this.main.getCasualtyObject(e.id)
      const wp = obj ? obj.getTransform().getWorldPosition() : new vec3(c.position.x, c.position.y, c.position.z)
      const mx = (wp.x - room.x) * s
      const mzz = (wp.z - room.z - midZ) * s

      // marker: outer square = correct tag, inner square = my tag (none when missed); the same number as the panel row
      const marker = global.scene.createSceneObject("Marker_" + e.id)
      marker.setParent(this.map)
      marker.getTransform().setLocalPosition(new vec3(mx, 0, mzz))
      if (e.correctTag === "Black") b.createPart(marker, "Outline", "box", [0, 0.7, 0], [8.6, 0.7, 8.6], [1, 1, 1])
      b.createPart(marker, "Correct", "box", [0, 1.1, 0], [7, 1, 7], TAG_BAND_COLOUR[e.correctTag])
      if (e.myTag) {
        if (e.myTag === "Black") b.createPart(marker, "MineOutline", "box", [0, 1.5, 0], [4.6, 0.6, 4.6], [1, 1, 1])
        b.createPart(marker, "Mine", "box", [0, 1.9, 0], [3.6, 1, 3.6], TAG_BAND_COLOUR[e.myTag])
      }
      const numObj = global.scene.createSceneObject("MarkerNumber_" + e.id)
      numObj.setParent(marker)
      numObj.getTransform().setLocalPosition(new vec3(0, 7.5, 0))
      const numText = this.addText(numObj, "Number", String(e.row), 190, WHITE, 0, 0, "center", 8)
      this.billboards.push(numObj)

      const parts: RowParts = { id: e.id, row: e.row, texts: {}, sizes: {}, colors: {}, notReached: null, worldFlash: null, worldFlashText: null, marker: marker, markerNumber: numText, missed: e.status === "missed" }
      this.rows[e.id] = parts
      if (parts.missed) this.buildWorldFlash(parts, new vec3(wp.x, wp.y + 150, wp.z))
    }
  }

  /** "NOT REACHED" over the real, missed person: on a small backing plate so it reads over the wall. */
  private buildWorldFlash(parts: RowParts, at: vec3): void {
    const wf = global.scene.createSceneObject("NotReachedWorld_" + parts.id)
    wf.setParent(this.root!)
    wf.getTransform().setWorldPosition(at)
    wf.createComponent("Component.Canvas")
    const back = wf.createComponent(BackPlate.getTypeName()) as BackPlate
    back.size = new vec2(50, 12)
    const content = global.scene.createSceneObject("Content")
    content.setParent(wf)
    content.getTransform().setLocalPosition(new vec3(0, 0, GUTTER_Z))
    parts.worldFlashText = this.addText(content, "Text", "NOT REACHED", 200, WHITE, 0, 0, "center", 48)
    ;(wf.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle).opacity = 0 // comes in with its row (see applyReveal)
    parts.worldFlash = wf
  }

  // ------------------------------------------------------------------ the panel

  private buildPanel(): void {
    const root = global.scene.createSceneObject("DebriefPanel")
    root.setParent(this.root!)
    root.createComponent("Component.Canvas")
    const back = root.createComponent(BackPlate.getTypeName()) as BackPlate
    const content = global.scene.createSceneObject("Content")
    content.setParent(root)
    this.panel = root
    this.panelPlate = root.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle

    // measurements come from TriageDebriefLayout (pure, tested in Node); this only draws them
    const lay = layoutPanel(this.entries, DEBRIEF_SIZES, this.viewLines.length)
    const sum = this.summary!
    for (let i = 0; i < 2; i++) {
      const t = this.addText(content, "Summary" + (i + 1), sum.lines[i], DEBRIEF_SIZES.title, WHITE, 0, lay.summaryY[i], "center", PANEL_W - 2 * MARGIN)
      this.summaryTexts.push(t)
      this.panelTexts.push({ id: "summary", name: "line" + (i + 1), text: t, size: DEBRIEF_SIZES.title, obj: t.sceneObject })
    }

    // when everyone came into view: the existing smallest size (shortened wording, not smaller text, keeps it in the panel)
    this.viewLines.forEach((line, i) => {
      const t = this.addText(content, "View" + (i + 1), line, DEBRIEF_SIZES.small, WHITE, 0, lay.noteY[i], "center", PANEL_W - 2 * MARGIN)
      this.viewTexts.push(t)
      this.panelTexts.push({ id: "view", name: "line" + (i + 1), text: t, size: DEBRIEF_SIZES.small, obj: t.sceneObject })
    })

    const wBox = PANEL_W - 2 * MARGIN
    for (const e of this.entries) {
      const rp = this.rows[e.id]
      const rl = lay.rows.filter((x) => x.id === e.id)[0]
      const add = (name: string, text: string, size: number, color: vec4, x: number, y: number, align: "left" | "right" | "center", w: number): Text => {
        const t = this.addText(content, "R" + e.row + "_" + name, text, size, color, x, y, align, w)
        rp.texts[name] = t
        rp.sizes[name] = size
        rp.colors[name] = color
        this.panelTexts.push({ id: e.id, name: name, text: t, size: size, obj: t.sceneObject })
        return t
      }
      const missed = e.status === "missed"
      // ---- line 1: number, then the name and stats (a missed casualty: NOT REACHED, the big flashing red line)
      add("number", String(e.row), rl.line1Size, WHITE, LEFT, rl.y1, "left", 6)
      if (missed) {
        rp.notReached = add("notReached", "NOT REACHED", rl.line1Size, WHITE, COL_B, rl.y1, "left", wBox - 5.2)
      } else {
        add("name", e.shortName, DEBRIEF_SIZES.body, WHITE, COL_B, rl.y1, "left", 24)
        add("stats", e.statsText, DEBRIEF_SIZES.body, WHITE, RIGHT, rl.y1, "right", 32)
      }
      // ---- line 2: You WORD   Correct WORD (a missed casualty: the name instead of "You WORD"), in fixed columns
      if (missed) {
        add("name", e.shortName, DEBRIEF_SIZES.body, WHITE, COL_B, rl.y2, "left", 16)
      } else {
        add("youLabel", "You", DEBRIEF_SIZES.body, WHITE, COL_B, rl.y2, "left", 8)
        add("youWord", e.myWord, DEBRIEF_SIZES.body, TAG_TEXT_COLOUR[e.myTag || "Red"], COL_YOU_WORD, rl.y2, "left", 18)
      }
      add("correctLabel", "Correct", DEBRIEF_SIZES.body, WHITE, COL_C, rl.y2, "left", 12)
      add("correctWord", e.correctWord, DEBRIEF_SIZES.body, TAG_TEXT_COLOUR[e.correctTag], COL_D, rl.y2, "left", 18)
      // ---- line 3: the one short explanation, lighter and smaller; a long sentence wraps and the row has already grown for it
      if (e.explanation) {
        const et = add("explanation", e.explanation, DEBRIEF_SIZES.small, TEXT_SMALL, COL_B, rl.y3, "left", RIGHT - COL_B)
        if (rl.lines3 > 1) {
          et.horizontalOverflow = HorizontalOverflow.Wrap
          et.layoutRect = Rect.create(0, RIGHT - COL_B, -rl.p3 / 2, rl.p3 / 2)
        }
      }
    }
    const H = lay.height
    this.panelSize = { w: PANEL_W, h: H }
    back.size = new vec2(PANEL_W, H)
    content.getTransform().setLocalPosition(new vec3(0, H / 2, GUTTER_Z)) // top of the content = top of the panel
    // 1.2 m in front of the start position, centred slightly below eye level
    root.getTransform().setWorldPosition(new vec3(0, -this.panelDropCm, -this.mapForwardCm))
  }

  // ------------------------------------------------------------------ restart button

  /** A Restart button at waist height just above the near part of the map (upright, so it can be reached standing). */
  private buildRestart(): void {
    const origin = this.mapOrigin()
    const root = global.scene.createSceneObject("DebriefRestart")
    root.setParent(this.root!)
    root.getTransform().setWorldPosition(new vec3(0, this.floorY() + 100, origin.z + 45))
    root.createComponent("Component.Canvas")
    const back = root.createComponent(BackPlate.getTypeName()) as BackPlate
    back.size = new vec2(28, 11)
    const content = global.scene.createSceneObject("Content")
    content.setParent(root)
    content.getTransform().setLocalPosition(new vec3(0, 0, GUTTER_Z))
    const so = global.scene.createSceneObject("RestartButton")
    so.setParent(content)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(25, 8.5, 1)
    const lab = global.scene.createSceneObject("ButtonLabel")
    lab.setParent(so)
    lab.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    this.addText(lab, "Text", "Restart", DEBRIEF_SIZES.body, WHITE, 0, 0, "center", 24)
    btn.onTriggerUp.add(() => this.pressRestart())
    addPressPop(btn, so)
    this.restartObj = root
  }

  // ------------------------------------------------------------------ helpers

  private addText(parent: SceneObject, name: string, text: string, size: number, color: vec4, x: number, y: number, align: "left" | "right" | "center", widthCm: number): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(x, y, 0))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.size = size
    t.textFill.color = color
    t.horizontalAlignment = align === "left" ? HorizontalAlignment.Left : align === "right" ? HorizontalAlignment.Right : HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    const h = pitch(size)
    t.layoutRect =
      align === "left" ? Rect.create(0, widthCm, -h / 2, h / 2) : align === "right" ? Rect.create(-widthCm, 0, -h / 2, h / 2) : Rect.create(-widthCm / 2, widthCm / 2, -h / 2, h / 2)
    return t
  }
}
