/**
 * TriageSceneClear.ts - the "Scene clear" button: the player decides when they are finished.
 * A plain class (not a component): TriageDebrief creates it, so the scene needs no new object.
 * Owns:
 *  - the button: appears after the first tag or call-out, hides while a check card is open or the run is over;
 *  - it is head-following in the card's lazy way (stays put, glides back only when it has drifted out of the comfortable
 *    part of the view), sits low in view, and never covers a casualty's head or torso (it moves aside, or hides if there is
 *    no clear spot);
 *  - the question "Have you found everyone?" with "Yes, scene clear" / "Keep looking". It says nothing about how many
 *    people remain. The clock keeps running while it is open;
 *  - "Yes": ends the run with reason "scene-clear" (after a walker who is still walking has arrived).
 * Public API (for tests): pressSceneClear(), answerYes(), answerKeepLooking(), isButtonVisible(), isQuestionOpen(),
 *   isPending(), getButtonObject(), getQuestionObject(), getQuestionTexts(), setViewerOverride(position, look).
 * Must not: tag anyone, own the clock, or build the debrief.
 */
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { TriageMain } from "./TriageMain"
import { TriageCheckCards } from "./TriageCheckCards"
import { TriageRunClock } from "./TriageRunClock"
import { TriageCallOut } from "./TriageCallOut"
import { PAD, GAP, addPressPop, hidePanel, hidePanelNow, showPanel, sizesAt } from "./TriageUi"

export const SCENE_CLEAR_QUESTION = "Have you found everyone?"
export const SCENE_CLEAR_YES = "Yes, scene clear"
export const SCENE_CLEAR_KEEP = "Keep looking"
export const SCENE_CLEAR_LABEL = "Scene clear"

const DISTANCE_CM = 60
/** centre of the panel this far below the middle of the view (cm, at DISTANCE_CM) */
const DROP_CM = 7.5
/** the question is taller, so its centre sits higher (still below the middle of the view) to stay fully in view */
const Q_DROP_CM = 1.5
const BTN_W = 18
const BTN_H = 6.5
const Q_BTN_W = 18
const Q_BTN_H = 6.5
const TITLE_H = 3
const Z = 0.6
/** the panel glides back when its centre is this far (deg) from where it would be placed now */
const FOLLOW_DEG = 12
const LABEL_Z = 0.08
const WHITE = new vec4(1, 1, 1, 1)

export interface SceneClearDeps {
  host: BaseScriptComponent
  parent: SceneObject
  main: TriageMain
  cards: TriageCheckCards
  clock: TriageRunClock
  callOut: TriageCallOut
  cameraObject: SceneObject
}

export class TriageSceneClear {
  private d: SceneClearDeps
  private button: SceneObject | null = null
  private question: SceneObject | null = null
  private questionTitle: Text | null = null
  private buttonOn = false
  private questionOn = false
  private armed = false
  private asking = false
  private pending = false
  private viewerOverride: vec3 | null = null
  private lookOverride: vec3 | null = null
  private following = false
  private w = BTN_W + 2 * PAD
  private h = BTN_H + 2 * PAD
  private qw = Q_BTN_W + 2 * PAD + 3
  private qh = 2 * PAD + TITLE_H + 2 * GAP + 2 * Q_BTN_H

  constructor(deps: SceneClearDeps) {
    this.d = deps
    this.build()
    this.d.main.onRegenerated.add(() => this.reset())
    this.d.main.onRunStarted.add(() => this.reset())
    this.d.cards.onCasualtyTagged.add(() => {
      if (this.d.clock.isRunning()) this.armed = true
    })
    this.d.host.createEvent("UpdateEvent").bind(() => this.tick())
  }

  // ------------------------------------------------------------------ public API

  setViewerOverride(p: vec3 | null, look?: vec3 | null): void {
    this.viewerOverride = p
    this.lookOverride = p && look ? look.normalize() : null
  }
  isButtonVisible(): boolean {
    return this.buttonOn
  }
  isQuestionOpen(): boolean {
    return this.questionOn
  }
  isPending(): boolean {
    return this.pending
  }
  getButtonObject(): SceneObject | null {
    return this.button && !isNull(this.button) ? this.button : null
  }
  getQuestionObject(): SceneObject | null {
    return this.question && !isNull(this.question) ? this.question : null
  }
  /** Every text on the question panel (title and both buttons). */
  getQuestionTexts(): string[] {
    const out: string[] = []
    const visit = (so: SceneObject): void => {
      const t = so.getComponent("Component.Text") as Text
      if (t) out.push(t.text)
      for (let i = 0; i < so.getChildrenCount(); i++) visit(so.getChild(i))
    }
    if (this.question && !isNull(this.question)) visit(this.question)
    return out
  }
  /** Size (cm) of the button panel and the question panel. */
  getSizes(): { button: { w: number; h: number }; question: { w: number; h: number } } {
    return { button: { w: this.w, h: this.h }, question: { w: this.qw, h: this.qh } }
  }

  /** Same code path as pinching "Scene clear". False if it is not on show. */
  pressSceneClear(): boolean {
    if (!this.buttonOn) return false
    this.asking = true
    print("TRIAGE_SCENE_CLEAR_ASKED")
    return true
  }

  /** Same code path as pinching "Yes, scene clear". */
  answerYes(): boolean {
    if (!this.questionOn || this.pending) return false
    this.asking = false
    this.pending = true
    print("TRIAGE_SCENE_CLEAR_YES")
    return true
  }

  /** Same code path as pinching "Keep looking": the question closes and the clock carries on. */
  answerKeepLooking(): boolean {
    if (!this.questionOn) return false
    this.asking = false
    print("TRIAGE_SCENE_CLEAR_KEEP_LOOKING")
    return true
  }

  // ------------------------------------------------------------------ state

  private reset(): void {
    this.armed = false
    this.asking = false
    this.pending = false
    this.following = false
    if (this.button) hidePanelNow(this.button)
    if (this.question) hidePanelNow(this.question)
    this.buttonOn = false
    this.questionOn = false
  }

  private tick(): void {
    const d = this.d
    if (!d.main.isStarted()) return
    const ended = d.clock.isEnded()
    if (ended || !d.clock.isRunning()) {
      this.pending = false
      this.asking = false
    }
    if (this.pending) {
      const ph = d.callOut.getPhase()
      if (ph !== "standing" && ph !== "walking") {
        this.pending = false
        d.clock.endRun("scene-clear")
      }
    }
    const running = d.clock.isRunning() && !d.clock.isEnded()
    const cardOpen = d.cards.isCardVisible()
    if (cardOpen) this.asking = false // a card opening closes the question, like "Keep looking"
    const wantQuestion = running && this.asking && !this.pending
    const wantButton = running && this.armed && !this.asking && !this.pending && !cardOpen
    this.setShown(wantButton, wantQuestion)
  }

  private setShown(wantButton: boolean, wantQuestion: boolean): void {
    const which = wantQuestion ? this.question : wantButton ? this.button : null
    const cur = which === this.question ? { w: this.qw, h: this.qh } : { w: this.w, h: this.h }
    let placed = false
    if (which) {
      const eye = this.eye()
      const look = this.look()
      const ax = this.axes(look)
      const goal = this.goalFor(eye, look, ax, cur.w, cur.h, which === this.question ? Q_DROP_CM : DROP_CM)
      const pos = which.getTransform().getWorldPosition()
      const justShown = (which === this.button && !this.buttonOn) || (which === this.question && !this.questionOn)
      if (goal) {
        placed = true
        if (justShown) {
          which.getTransform().setWorldPosition(goal)
          this.following = false
        } else {
          this.follow(which, pos, goal, eye, look, ax, cur.w, cur.h)
        }
        this.orient(which, look)
      }
    }
    const showBtn = wantButton && placed && which === this.button
    const showQ = wantQuestion && placed && which === this.question
    if (showBtn !== this.buttonOn && this.button) {
      this.buttonOn = showBtn
      if (showBtn) showPanel(this.button)
      else hidePanel(this.button)
    }
    if (showQ !== this.questionOn && this.question) {
      this.questionOn = showQ
      if (showQ) showPanel(this.question)
      else hidePanel(this.question)
    }
  }

  // ------------------------------------------------------------------ placement

  private eye(): vec3 {
    return this.viewerOverride ? this.viewerOverride : this.d.cameraObject.getTransform().getWorldPosition()
  }
  private look(): vec3 {
    if (this.lookOverride) return this.lookOverride
    return this.d.cameraObject.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1)).normalize()
  }
  private axes(look: vec3): { right: vec3; up: vec3 } {
    let right = look.cross(new vec3(0, 1, 0))
    right = right.length < 0.001 ? new vec3(1, 0, 0) : right.normalize()
    return { right: right, up: right.cross(look).normalize() }
  }
  private halfTans(): { h: number; v: number } {
    const cam = this.d.cameraObject.getComponent("Component.Camera") as Camera
    let fov = cam ? cam.fov : 0.9
    if (!(fov > 0.05 && fov < 3)) fov = 0.9
    let aspect = cam ? cam.aspect : 1
    if (!(aspect > 0.2 && aspect < 5)) aspect = 1
    const v = Math.tan(fov / 2)
    return { h: v * aspect, v: v }
  }

  /** Would a w x h panel centred at c (facing the eye, parallel to the view plane) hide any casualty's head or torso? */
  covers(c: vec3, eye: vec3, look: vec3, w: number, h: number, avoidCallOut: boolean = false): boolean {
    const ax = this.axes(look)
    const depth = c.sub(eye).dot(look)
    if (avoidCallOut) {
      const co = this.d.callOut.getButtonRect()
      if (co) {
        const rel = co.pos.sub(eye)
        const dn = rel.dot(look)
        if (dn > 5) {
          const t = depth / dn // the call-out's board as it would appear on this panel's plane
          const dx = rel.dot(ax.right) * t - c.sub(eye).dot(ax.right)
          const dy = rel.dot(ax.up) * t - c.sub(eye).dot(ax.up)
          if (Math.abs(dx) < w / 2 + (co.w * t) / 2 + 0.5 && Math.abs(dy) < h / 2 + (co.h * t) / 2 + 0.5) return true
        }
      }
    }
    for (const rec of this.d.cards.getRecords()) {
      for (const q of this.d.cards.getBodySamplePoints(rec.id)) {
        const r = q.sub(eye)
        const dn = r.dot(look)
        if (dn <= 0) continue
        const t = depth / dn
        if (t >= 1) continue // the panel is behind this point
        const hit = eye.add(r.uniformScale(t)).sub(c)
        const m = 0.5 + 1.5 * t
        if (Math.abs(hit.dot(ax.right)) < w / 2 + m && Math.abs(hit.dot(ax.up)) < h / 2 + m) return true
      }
    }
    return false
  }

  /** Is a w x h panel centred at c inside the comfortable part of the view? */
  private inView(c: vec3, eye: vec3, look: vec3, ax: { right: vec3; up: vec3 }, w: number, h: number): boolean {
    const t = this.halfTans()
    const rel = c.sub(eye)
    const z = rel.dot(look)
    if (z < 5) return false
    const x = Math.abs(rel.dot(ax.right)) + w / 2
    const y = Math.abs(rel.dot(ax.up)) + h / 2
    return x / z < t.h * 0.85 && y / z < t.v * 0.85
  }

  /** Low in view, in front; moved sideways (or down) just enough to stay off every head and torso. null = no clear spot. */
  private goalFor(eye: vec3, look: vec3, ax: { right: vec3; up: vec3 }, w: number, h: number, drop: number): vec3 | null {
    // clear of the casualties AND the call-out button if there is room; failing that, clear of the casualties only
    return this.search(eye, look, ax, w, h, drop, true) || this.search(eye, look, ax, w, h, drop, false)
  }

  private search(eye: vec3, look: vec3, ax: { right: vec3; up: vec3 }, w: number, h: number, drop: number, avoidCallOut: boolean): vec3 | null {
    const base = eye.add(look.uniformScale(DISTANCE_CM)).sub(ax.up.uniformScale(drop))
    if (this.inView(base, eye, look, ax, w, h) && !this.covers(base, eye, look, w, h, avoidCallOut)) return base
    let best: vec3 | null = null
    let bestScore = 1e9
    for (let k = 0; k <= 20; k++) {
      for (let v = -4; v <= 6; v++) {
        for (const sgn of [1, -1]) {
          const pos = base.add(ax.right.uniformScale(sgn * k * 1.5)).sub(ax.up.uniformScale(v * 1.5))
          if (!this.inView(pos, eye, look, ax, w, h) || this.covers(pos, eye, look, w, h, avoidCallOut)) continue
          const score = k * 1.5 + Math.abs(v) * 1.5
          if (score < bestScore) {
            bestScore = score
            best = pos
          }
        }
      }
    }
    return best
  }

  /** Lazy follow: stay where it is; glide to the goal only when it has drifted away from it or now covers someone. */
  private follow(o: SceneObject, cur: vec3, goal: vec3, eye: vec3, look: vec3, ax: { right: vec3; up: vec3 }, w: number, h: number): void {
    const a = cur.sub(eye).normalize()
    const b = goal.sub(eye).normalize()
    const ang = (Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180) / Math.PI
    const distOff = Math.abs(cur.sub(eye).length - goal.sub(eye).length)
    const bad = !this.inView(cur, eye, look, ax, w, h) || this.covers(cur, eye, look, w, h)
    if (!this.following && (ang > FOLLOW_DEG || distOff > 25 || bad)) this.following = true
    if (!this.following) return
    const k = Math.min(1, getDeltaTime() * 4)
    const next = cur.add(goal.sub(cur).uniformScale(k))
    o.getTransform().setWorldPosition(next)
    if (goal.sub(next).length < 2) this.following = false
  }

  /** Parallel to the view plane, upright (no roll), as the check card is. */
  private orient(o: SceneObject, look: vec3): void {
    const yawQ = quat.fromEulerVec(new vec3(0, Math.atan2(-look.x, -look.z), 0))
    const pitchQ = quat.angleAxis(Math.asin(Math.max(-1, Math.min(1, look.y))), new vec3(1, 0, 0))
    o.getTransform().setWorldRotation(yawQ.multiply(pitchQ))
  }

  // ------------------------------------------------------------------ build

  private build(): void {
    const sz = sizesAt(DISTANCE_CM)
    this.button = this.panel("SceneClearPanel", this.w, this.h)
    this.addButton(this.button, "SceneClearButton", SCENE_CLEAR_LABEL, 0, 0, BTN_W, BTN_H, sz.body, () => this.pressSceneClear())

    this.question = this.panel("SceneClearQuestion", this.qw, this.qh)
    const content = this.question.getChild(0)
    const top = this.qh / 2
    const titleY = top - PAD - TITLE_H / 2
    this.questionTitle = this.addText(content, "QuestionTitle", SCENE_CLEAR_QUESTION, sz.title, 0, titleY)
    const y1 = titleY - TITLE_H / 2 - GAP - Q_BTN_H / 2
    this.addButton(this.question, "SceneClearYes", SCENE_CLEAR_YES, 0, y1, Q_BTN_W, Q_BTN_H, sz.body, () => this.answerYes())
    this.addButton(this.question, "SceneClearKeep", SCENE_CLEAR_KEEP, 0, y1 - Q_BTN_H - GAP, Q_BTN_W, Q_BTN_H, sz.body, () => this.answerKeepLooking())
  }

  private panel(name: string, w: number, h: number): SceneObject {
    const root = global.scene.createSceneObject(name)
    root.setParent(this.d.parent)
    root.createComponent("Component.Canvas")
    const back = root.createComponent(BackPlate.getTypeName()) as BackPlate
    back.size = new vec2(w, h)
    const content = global.scene.createSceneObject("Content")
    content.setParent(root)
    content.getTransform().setLocalPosition(new vec3(0, 0, Z))
    root.enabled = false
    return root
  }

  private addButton(panel: SceneObject, name: string, label: string, x: number, y: number, w: number, h: number, size: number, onPress: () => void): void {
    const content = panel.getChild(0)
    const so = global.scene.createSceneObject(name)
    so.setParent(content)
    so.getTransform().setLocalPosition(new vec3(x, y, 0))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(w, h, 1)
    const lab = global.scene.createSceneObject("ButtonLabel")
    lab.setParent(so)
    lab.getTransform().setLocalPosition(new vec3(0, 0, LABEL_Z))
    this.addText(lab, "Text", label, size, 0, 0)
    btn.onTriggerUp.add(onPress)
    addPressPop(btn, so)
  }

  private addText(parent: SceneObject, name: string, text: string, size: number, x: number, y: number): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(x, y, 0))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.size = size
    t.textFill.color = WHITE
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-9, 9, -2, 2)
    return t
  }
}
