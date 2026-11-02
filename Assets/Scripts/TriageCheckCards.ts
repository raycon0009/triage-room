/**
 * TriageCheckCards.ts - build step 2: the dot above each casualty, the check card, tagging, per-casualty records.
 * Owns: proximity / "Open" opening of one shared check card, the START check buttons (scripted results from
 *       the casualty table), tag buttons (only once a step has decided the tag), the tag band + word, and the
 *       records (checks made, time spent, tag) that the step 4 debrief will read.
 * Uses: TriageStartEngine (pure rules), TriageMain (casualty objects, run events), SIK + UI Kit buttons.
 * Public API (for tests): openCard, closeCard, getOpenCasualtyId, getOpenReason, pressCheck, chooseTag,
 *   getCardLabels, isTagPanelVisible, getRecord, getRecords, setViewerOverride, onCasualtyTagged.
 * Step 3 hooks (driven by other modules, which import this one - never the reverse): setLocked (run ended),
 *   setTimerText (shown on the open card only), markCalledOut / showCalledOutTag (walker answers the call-out).
 * Must not: own the timer, the walker's movement, the groan or arrow, or the debrief.
 */
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { TriageMain } from "./TriageMain"
import { TriageFigureBuilder } from "./TriageFigureBuilder"
import { CASUALTY_TABLE, CasualtyId } from "./TriageData"
import { CHECK_LABEL, CheckId, Findings, StartTag, TAG_WORD, checkResultText, evaluateStart, findingsFromDef } from "./TriageStartEngine"

export interface CasualtyRecord {
  id: string
  /** distinct checks in the order first pressed */
  checks: CheckId[]
  /** total button presses on check buttons (repeats included) */
  presses: number
  /** seconds the card was open for this casualty */
  openSeconds: number
  tag: StartTag | null
  tagWord: string | null
  correctTag: string
  decidingStep: number
  /** checks made after the deciding step (each +1) */
  extraChecks: number
  /** true when the walker was tagged Green by the "Call out: walk to me" button (deciding step 0, no checks) */
  calledOut: boolean
  /** seconds into the run when the call-out was pressed (null if not called out) */
  calledOutAtSeconds: number | null
}

type OpenReason = "proximity" | "button"

const TYPE_BUTTON = 44
const TYPE_TITLE = 50
const TYPE_STATUS = 36
const TYPE_TAG = 32
const BUTTON_LABEL_Z = 0.08
const CONTENT_Z = 0.6

const CHECK_W = 25
const CHECK_H = 26.5
const TAG_H = 7
const TAG_GAP = 0.8
const CHECK_BTN_H = 4.4
// extents of the whole card (check panel + tag panel) from the check panel's centre
const CARD_TOP = CHECK_H / 2
const CARD_BOTTOM = CHECK_H / 2 + TAG_GAP + TAG_H
const FOLLOW_ANGLE = 30 // beyond this the card is out of view and glides back
const TAG_COLOUR: { [k in StartTag]: vec4 } = {
  Red: new vec4(1, 0.45, 0.45, 1),
  Yellow: new vec4(1, 0.92, 0.35, 1),
  Green: new vec4(0.45, 1, 0.55, 1),
  Black: new vec4(1, 1, 1, 1),
}

interface DotUI {
  root: SceneObject
  label: Text
  button: Button
  word: SceneObject | null
}

@component
export class TriageCheckCards extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageCheckCards - dots, check card, tags (step 2)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Run orchestrator (casualty objects, Start state)")
  main!: TriageMain
  @input
  @hint("The camera object (viewer eye position / look direction)")
  cameraObject!: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(80, 250, 5))
  @hint("The card opens by itself when the viewer is within this distance of a casualty (cm)")
  proximityCm: number = 150

  @input
  @widget(new SliderWidget(120, 400, 5))
  @hint("A card that opened by proximity closes again beyond this distance (cm)")
  leaveCm: number = 220

  @input
  @widget(new SliderWidget(50, 120, 1))
  @hint("Distance of the card from the eyes (cm)")
  cardDistanceCm: number = 70

  @input
  @widget(new SliderWidget(0, 40, 1))
  @hint("How far below the centre of view the card sits (cm)")
  cardDropCm: number = 3

  @input
  @widget(new SliderWidget(0.2, 3, 0.1))
  @hint("Pause after tagging before a nearby casualty's card may open by itself (s)")
  cooldownSeconds: number = 1

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Colour of card text (keep it light; black is invisible on additive displays)")
  textColor: vec4
  @ui.group_end

  private _onTagged = new Event<CasualtyRecord>()
  get onCasualtyTagged(): PublicApi<CasualtyRecord> {
    return this._onTagged.publicApi()
  }

  private builder: TriageFigureBuilder | null = null
  private dots: { [id: string]: DotUI } = {}
  private records: { [id: string]: { checks: CheckId[]; presses: number; openSeconds: number; tag: StartTag | null; calledOutAt: number | null } } = {}
  private dismissed: { [id: string]: boolean } = {}
  /** step 3: the run has ended (time up / all tagged): no card may open */
  private locked = false
  private timerText = ""
  private statusBase = ""
  private standing: { [id: string]: boolean } = {}

  private cardRoot!: SceneObject
  private checkPanel!: SceneObject
  private tagPanel!: SceneObject
  private titleText!: Text
  private statusText!: Text
  private checkButtons: { [slot: string]: { button: Button; label: Text; obj: SceneObject } } = {}
  private tagButtons: { [tag: string]: { button: Button; label: Text; obj: SceneObject } } = {}

  private openId: string | null = null
  private openReason: OpenReason | null = null
  private cooldown = 0
  private viewerOverride: vec3 | null = null
  private lookOverride: vec3 | null = null
  private cardFollowing = false
  private cardGoalPos: vec3 | null = null
  private anchors: { [id: string]: { head: SceneObject | null; torso: SceneObject | null; dot: SceneObject | null } } = {}
  private line: SceneObject | null = null
  private lineFrom = new vec3(0, 0, 0)
  private lineTo = new vec3(0, 0, 0)

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private onStart(): void {
    if (!this.main || !this.cameraObject) {
      print("TriageCheckCards: required @input not wired - check the scene bootstrap")
      return
    }
    this.builder = new TriageFigureBuilder({
      box: this.main.boxMesh,
      sphere: this.main.sphereMesh,
      material: this.main.figureMaterial,
      boxUnitCm: this.main.boxUnitCm,
      sphereUnitCm: this.main.sphereUnitCm,
    })
    this.buildCard()
    this.main.onRegenerated.add(() => this.rebuildForRun())
    if (this.main.isReady()) this.rebuildForRun()
  }

  // ------------------------------------------------------------------ public API

  /** Test hook: pretend the viewer stands here (world cm). null = use the camera. */
  setViewerOverride(p: vec3 | null, look?: vec3 | null): void {
    this.viewerOverride = p
    this.lookOverride = p && look ? look.normalize() : null
  }

  /** Card size in cm (check panel width; check panel + tag panel height) and the check button height. */
  getCardSizeCm(): { width: number; height: number; buttonHeight: number } {
    return { width: CHECK_W, height: CARD_TOP + CARD_BOTTOM, buttonHeight: CHECK_BTN_H }
  }

  /** The line joining the card to the open casualty's dot (world cm). */
  getConnector(): { visible: boolean; from: vec3; to: vec3 } {
    const vis = !!this.line && this.line.enabled
    return { visible: vis, from: this.lineFrom, to: this.lineTo }
  }

  /** Is any sampled point of the open casualty's head / torso hidden behind the card from the viewer? */
  isCasualtyCovered(id: string): boolean {
    const ct = this.cardRoot.getTransform()
    return this.coveredAt(id, ct.getWorldPosition(), this.viewerPos(), this.lookDir())
  }

  getOpenCasualtyId(): string | null {
    return this.openId
  }

  getOpenReason(): string | null {
    return this.openReason
  }

  isCardVisible(): boolean {
    return this.cardRoot.enabled
  }

  isTagPanelVisible(): boolean {
    return this.cardRoot.enabled && this.tagPanel.enabled
  }

  /** Current text of the four check buttons and the tag buttons. */
  getCardLabels(): { [name: string]: string } {
    const out: { [name: string]: string } = {}
    for (const k in this.checkButtons) out[k] = this.checkButtons[k].label.text
    for (const k in this.tagButtons) out[k] = this.tagButtons[k].label.text
    out.title = this.titleText.text
    out.status = this.statusText.text
    return out
  }

  /** Step 3: the run clock locks the cards when the run ends (and unlocks them for the next run). */
  setLocked(locked: boolean): void {
    this.locked = locked
    if (locked) this.closeCard()
  }

  isLocked(): boolean {
    return this.locked
  }

  /** Step 3: the run clock pushes the remaining time (e.g. "2:41"); it is shown on the open card only. */
  setTimerText(text: string): void {
    if (text === this.timerText) return
    this.timerText = text
    this.showStatus()
  }

  getTimerText(): string {
    return this.timerText
  }

  private showStatus(): void {
    if (!this.statusText) return
    this.statusText.text = this.timerText ? this.statusBase + "   ·   " + this.timerText : this.statusBase
  }

  /**
   * Step 3: the walker answers the call-out. Counts as tagging them Green at the deciding step (0, no checks, so
   * 0 extra checks) with the run time recorded. Closes their card if it is open and hides their dot. The band
   * and word appear when the walker reaches the green circle (showCalledOutTag).
   */
  markCalledOut(id: string, atSeconds: number): CasualtyRecord | null {
    const r = this.records[id]
    if (!r || r.tag !== null || !CASUALTY_TABLE[id].walks) return null
    if (this.openId === id) this.closeCard()
    r.tag = "Green"
    r.calledOutAt = Math.round(atSeconds * 100) / 100
    const dot = this.dots[id]
    if (dot && !isNull(dot.root)) dot.root.enabled = false
    const cas = this.main.getCasualtyObject(id)
    const sphere = cas ? this.findByName(cas, "Dot_" + id) : null
    if (sphere) sphere.enabled = false
    this.standing[id] = true
    const rec = this.getRecord(id)
    print("TRIAGE_CALLED_OUT " + JSON.stringify(rec))
    this._onTagged.invoke(rec)
    return rec
  }

  /** Step 3: the green band and the word GREEN on the walker once they stand in the green circle. */
  showCalledOutTag(id: string): void {
    this.applyTag(id, "Green")
  }

  openCard(id: string, reason: OpenReason): void {
    if (this.locked || !this.main.isStarted() || !this.records[id] || this.records[id].tag !== null) return
    if (this.openId === id) return
    this.openId = id
    this.openReason = reason
    this.dismissed[id] = false
    this.refreshCard()
    this.cardRoot.enabled = true
    this.placeCard(true)
    this.refreshDots()
  }

  closeCard(): void {
    this.openId = null
    this.openReason = null
    this.cardRoot.enabled = false
    if (this.line) this.line.enabled = false
    this.refreshDots()
  }

  /** Same code path as pressing a check button. slot "second" is rate, or Open airway when not breathing. */
  pressCheck(check: CheckId): void {
    const id = this.openId
    if (!id) return
    const rec = this.records[id]
    const f = this.findings(id)
    // "second" slot shows Open airway instead of rate once Breathing? has shown No
    if (check === "rate" && this.airwayInsteadOfRate(id)) check = "airway"
    if (check === "airway" && !this.airwayInsteadOfRate(id)) return
    rec.presses++
    if (rec.checks.indexOf(check) < 0) rec.checks.push(check)
    print("TRIAGE_CHECK " + id + " " + check + " -> " + checkResultText(f, check))
    this.refreshCard()
  }

  /** Same code path as pressing a tag button. Only works once a step has decided the tag. */
  chooseTag(tag: StartTag): boolean {
    const id = this.openId
    if (!id) return false
    const res = evaluateStart(this.findings(id), this.records[id].checks)
    if (!res.decided) return false
    this.records[id].tag = tag
    this.cooldown = this.cooldownSeconds
    this.applyTag(id, tag)
    const rec = this.getRecord(id)
    print("TRIAGE_TAGGED " + JSON.stringify(rec))
    this.closeCard()
    this._onTagged.invoke(rec)
    return true
  }

  getRecord(id: string): CasualtyRecord {
    const r = this.records[id]
    const def = CASUALTY_TABLE[id]
    const res = evaluateStart(findingsFromDef(def), r.checks)
    return {
      id: id,
      checks: r.checks.slice(),
      presses: r.presses,
      openSeconds: Math.round(r.openSeconds * 100) / 100,
      tag: r.tag,
      tagWord: r.tag ? TAG_WORD[r.tag] : null,
      correctTag: def.correctTag,
      decidingStep: def.decidingStep,
      extraChecks: res.extraChecks,
      calledOut: r.calledOutAt !== null,
      calledOutAtSeconds: r.calledOutAt,
    }
  }

  getRecords(): CasualtyRecord[] {
    return Object.keys(this.records).map((id) => this.getRecord(id))
  }

  /** True when the casualty carries a tag band + word. */
  hasTagBand(id: string): boolean {
    const o = this.main.getCasualtyObject(id)
    if (!o) return false
    const band = this.findByName(o, "TagBand_" + id)
    const dot = this.dots[id]
    return !!band && !!dot && !!dot.word && dot.word.enabled && dot.word.getComponent("Component.Text") !== null
  }

  getTagWordText(id: string): string {
    const dot = this.dots[id]
    if (!dot || !dot.word) return ""
    return (dot.word.getComponent("Component.Text") as Text).text
  }

  // ------------------------------------------------------------------ run setup

  private rebuildForRun(): void {
    // the previous run's casualty objects (and our dots on them) have just been destroyed
    this.dots = {}
    this.anchors = {}
    this.records = {}
    this.dismissed = {}
    this.standing = {}
    this.closeCard()
    const state = this.main.getRunState()
    for (const c of state.casualties) {
      this.records[c.id] = { checks: [], presses: 0, openSeconds: 0, tag: null, calledOutAt: null }
      const cas = this.main.getCasualtyObject(c.id)
      if (cas) {
        this.dots[c.id] = this.buildDot(cas, c.id)
        this.anchors[c.id] = {
          head: this.findByName(cas, "Head"),
          torso: this.findByName(cas, "Torso"),
          dot: this.findByName(cas, "Dot_" + c.id),
        }
      }
    }
  }

  private findings(id: string): Findings {
    return findingsFromDef(CASUALTY_TABLE[id])
  }

  private airwayInsteadOfRate(id: string): boolean {
    const f = this.findings(id)
    return this.records[id].checks.indexOf("breathing") >= 0 && f.breathing === false
  }

  // ------------------------------------------------------------------ per-frame

  private viewerPos(): vec3 {
    return this.viewerOverride ? this.viewerOverride : this.cameraObject.getTransform().getWorldPosition()
  }

  private lookDir(): vec3 {
    if (this.lookOverride) return this.lookOverride
    return this.cameraObject.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1)).normalize()
  }

  private distTo(id: string, viewer: vec3): number {
    const o = this.main.getCasualtyObject(id)
    if (!o) return 1e9
    const p = o.getTransform().getWorldPosition()
    return Math.sqrt((p.x - viewer.x) * (p.x - viewer.x) + (p.z - viewer.z) * (p.z - viewer.z))
  }

  private tick(): void {
    if (!this.main || !this.main.isStarted() || !this.cardRoot || this.locked) return
    const dt = getDeltaTime()
    const viewer = this.viewerPos()
    if (this.cooldown > 0) this.cooldown -= dt

    // time spent with the card open
    if (this.openId && this.records[this.openId]) this.records[this.openId].openSeconds += dt

    // dismissed flags reset once the viewer has walked away
    for (const id in this.records) {
      if (this.dismissed[id] && this.distTo(id, viewer) > this.leaveCm) this.dismissed[id] = false
    }

    // nearest untagged casualty
    let nearest: string | null = null
    let nd = 1e9
    for (const id in this.records) {
      if (this.records[id].tag !== null) continue
      const d = this.distTo(id, viewer)
      if (d < nd) {
        nd = d
        nearest = id
      }
    }

    if (this.openId) {
      const od = this.distTo(this.openId, viewer)
      if (this.openReason === "proximity" && od > this.leaveCm) {
        this.closeCard()
      } else if (nearest && nearest !== this.openId && nd <= this.proximityCm && od > this.proximityCm && !this.dismissed[nearest]) {
        // walked up to someone else: show their card instead
        this.openCard(nearest, "proximity")
      }
    } else if (nearest && nd <= this.proximityCm && !this.dismissed[nearest] && this.cooldown <= 0) {
      this.openCard(nearest, "proximity")
    }

    this.billboard(viewer)
    if (this.openId) {
      this.followViewer(viewer, dt)
      this.updateConnector()
    }
  }

  private faceYaw(from: vec3, to: vec3): quat {
    const dx = to.x - from.x
    const dz = to.z - from.z
    return quat.fromEulerVec(new vec3(0, Math.atan2(dx, dz), 0))
  }

  private billboard(viewer: vec3): void {
    for (const id in this.dots) {
      const d = this.dots[id]
      if (isNull(d.root)) continue
      const t = d.root.getTransform()
      t.setWorldRotation(this.faceYaw(t.getWorldPosition(), viewer))
      if (d.word) {
        const wt = d.word.getTransform()
        wt.setWorldRotation(this.faceYaw(wt.getWorldPosition(), viewer))
      }
    }
    if (this.cardRoot.enabled) {
      // parallel to the view plane (no roll), so its edges stay upright however far down the viewer looks
      const look = this.lookDir()
      const yawQ = quat.fromEulerVec(new vec3(0, Math.atan2(-look.x, -look.z), 0))
      const pitchQ = quat.angleAxis(Math.asin(Math.max(-1, Math.min(1, look.y))), new vec3(1, 0, 0))
      this.cardRoot.getTransform().setWorldRotation(yawQ.multiply(pitchQ))
    }
  }

  // ------------------------------------------------------------------ card placement

  /** Camera right / up for a look direction. */
  private axes(look: vec3): { right: vec3; up: vec3 } {
    let right = look.cross(new vec3(0, 1, 0))
    right = right.length < 0.001 ? new vec3(1, 0, 0) : right.normalize()
    return { right: right, up: right.cross(look).normalize() }
  }

  /** Sample points on the open casualty's head and torso (world cm): the torso box's centre and eight corners,
   *  the head's centre and six points on its surface. The legs and arms are deliberately NOT sampled: the card
   *  may overlap them, but never the head or torso. */
  private samplePoints(id: string): vec3[] {
    const a = this.anchors[id]
    const pts: vec3[] = []
    if (!a || !a.torso || isNull(a.torso)) return pts
    const tt = a.torso.getTransform()
    const c = tt.getWorldPosition()
    const rot = tt.getWorldRotation()
    const sc = tt.getWorldScale()
    const u = this.main.boxUnitCm
    const hx = (sc.x * u) / 2
    const hy = (sc.y * u) / 2
    const hz = (sc.z * u) / 2
    pts.push(c)
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          pts.push(c.add(rot.multiplyVec3(new vec3(sx * hx, sy * hy, sz * hz))))
        }
      }
    }
    if (a.head && !isNull(a.head)) {
      const h = a.head.getTransform().getWorldPosition()
      pts.push(h)
      const r = 11
      pts.push(h.add(new vec3(r, 0, 0)), h.add(new vec3(-r, 0, 0)), h.add(new vec3(0, r, 0)), h.add(new vec3(0, -r, 0)), h.add(new vec3(0, 0, r)), h.add(new vec3(0, 0, -r)))
    }
    return pts
  }

  /** Would the card (centre c, parallel to the view plane) hide any head/torso sample point of casualty `id`? */
  private coveredAt(id: string, c: vec3, e: vec3, look: vec3): boolean {
    const ax = this.axes(look)
    const toCard = c.sub(e)
    const depth = toCard.dot(look)
    for (const q of this.samplePoints(id)) {
      const r = q.sub(e)
      const dn = r.dot(look)
      if (dn <= 0) continue
      const t = depth / dn
      if (t >= 1) continue // the card is behind this point
      const hit = e.add(r.uniformScale(t)).sub(c)
      const m = 0.5 + 1.5 * t // small safety margin; the sample points already span the head and torso
      const x = hit.dot(ax.right)
      const y = hit.dot(ax.up)
      if (Math.abs(x) < CHECK_W / 2 + m && y < CARD_TOP + m && y > -CARD_BOTTOM - m) return true
    }
    return false
  }

  /** Largest angle (deg) between the view direction and any corner of the whole card. */
  private maxCornerAngle(pos: vec3, viewer: vec3, look: vec3): number {
    const ax = this.axes(look)
    let worst = 0
    for (const sx of [-1, 1]) {
      for (const y of [CARD_TOP, -CARD_BOTTOM]) {
        const corner = pos.add(ax.right.uniformScale(sx * CHECK_W / 2)).add(ax.up.uniformScale(y))
        const a = (Math.acos(Math.max(-1, Math.min(1, corner.sub(viewer).normalize().dot(look)))) * 180) / Math.PI
        if (a > worst) worst = a
      }
    }
    return worst
  }

  /** Where the card should sit: along the view direction, a little below the centre of view. If that would cover
   *  the casualty's head or torso it moves to the most central spot that does not (the legs and arms may be
   *  covered), i.e. the one where the whole card, all four corners, stays closest to the centre of view. */
  private cardGoal(viewer: vec3, id: string | null): vec3 {
    const look = this.lookDir()
    const ax = this.axes(look)
    const base = viewer.add(look.uniformScale(this.cardDistanceCm)).sub(ax.up.uniformScale(this.cardDropCm))
    if (!id || !this.coveredAt(id, base, viewer, look)) return base
    // slide it sideways (or down) just far enough to clear the head and torso, choosing the clear spot that keeps
    // the whole card (all four corners) closest to the centre of view
    const pts = this.samplePoints(id)
    const side = pts.length && pts[0].sub(viewer).dot(ax.right) > 0 ? -1 : 1
    let best: vec3 | null = null
    let bestScore = 1e9
    for (let k = 0; k <= 32; k++) {
      for (let v = -2; v <= 8; v++) {
        for (const sgn of [side, -side]) {
          const pos = base.add(ax.right.uniformScale(sgn * k * 1.5)).sub(ax.up.uniformScale(v * 4))
          if (this.coveredAt(id, pos, viewer, look)) continue
          // most central = smallest worst-corner angle; the tiny terms only break ties (prefer the shorter move)
          const score = this.maxCornerAngle(pos, viewer, look) + 0.001 * (k * 1.5 + Math.abs(v) * 4) + (sgn === side ? 0 : 0.01)
          if (score < bestScore) {
            bestScore = score
            best = pos
          }
        }
      }
    }
    return best ? best : base.add(ax.right.uniformScale(side * 36)).sub(ax.up.uniformScale(8))
  }

  private placeCard(snap: boolean): void {
    const goal = this.cardGoal(this.viewerPos(), this.openId)
    this.cardGoalPos = goal
    this.cardFollowing = false
    if (snap) this.cardRoot.getTransform().setWorldPosition(goal)
  }

  /** The card stays where it is (not stuck to the head). Only when it has left the view, or the viewer has
   *  walked away from it, does it glide back to a fresh spot in view. */
  private followViewer(viewer: vec3, dt: number): void {
    const ct = this.cardRoot.getTransform()
    const cur = ct.getWorldPosition()
    const look = this.lookDir()
    const to = cur.sub(viewer)
    const dist = to.length
    const ang = dist < 0.01 ? 0 : (Math.acos(Math.max(-1, Math.min(1, to.normalize().dot(look)))) * 180) / Math.PI
    if (!this.cardFollowing && (ang > FOLLOW_ANGLE || Math.abs(dist - this.cardDistanceCm) > 35)) this.cardFollowing = true
    if (!this.cardFollowing) return
    const goal = this.cardGoal(viewer, this.openId)
    this.cardGoalPos = goal
    const k = Math.min(1, dt * 4)
    const next = cur.add(goal.sub(cur).uniformScale(k))
    ct.setWorldPosition(next)
    if (goal.sub(next).length < 2) this.cardFollowing = false
  }

  /** A thin line from the card's side edge to the open casualty's dot, so it is clear whose card it is. */
  private updateConnector(): void {
    const id = this.openId
    const a = id ? this.anchors[id] : null
    if (!this.line || !id || !a || !a.dot || isNull(a.dot)) {
      if (this.line) this.line.enabled = false
      return
    }
    const ct = this.cardRoot.getTransform()
    const c = ct.getWorldPosition()
    const b = a.dot.getTransform().getWorldPosition()
    const right = ct.getWorldRotation().multiplyVec3(new vec3(1, 0, 0))
    const sgn = b.sub(c).dot(right) >= 0 ? 1 : -1
    const from = c.add(right.uniformScale(sgn * (CHECK_W / 2)))
    const d = b.sub(from)
    const len = d.length
    this.lineFrom = from
    this.lineTo = b
    if (len < 1) {
      this.line.enabled = false
      return
    }
    this.line.enabled = true
    const lt = this.line.getTransform()
    lt.setWorldPosition(from.add(d.uniformScale(0.5)))
    lt.setWorldRotation(quat.rotationFromTo(new vec3(0, 0, 1), d.uniformScale(1 / len)))
    const unit = this.main.boxUnitCm
    lt.setWorldScale(new vec3(0.5 / unit, 0.5 / unit, len / unit))
  }

  // ------------------------------------------------------------------ card refresh

  private refreshCard(): void {
    const id = this.openId
    if (!id) return
    const def = CASUALTY_TABLE[id]
    const f = this.findings(id)
    const rec = this.records[id]
    this.titleText.text = def.poseLabel
    this.statusBase = f.walks ? "Can walk: Yes" : "Can walk: No"
    this.showStatus()

    const names: { key: string; check: CheckId }[] = [
      { key: "breathing", check: "breathing" },
      { key: "second", check: this.airwayInsteadOfRate(id) ? "airway" : "rate" },
      { key: "pulse", check: "pulse" },
      { key: "commands", check: "commands" },
    ]
    for (const n of names) {
      const slot = this.checkButtons[n.key]
      if (rec.checks.indexOf(n.check) >= 0) {
        const r = checkResultText(f, n.check)
        slot.label.text = r === "—" ? CHECK_LABEL[n.check] + ": —" : r
        slot.label.textFill.color = new vec4(0.7, 1, 0.8, 1)
      } else {
        slot.label.text = CHECK_LABEL[n.check]
        slot.label.textFill.color = this.textColor
      }
    }
    const res = evaluateStart(f, rec.checks)
    this.tagPanel.enabled = res.decided
  }

  // ------------------------------------------------------------------ tagging visuals

  private applyTag(id: string, tag: StartTag): void {
    const cas = this.main.getCasualtyObject(id)
    const dot = this.dots[id]
    if (!cas || !this.builder) return
    const stands = !!this.standing[id]
    this.builder.addTagBand(cas, id as CasualtyId, tag, stands)
    if (dot) {
      dot.root.enabled = false
      const sphere = this.findByName(cas, "Dot_" + id)
      if (sphere) sphere.enabled = false
      if (!dot.word) {
        const w = global.scene.createSceneObject("Dot_Word_" + id)
        w.setParent(cas)
        w.getTransform().setLocalPosition(new vec3(0, stands ? 182 : 112, 0)) // above a standing walker's head
        const t = w.createComponent("Component.Text") as Text
        t.depthTest = true
        t.size = 150
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        t.horizontalOverflow = HorizontalOverflow.Overflow
        t.verticalOverflow = VerticalOverflow.Overflow
        t.layoutRect = Rect.create(-30, 30, -6, 6)
        dot.word = w
      }
      const t = dot.word.getComponent("Component.Text") as Text
      t.text = TAG_WORD[tag]
      t.textFill.color = TAG_COLOUR[tag]
      dot.word.enabled = true
    }
  }

  private findByName(root: SceneObject, name: string): SceneObject | null {
    if (root.name === name) return root
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const r = this.findByName(root.getChild(i), name)
      if (r) return r
    }
    return null
  }

  // ------------------------------------------------------------------ dots

  private refreshDots(): void {
    for (const id in this.dots) {
      const d = this.dots[id]
      if (isNull(d.root)) continue
      if (this.records[id] && this.records[id].tag === null) d.label.text = this.openId === id ? "Close" : "Open"
    }
  }

  private buildDot(cas: SceneObject, id: string): DotUI {
    const root = global.scene.createSceneObject("Dot_Open_" + id)
    root.setParent(cas)
    root.getTransform().setLocalPosition(new vec3(0, 122, 0))
    root.createComponent("Component.Canvas")
    const btnSO = global.scene.createSceneObject("OpenButton_" + id)
    btnSO.setParent(root)
    const btn = btnSO.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(14, 5.5, 1)
    const label = this.addButtonLabel(btnSO, "Open", 13, 48)
    btn.onTriggerUp.add(() => {
      if (this.openId === id) {
        this.dismissed[id] = true
        this.closeCard()
      } else {
        this.openCard(id, "button")
      }
    })
    return { root: root, label: label, button: btn, word: null }
  }

  // ------------------------------------------------------------------ card build (UIKit)

  private buildCard(): void {
    this.cardRoot = global.scene.createSceneObject("CheckCard")
    this.cardRoot.setParent(this.sceneObject)

    // --- check panel
    this.checkPanel = global.scene.createSceneObject("CheckPanel")
    this.checkPanel.setParent(this.cardRoot)
    this.checkPanel.createComponent("Component.Canvas")
    const back = this.checkPanel.createComponent(BackPlate.getTypeName()) as BackPlate
    back.size = new vec2(CHECK_W, CHECK_H)
    const content = global.scene.createSceneObject("Content")
    content.setParent(this.checkPanel)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0.5
    flex.paddingTop = 1.0
    flex.paddingBottom = 1.0
    flex.paddingLeft = 1.0
    flex.paddingRight = 1.0
    flex.width = CHECK_W
    flex.height = CHECK_H

    this.titleText = this.addText(content, "Title", "", TYPE_TITLE, CHECK_W - 2, 2.4)
    this.statusText = this.addText(content, "Status", "", TYPE_STATUS, CHECK_W - 2, 1.8)
    const slots = ["breathing", "second", "pulse", "commands"]
    const labels = ["Breathing?", "Breathing rate", "Pulse / refill", "Follows commands?"]
    const objNames = ["CardBtn_breathing", "CardBtn_second", "CardBtn_pulse", "CardBtn_commands"]
    const checks: CheckId[] = ["breathing", "rate", "pulse", "commands"]
    for (let i = 0; i < slots.length; i++) {
      const so = global.scene.createSceneObject(objNames[i])
      so.setParent(content)
      const btn = so.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(CHECK_W - 3, CHECK_BTN_H, 1)
      const label = this.addButtonLabel(so, labels[i], CHECK_W - 4, TYPE_BUTTON)
      const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
      item.overrideWidth = CHECK_W - 3
      item.overrideHeight = CHECK_BTN_H
      const check = checks[i]
      btn.onTriggerUp.add(() => this.pressCheck(check))
      this.checkButtons[slots[i]] = { button: btn, label: label, obj: so }
    }

    // --- tag panel (below the check panel; only enabled once a step has decided the tag)
    this.tagPanel = global.scene.createSceneObject("TagPanel")
    this.tagPanel.setParent(this.cardRoot)
    this.tagPanel.getTransform().setLocalPosition(new vec3(0, -(CHECK_H / 2 + TAG_GAP + TAG_H / 2), 0))
    this.tagPanel.createComponent("Component.Canvas")
    const tback = this.tagPanel.createComponent(BackPlate.getTypeName()) as BackPlate
    tback.size = new vec2(CHECK_W, TAG_H)
    const tcontent = global.scene.createSceneObject("Content")
    tcontent.setParent(this.tagPanel)
    tcontent.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const tflex = tcontent.createComponent(FlexLayout.getTypeName()) as FlexLayout
    tflex.direction = FlexDirection.Row
    tflex.alignItems = FlexAlign.Center
    tflex.justifyContent = FlexJustify.Center
    tflex.columnGap = 0.4
    tflex.paddingLeft = 0.7
    tflex.paddingRight = 0.7
    tflex.paddingTop = 1.0
    tflex.paddingBottom = 1.0
    tflex.width = CHECK_W
    tflex.height = TAG_H
    const tags: { tag: StartTag; name: string; text: string; w: number }[] = [
      { tag: "Red", name: "TagBtn_Red", text: "RED", w: 4.4 },
      { tag: "Yellow", name: "TagBtn_Yellow", text: "YELLOW", w: 5.6 },
      { tag: "Green", name: "TagBtn_Green", text: "GREEN", w: 5.0 },
      { tag: "Black", name: "TagBtn_Expectant", text: "EXPECTANT", w: 7.4 },
    ]
    for (const t of tags) {
      const so = global.scene.createSceneObject(t.name)
      so.setParent(tcontent)
      const btn = so.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(t.w, 5, 1)
      const label = this.addButtonLabel(so, t.text, t.w - 0.3, TYPE_TAG)
      label.textFill.color = TAG_COLOUR[t.tag]
      const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
      item.overrideWidth = t.w
      item.overrideHeight = 5
      const tg = t.tag
      btn.onTriggerUp.add(() => this.chooseTag(tg))
      this.tagButtons[t.name] = { button: btn, label: label, obj: so }
    }

    this.tagPanel.enabled = false
    this.cardRoot.enabled = false

    if (this.builder) {
      this.line = this.builder.createPart(this.sceneObject, "CardConnector", "box", [0, 0, 0], [0.5, 0.5, 0.5], [0.55, 0.95, 1.0])
      this.line.enabled = false
    }
  }

  private addText(parent: SceneObject, name: string, text: string, size: number, widthCm: number, heightCm: number): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.size = size
    t.textFill.color = this.textColor
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCm
    item.overrideHeight = heightCm
    return t
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCm: number, size: number): Text {
    const so = global.scene.createSceneObject("ButtonLabel")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.size = size
    t.textFill.color = this.textColor
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -1.2, 1.2)
    return t
  }
}
