/**
 * TriageCheckCards.ts - build step 2: the dot above each casualty, the check card, tagging, per-casualty records.
 * Owns: proximity / "Open" opening of one shared check card, the START check buttons (scripted results from
 *       the casualty table), tag buttons (only once a step has decided the tag), the tag band + word, and the
 *       records (checks made, time spent, tag) that the step 4 debrief will read.
 * Uses: TriageStartEngine (pure rules), TriageMain (casualty objects, run events), SIK + UI Kit buttons.
 * Public API (for tests): openCard, closeCard, getOpenCasualtyId, getOpenReason, pressCheck, chooseTag,
 *   getCardLabels, isTagPanelVisible, getRecord, getRecords, setViewerOverride, onCasualtyTagged.
 * Must not: implement the timer, call-out, groan, arrow or debrief (later steps).
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
}

type OpenReason = "proximity" | "button"

const TYPE_BUTTON = 54
const TYPE_TITLE = 58
const TYPE_STATUS = 42
const BUTTON_LABEL_Z = 0.08
const CONTENT_Z = 0.6

const CHECK_W = 34
const CHECK_H = 29.5
const TAG_H = 8
const TAG_GAP = 0.8
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
  cardDistanceCm: number = 80

  @input
  @widget(new SliderWidget(0, 40, 1))
  @hint("How far the top of the card sits below eye level (cm)")
  cardDropCm: number = 6

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
  private records: { [id: string]: { checks: CheckId[]; presses: number; openSeconds: number; tag: StartTag | null } } = {}
  private dismissed: { [id: string]: boolean } = {}

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
  private cardTarget: vec3 | null = null
  private cardFollowing = false

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
  setViewerOverride(p: vec3 | null): void {
    this.viewerOverride = p
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

  openCard(id: string, reason: OpenReason): void {
    if (!this.main.isStarted() || !this.records[id] || this.records[id].tag !== null) return
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
    this.records = {}
    this.dismissed = {}
    this.closeCard()
    const state = this.main.getRunState()
    for (const c of state.casualties) {
      this.records[c.id] = { checks: [], presses: 0, openSeconds: 0, tag: null }
      const cas = this.main.getCasualtyObject(c.id)
      if (cas) this.dots[c.id] = this.buildDot(cas, c.id)
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
    const d = this.cameraObject.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const flat = new vec3(d.x, 0, d.z)
    return flat.length < 0.01 ? new vec3(0, 0, -1) : flat.normalize()
  }

  private distTo(id: string, viewer: vec3): number {
    const o = this.main.getCasualtyObject(id)
    if (!o) return 1e9
    const p = o.getTransform().getWorldPosition()
    return Math.sqrt((p.x - viewer.x) * (p.x - viewer.x) + (p.z - viewer.z) * (p.z - viewer.z))
  }

  private tick(): void {
    if (!this.main || !this.main.isStarted() || !this.cardRoot) return
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
    if (this.openId) this.followViewer(viewer, dt)
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
      const ct = this.cardRoot.getTransform()
      ct.setWorldRotation(this.faceYaw(ct.getWorldPosition(), viewer))
    }
  }

  // ------------------------------------------------------------------ card placement

  private cardGoal(viewer: vec3): vec3 {
    const f = this.lookDir()
    // centre of the check panel: top edge cardDropCm below the eyes
    const cy = viewer.y - this.cardDropCm - CHECK_H / 2
    return new vec3(viewer.x + f.x * this.cardDistanceCm, cy, viewer.z + f.z * this.cardDistanceCm)
  }

  private placeCard(snap: boolean): void {
    const goal = this.cardGoal(this.viewerPos())
    this.cardTarget = goal
    this.cardFollowing = false
    if (snap) this.cardRoot.getTransform().setWorldPosition(goal)
  }

  /** The card stays put; it only glides to a fresh spot when the viewer has turned or walked away from it. */
  private followViewer(viewer: vec3, dt: number): void {
    const ct = this.cardRoot.getTransform()
    const cur = ct.getWorldPosition()
    const f = this.lookDir()
    const to = new vec3(cur.x - viewer.x, 0, cur.z - viewer.z)
    const dist = to.length
    const cos = dist < 0.01 ? 1 : (to.x * f.x + to.z * f.z) / dist
    const angleOff = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
    if (!this.cardFollowing && (angleOff > 40 || Math.abs(dist - this.cardDistanceCm) > 35)) this.cardFollowing = true
    if (!this.cardFollowing) return
    const goal = this.cardGoal(viewer)
    const k = Math.min(1, dt * 5)
    const next = new vec3(cur.x + (goal.x - cur.x) * k, cur.y + (goal.y - cur.y) * k, cur.z + (goal.z - cur.z) * k)
    ct.setWorldPosition(next)
    if (Math.abs(goal.x - next.x) + Math.abs(goal.z - next.z) < 3) this.cardFollowing = false
  }

  // ------------------------------------------------------------------ card refresh

  private refreshCard(): void {
    const id = this.openId
    if (!id) return
    const def = CASUALTY_TABLE[id]
    const f = this.findings(id)
    const rec = this.records[id]
    this.titleText.text = def.poseLabel
    this.statusText.text = f.walks ? "Can walk: Yes" : "Can walk: No"

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
    this.builder.addTagBand(cas, id as CasualtyId, tag)
    if (dot) {
      dot.root.enabled = false
      const sphere = this.findByName(cas, "Dot_" + id)
      if (sphere) sphere.enabled = false
      if (!dot.word) {
        const w = global.scene.createSceneObject("Dot_Word_" + id)
        w.setParent(cas)
        w.getTransform().setLocalPosition(new vec3(0, 112, 0))
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
    flex.rowGap = 0.6
    flex.paddingTop = 1.2
    flex.paddingBottom = 1.2
    flex.paddingLeft = 1.2
    flex.paddingRight = 1.2
    flex.width = CHECK_W
    flex.height = CHECK_H

    this.titleText = this.addText(content, "Title", "", TYPE_TITLE, CHECK_W - 2, 2.6)
    this.statusText = this.addText(content, "Status", "", TYPE_STATUS, CHECK_W - 2, 2.0)
    const slots = ["breathing", "second", "pulse", "commands"]
    const labels = ["Breathing?", "Breathing rate", "Pulse / refill", "Follows commands?"]
    const objNames = ["CardBtn_breathing", "CardBtn_second", "CardBtn_pulse", "CardBtn_commands"]
    const checks: CheckId[] = ["breathing", "rate", "pulse", "commands"]
    for (let i = 0; i < slots.length; i++) {
      const so = global.scene.createSceneObject(objNames[i])
      so.setParent(content)
      const btn = so.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(CHECK_W - 4, 4.8, 1)
      const label = this.addButtonLabel(so, labels[i], CHECK_W - 5, TYPE_BUTTON)
      const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
      item.overrideWidth = CHECK_W - 4
      item.overrideHeight = 4.8
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
    tflex.columnGap = 0.6
    tflex.paddingLeft = 1.0
    tflex.paddingRight = 1.0
    tflex.paddingTop = 1.0
    tflex.paddingBottom = 1.0
    tflex.width = CHECK_W
    tflex.height = TAG_H
    const tags: { tag: StartTag; name: string; text: string; w: number }[] = [
      { tag: "Red", name: "TagBtn_Red", text: "RED", w: 6.4 },
      { tag: "Yellow", name: "TagBtn_Yellow", text: "YELLOW", w: 7.8 },
      { tag: "Green", name: "TagBtn_Green", text: "GREEN", w: 6.8 },
      { tag: "Black", name: "TagBtn_Expectant", text: "EXPECTANT", w: 10.4 },
    ]
    for (const t of tags) {
      const so = global.scene.createSceneObject(t.name)
      so.setParent(tcontent)
      const btn = so.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(t.w, 5.6, 1)
      const label = this.addButtonLabel(so, t.text, t.w - 0.4, 40)
      label.textFill.color = TAG_COLOUR[t.tag]
      const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
      item.overrideWidth = t.w
      item.overrideHeight = 5.6
      const tg = t.tag
      btn.onTriggerUp.add(() => this.chooseTag(tg))
      this.tagButtons[t.name] = { button: btn, label: label, obj: so }
    }

    this.tagPanel.enabled = false
    this.cardRoot.enabled = false
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
