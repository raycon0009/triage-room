/**
 * TriageDebrief.ts - build step 4: the debrief map and scoring view, and the "everyone tagged" end trigger.
 * Owns:
 *  - the end trigger: when all four casualties are tagged (and a called-out walker has arrived) it waits a moment
 *    and calls TriageRunClock.endRun("all-tagged"). Time's up arrives through the clock's own endRun("time").
 *  - the debrief, opened by TriageRunClock.onRunEnded for either reason: a top-down map lying flat on the floor
 *    about 1.2 m in front of the start position (each casualty at their real position, scaled down, and the start
 *    position marked), an upright label above the map for each casualty (stands up, faces the viewer), a summary
 *    line, and for anyone untagged a flashing "NOT REACHED" (on the label, the map marker and over the real person).
 *  Per casualty: my tag vs the correct tag (colour + word for both), time spent, extra checks, and one short
 *  explanation line where it applies (TriageScoring).
 *  The timer, arrow, groan and open cards are already off at the end (TriageRunClock / TriageBehindCue).
 * Public API (for tests): isOpen(), getReason(), getEntries(), getSummary(), getLabelObject(id), getLabelTexts(id),
 *   getMapObject(), getFlashLevel(), isNotReachedFlashing(id), setViewerOverride(position), endGraceSeconds.
 * Must not: restart the run or shuffle (build step 5).
 */
import { TriageMain } from "./TriageMain"
import { TriageCheckCards } from "./TriageCheckCards"
import { TriageRunClock, EndReason } from "./TriageRunClock"
import { TriageCallOut } from "./TriageCallOut"
import { TriageFigureBuilder, TAG_BAND_COLOUR } from "./TriageFigureBuilder"
import { CASUALTY_TABLE } from "./TriageData"
import { ROOM } from "./TriageLayout"
import { DebriefEntry, DebriefSummary, buildEntry, summarize } from "./TriageScoring"

const TAG_TEXT_COLOUR: { [tag: string]: vec4 } = {
  Red: new vec4(1, 0.45, 0.45, 1),
  Yellow: new vec4(1, 0.92, 0.35, 1),
  Green: new vec4(0.45, 1, 0.55, 1),
  Black: new vec4(1, 1, 1, 1),
}
const WHITE = new vec4(1, 1, 1, 1)
const SOFT = new vec4(0.82, 0.88, 1, 1)
const FLASH = new vec4(1, 0.72, 0.2, 1)

interface LabelParts {
  root: SceneObject
  texts: { [name: string]: Text }
  flashTexts: Text[]
  worldFlash: SceneObject | null
  marker: SceneObject | null
  missed: boolean
}

@component
export class TriageDebrief extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageDebrief - debrief map, scoring, end trigger (step 4)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Run orchestrator (room, casualty positions, new-run event)")
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
  @hint("The camera object (labels face the viewer)")
  cameraObject!: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(60, 200, 5))
  @hint("Distance of the map centre in front of the start position (cm)")
  mapForwardCm: number = 120

  @input
  @widget(new SliderWidget(0.08, 0.3, 0.01))
  @hint("Map scale: room cm to map cm")
  mapScale: number = 0.16

  @input
  @widget(new SliderWidget(20, 70, 1))
  @hint("Height of the label centres above the floor (cm)")
  labelHeightCm: number = 44

  @input
  @widget(new SliderWidget(0, 3, 0.1))
  @hint("Pause after the last tag before the debrief opens (s)")
  endGraceSeconds: number = 1.2

  @input
  @widget(new SliderWidget(1, 8, 0.5))
  @hint("How long the Time's up panel stays once the debrief is open (s)")
  timesUpSeconds: number = 3
  @ui.group_end

  private builder: TriageFigureBuilder | null = null
  private root: SceneObject | null = null
  private map: SceneObject | null = null
  private summaryObj: SceneObject | null = null
  private summaryText: Text | null = null
  private labels: { [id: string]: LabelParts } = {}
  private entries: DebriefEntry[] = []
  private summary: DebriefSummary | null = null
  private reason: EndReason | null = null
  private open = false
  private sinceOpen = 0
  private graceLeft = -1
  private flash = 1
  private viewerOverride: vec3 | null = null

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
  isOpen(): boolean {
    return this.open
  }
  getReason(): EndReason | null {
    return this.reason
  }
  getEntries(): DebriefEntry[] {
    return this.entries.slice()
  }
  getSummary(): DebriefSummary | null {
    return this.summary
  }
  getMapObject(): SceneObject | null {
    return this.map && !isNull(this.map) ? this.map : null
  }
  getSummaryObject(): SceneObject | null {
    return this.summaryObj && !isNull(this.summaryObj) ? this.summaryObj : null
  }
  getSummaryTextValue(): string {
    return this.summaryText ? this.summaryText.text : ""
  }
  getLabelObject(id: string): SceneObject | null {
    const l = this.labels[id]
    return l && !isNull(l.root) ? l.root : null
  }
  /** Text of each line on a casualty's label: title, youWord, correctWord, stats, explanation, notReached. */
  getLabelTexts(id: string): { [name: string]: string } {
    const out: { [name: string]: string } = {}
    const l = this.labels[id]
    if (!l) return out
    for (const k in l.texts) out[k] = l.texts[k].text
    return out
  }
  /** Colour of a label line (so tests can check tag colours). */
  getLabelTextColour(id: string, name: string): vec4 | null {
    const l = this.labels[id]
    return l && l.texts[name] ? l.texts[name].textFill.color : null
  }
  /** 0.3 .. 1: the current brightness of the "Not reached" flash. */
  getFlashLevel(): number {
    return this.flash
  }
  /** True when the casualty is shown as "Not reached" with the flashing label, marker and over-the-person text. */
  isNotReachedFlashing(id: string): boolean {
    const l = this.labels[id]
    if (!l || !l.missed) return false
    const word = l.texts.notReached
    return !!word && word.enabled && word.sceneObject.enabled && !!l.worldFlash && l.worldFlash.enabled
  }
  /** Position (world) of the flashing "NOT REACHED" text over the real casualty. */
  getWorldFlashObject(id: string): SceneObject | null {
    const l = this.labels[id]
    return l && l.worldFlash && !isNull(l.worldFlash) ? l.worldFlash : null
  }
  getMarkerObject(id: string): SceneObject | null {
    const l = this.labels[id]
    return l && l.marker && !isNull(l.marker) ? l.marker : null
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
    if (!this.main || !this.main.isStarted() || !this.clock) return
    const dt = getDeltaTime()
    if (!this.open) {
      this.watchEnd(dt)
      return
    }
    this.sinceOpen += dt
    if (this.sinceOpen >= this.timesUpSeconds) this.clock.hideTimesUp()

    // the "Not reached" flash: 1.8 Hz, between 0.3 and 1 brightness
    this.flash = 0.65 + 0.35 * Math.sin(this.sinceOpen * Math.PI * 2 * 1.8)
    const col = new vec4(FLASH.r * this.flash, FLASH.g * this.flash, FLASH.b * this.flash, 1)
    const eye = this.eye()
    for (const id in this.labels) {
      const l = this.labels[id]
      if (isNull(l.root)) continue
      this.faceViewer(l.root, eye)
      if (l.missed) {
        for (const t of l.flashTexts) if (!isNull(t)) t.textFill.color = col
        if (l.worldFlash && !isNull(l.worldFlash)) this.faceViewer(l.worldFlash, eye)
        if (l.marker && !isNull(l.marker)) {
          const k = 1 + 0.35 * (0.5 + 0.5 * Math.sin(this.sinceOpen * Math.PI * 2 * 1.8))
          l.marker.getTransform().setLocalScale(new vec3(k, 1, k))
        }
      }
    }
    if (this.summaryObj && !isNull(this.summaryObj)) this.faceViewer(this.summaryObj, eye)
    // anyone missed: the summary line flashes too, so it is the first thing noticed
    if (this.summaryText && this.summary && this.summary.missed > 0 && !isNull(this.summaryText)) this.summaryText.textFill.color = col
    for (const o of this.startLabels) if (!isNull(o)) this.faceViewer(o, eye)
  }

  /** Stand upright and face the viewer (turn about the vertical axis only). */
  private faceViewer(o: SceneObject, eye: vec3): void {
    const t = o.getTransform()
    const p = t.getWorldPosition()
    t.setWorldRotation(quat.fromEulerVec(new vec3(0, Math.atan2(eye.x - p.x, eye.z - p.z), 0)))
  }

  // ------------------------------------------------------------------ open / clear

  private clear(): void {
    if (this.root && !isNull(this.root)) this.root.destroy()
    this.root = null
    this.map = null
    this.summaryObj = null
    this.summaryText = null
    this.labels = {}
    this.startLabels = []
    this.entries = []
    this.summary = null
    this.reason = null
    this.open = false
    this.sinceOpen = 0
    this.graceLeft = -1
  }

  private openDebrief(reason: EndReason): void {
    if (this.open) return
    this.clear()
    this.open = true
    this.reason = reason
    this.sinceOpen = 0

    const state = this.main.getRunState()
    const records = this.cards.getRecords()
    this.entries = []
    for (const r of records) {
      this.entries.push(
        buildEntry({
          def: CASUALTY_TABLE[r.id],
          tag: r.tag,
          openSeconds: r.openSeconds,
          extraChecks: r.extraChecks,
          calledOut: r.calledOut,
          calledOutAtSeconds: r.calledOutAtSeconds,
        }),
      )
    }
    const used = Math.min(this.clock.getElapsed(), this.clock.getDuration())
    this.summary = summarize(this.entries, used)

    this.root = global.scene.createSceneObject("DebriefRoot")
    this.root.setParent(this.sceneObject)
    this.buildMap(state)
    this.buildSummary(reason)
    print("TRIAGE_DEBRIEF " + reason + " " + this.summary.text)
  }

  // ------------------------------------------------------------------ map

  private mapOrigin(): vec3 {
    const floorY = this.main.sceneObject.getTransform().getWorldPosition().y
    return new vec3(0, floorY + 0.5, -this.mapForwardCm)
  }

  private buildMap(state: ReturnType<TriageMain["getRunState"]>): void {
    const b = this.builder!
    const s = this.mapScale
    const midZ = (ROOM.frontWallZ + ROOM.backZ) / 2
    const W = ROOM.halfWidth * 2 * s
    const H = (ROOM.backZ - ROOM.frontWallZ) * s
    const origin = this.mapOrigin()

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
    startLabel.getTransform().setLocalPosition(new vec3(0, 7, startZ))
    this.addText(startLabel, "StartText", "You start here", 64, WHITE, 0, 0, 24)
    this.faceLater(startLabel)

    // casualties at their real positions (where they are NOW: a called-out walker stands in the green circle)
    const room = this.main.sceneObject.getTransform().getWorldPosition()
    const items: { id: string; e: DebriefEntry; mx: number; mz: number; wp: vec3 }[] = []
    for (const c of state.casualties) {
      const e = this.entries.filter((x) => x.id === c.id)[0]
      if (!e) continue
      const obj = this.main.getCasualtyObject(c.id)
      const wp = obj ? obj.getTransform().getWorldPosition() : new vec3(c.position.x, c.position.y, c.position.z)
      items.push({ id: c.id, e: e, mx: (wp.x - room.x) * s, mz: (wp.z - room.z - midZ) * s, wp: wp })
    }

    // Labels stand in a 2 x 2 block just beyond the map's far edge, so all four are in front of the viewer, whichever
    // side of the room the person lies on (the casualty behind sits at the near edge of the map, out of sight).
    // Left two markers -> left column, right two -> right column. In a column, anyone "Not reached" takes the lower
    // (nearer to eye level, easiest to see) row; otherwise the one nearer the viewer is lower.
    const byX = items.slice().sort((a, b) => a.mx - b.mx)
    const columns = [byX.slice(0, Math.ceil(byX.length / 2)), byX.slice(Math.ceil(byX.length / 2))]
    const labelZ = -H / 2 - 10
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci].slice().sort((a, b) => {
        const am = a.e.status === "missed" ? 1 : 0
        const bm = b.e.status === "missed" ? 1 : 0
        return am !== bm ? bm - am : b.mz - a.mz // missed first, then nearer first -> lowest row first
      })
      for (let ri = 0; ri < col.length; ri++) {
        const it = col[ri]
        const lx = ci === 0 ? -26 : 26
        const lh = this.labelHeightCm + ri * 40
        this.buildCasualty(it.id, it.e, it.mx, it.mz, it.wp, { x: lx, z: labelZ, h: lh })
      }
    }
  }

  private startLabels: SceneObject[] = []
  private faceLater(o: SceneObject): void {
    this.startLabels.push(o) // kept facing the viewer every frame (tick)
  }

  private buildCasualty(id: string, e: DebriefEntry, mx: number, mz: number, worldPos: vec3, at: { x: number; z: number; h: number }): void {
    const b = this.builder!
    const origin = this.mapOrigin()
    const slotPos = at
    const h = at.h
    const missed = e.status === "missed"

    // --- marker on the map: outer square = correct tag, inner square = my tag (none when missed)
    const marker = global.scene.createSceneObject("Marker_" + id)
    marker.setParent(this.map!)
    marker.getTransform().setLocalPosition(new vec3(mx, 0, mz))
    if (e.correctTag === "Black") b.createPart(marker, "Outline", "box", [0, 0.7, 0], [8.6, 0.7, 8.6], [1, 1, 1])
    b.createPart(marker, "Correct", "box", [0, 1.1, 0], [7, 1, 7], TAG_BAND_COLOUR[e.correctTag])
    if (e.myTag) {
      if (e.myTag === "Black") b.createPart(marker, "MineOutline", "box", [0, 1.5, 0], [4.6, 0.6, 4.6], [1, 1, 1])
      b.createPart(marker, "Mine", "box", [0, 1.9, 0], [3.6, 1, 3.6], TAG_BAND_COLOUR[e.myTag])
    }

    // --- leader line from the marker up to the label
    const labelWorld = origin.add(new vec3(slotPos.x, h, slotPos.z))
    const from = origin.add(new vec3(mx, 2, mz))
    const to = labelWorld.sub(new vec3(0, 14, 0))
    const d = to.sub(from)
    const len = d.length
    const line = b.createPart(this.map!, "Leader_" + id, "box", [0, 0, 0], [0.35, 0.35, 1], [0.85, 0.9, 1])
    const lt = line.getTransform()
    lt.setWorldPosition(from.add(d.uniformScale(0.5)))
    lt.setWorldRotation(quat.rotationFromTo(new vec3(0, 0, 1), d.uniformScale(1 / (len || 1))))
    lt.setWorldScale(new vec3(0.35 / this.main.boxUnitCm, 0.35 / this.main.boxUnitCm, len / this.main.boxUnitCm))

    // --- upright label above the map
    const root = global.scene.createSceneObject("DebriefLabel_" + id)
    root.setParent(this.root!)
    root.getTransform().setWorldPosition(labelWorld)
    const texts: { [name: string]: Text } = {}
    const flashTexts: Text[] = []
    const titleCol = e.status === "correct" ? new vec4(0.7, 1, 0.8, 1) : e.status === "wrong" ? new vec4(1, 0.8, 0.4, 1) : FLASH
    texts.title = this.addText(root, "Title", e.poseLabel, 90, titleCol, 0, 13, 40)
    if (missed) {
      texts.notReached = this.addText(root, "NotReached", "NOT REACHED", 140, FLASH, 0, 6.2, 40)
      flashTexts.push(texts.notReached)
      flashTexts.push(texts.title)
    } else {
      texts.you = this.addText(root, "YouLabel", "You", 70, SOFT, -12, 7, 12)
      texts.youWord = this.addText(root, "YouWord", e.myWord, 110, TAG_TEXT_COLOUR[e.myTag || "Red"], 6, 7, 24)
    }
    texts.correct = this.addText(root, "CorrectLabel", "Correct", 70, SOFT, -12, 0.6, 12)
    texts.correctWord = this.addText(root, "CorrectWord", e.correctWord, 110, TAG_TEXT_COLOUR[e.correctTag], 6, 0.6, 24)
    texts.stats = this.addText(root, "Stats", "Time " + e.timeText + "  ·  Extra checks " + e.extraChecks, 64, WHITE, 0, -5.6, 40)
    if (e.explanation) {
      const lines = this.wrap(e.explanation, 42)
      for (let i = 0; i < lines.length; i++) {
        texts["explanation" + (i === 0 ? "" : i)] = this.addText(root, "Explain" + i, lines[i], 58, SOFT, 0, -10.8 - i * 3.4, 40)
      }
    }
    if (missed) {
      // make the missed person the first thing noticed: flashing text over the real casualty too
      const wf = global.scene.createSceneObject("NotReachedWorld_" + id)
      wf.setParent(this.root!)
      wf.getTransform().setWorldPosition(new vec3(worldPos.x, worldPos.y + 150, worldPos.z))
      const wt = this.addText(wf, "Text", "NOT REACHED", 200, FLASH, 0, 0, 80)
      flashTexts.push(wt)
      this.labels[id] = { root: root, texts: texts, flashTexts: flashTexts, worldFlash: wf, marker: marker, missed: true }
    } else {
      this.labels[id] = { root: root, texts: texts, flashTexts: flashTexts, worldFlash: null, marker: marker, missed: false }
    }
  }

  private buildSummary(reason: EndReason): void {
    const origin = this.mapOrigin()
    const H = (ROOM.backZ - ROOM.frontWallZ) * this.mapScale
    const o = global.scene.createSceneObject("DebriefSummary")
    o.setParent(this.root!)
    o.getTransform().setWorldPosition(new vec3(0, origin.y + 132, origin.z - H / 2 - 4))
    const heading = reason === "time" ? "Time's up" : "Everyone tagged"
    this.addText(o, "Heading", heading, 84, SOFT, 0, 4.4, 60)
    const s = this.summary!
    this.summaryText = this.addText(o, "SummaryLine", s.text, 100, s.missed > 0 ? FLASH : new vec4(0.7, 1, 0.8, 1), 0, -1.2, 80)
    this.summaryObj = o
  }

  // ------------------------------------------------------------------ helpers

  private wrap(text: string, max: number): string[] {
    const words = text.split(" ")
    const lines: string[] = []
    let cur = ""
    for (const w of words) {
      if ((cur + " " + w).trim().length > max && cur) {
        lines.push(cur)
        cur = w
      } else {
        cur = (cur + " " + w).trim()
      }
    }
    if (cur) lines.push(cur)
    return lines.slice(0, 2)
  }

  private addText(parent: SceneObject, name: string, text: string, size: number, color: vec4, x: number, y: number, widthCm: number): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(x, y, 0))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.size = size
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -1.5, 1.5)
    return t
  }
}
