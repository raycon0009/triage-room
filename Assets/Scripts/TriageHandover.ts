/**
 * TriageHandover.ts - the handover question: "The ambulance crew is here. How many need to go first (Red)?" with five
 * big buttons 0 1 2 3 4. A plain class (not a component): TriageDebrief creates it and drives it.
 * Owns: the question panel (same style as the Scene clear question, low in front of the viewer, placed once when it
 * appears) and the answer. It never shows or hints at the right number, and tests nothing about it: the debrief owns
 * the Red count and the result line (TriageHandoverText).
 * Public API (for tests): isOpen(), getQuestionObject(), getQuestionTexts(), getButtonNames(), answer(n), getSize().
 *   The buttons are named HandoverButton_0 .. HandoverButton_4 (pinchable by name).
 * Must not: score, tag, own the clock, or build the debrief.
 */
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { PAD, GAP, addPressPop, hidePanel, hidePanelNow, showPanel, sizesAt } from "./TriageUi"
import { HANDOVER_CHOICES, HANDOVER_LINE_1, HANDOVER_LINE_2 } from "./TriageHandoverText"

const DISTANCE_CM = 60
/** centre of the panel this far below the middle of the view (cm): the same place as the Scene clear question */
const DROP_CM = 1.5
const BTN_W = 4.4
const BTN_H = 6.5
const LINE_H = 2.6
const Z = 0.6
const LABEL_Z = 0.08
const WHITE = new vec4(1, 1, 1, 1)

export interface HandoverDeps {
  parent: SceneObject
  cameraObject: SceneObject
  /** called with the chosen number, once */
  onAnswer: (n: number) => void
}

export class TriageHandover {
  private d: HandoverDeps
  private question: SceneObject | null = null
  private on = false
  private viewerOverride: vec3 | null = null
  private lookOverride: vec3 | null = null
  private w = HANDOVER_CHOICES.length * BTN_W + (HANDOVER_CHOICES.length - 1) * GAP + 2 * PAD
  private h = 2 * PAD + 2 * LINE_H + GAP * 2 + BTN_H

  constructor(deps: HandoverDeps) {
    this.d = deps
    this.build()
  }

  setViewerOverride(p: vec3 | null, look?: vec3 | null): void {
    this.viewerOverride = p
    this.lookOverride = p && look ? look.normalize() : null
  }
  isOpen(): boolean {
    return this.on
  }
  getQuestionObject(): SceneObject | null {
    return this.question && !isNull(this.question) ? this.question : null
  }
  getSize(): { w: number; h: number } {
    return { w: this.w, h: this.h }
  }
  getButtonNames(): string[] {
    return HANDOVER_CHOICES.map((n) => "HandoverButton_" + n)
  }
  /** Every text on the panel: the two lines, then the five button labels. */
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

  /** Put the question in front of the viewer (where they are looking now) and show it. */
  show(): void {
    if (!this.question || this.on) return
    const eye = this.viewerOverride ? this.viewerOverride : this.d.cameraObject.getTransform().getWorldPosition()
    const look = this.lookOverride
      ? this.lookOverride
      : this.d.cameraObject.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1)).normalize()
    let right = look.cross(new vec3(0, 1, 0))
    right = right.length < 0.001 ? new vec3(1, 0, 0) : right.normalize()
    const up = right.cross(look).normalize()
    this.question.getTransform().setWorldPosition(eye.add(look.uniformScale(DISTANCE_CM)).sub(up.uniformScale(DROP_CM)))
    // parallel to the view plane, upright (no roll), as the other panels are
    const yawQ = quat.fromEulerVec(new vec3(0, Math.atan2(-look.x, -look.z), 0))
    const pitchQ = quat.angleAxis(Math.asin(Math.max(-1, Math.min(1, look.y))), new vec3(1, 0, 0))
    this.question.getTransform().setWorldRotation(yawQ.multiply(pitchQ))
    this.on = true
    showPanel(this.question)
    print("TRIAGE_HANDOVER_ASKED")
  }

  /** Same code path as pinching a number. False if the question is not on show. */
  answer(n: number): boolean {
    if (!this.on) return false
    this.on = false
    if (this.question) hidePanel(this.question)
    print("TRIAGE_HANDOVER_ANSWERED " + n)
    this.d.onAnswer(n)
    return true
  }

  /** Close without an answer (a new run was laid out). */
  reset(): void {
    this.on = false
    if (this.question && !isNull(this.question)) hidePanelNow(this.question)
  }

  // ------------------------------------------------------------------ build

  private build(): void {
    const sz = sizesAt(DISTANCE_CM)
    const root = global.scene.createSceneObject("HandoverQuestion")
    root.setParent(this.d.parent)
    root.createComponent("Component.Canvas")
    const back = root.createComponent(BackPlate.getTypeName()) as BackPlate
    back.size = new vec2(this.w, this.h)
    const content = global.scene.createSceneObject("Content")
    content.setParent(root)
    content.getTransform().setLocalPosition(new vec3(0, 0, Z))
    root.enabled = false
    this.question = root

    const top = this.h / 2
    const y1 = top - PAD - LINE_H / 2
    this.addText(content, "HandoverLine1", HANDOVER_LINE_1, sz.body, 0, y1)
    this.addText(content, "HandoverLine2", HANDOVER_LINE_2, sz.body, 0, y1 - LINE_H)
    const by = y1 - LINE_H - LINE_H / 2 - GAP * 2 - BTN_H / 2
    const step = BTN_W + GAP
    HANDOVER_CHOICES.forEach((n, i) => {
      const x = (i - (HANDOVER_CHOICES.length - 1) / 2) * step
      const so = global.scene.createSceneObject("HandoverButton_" + n)
      so.setParent(content)
      so.getTransform().setLocalPosition(new vec3(x, by, 0))
      const btn = so.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(BTN_W, BTN_H, 1)
      const lab = global.scene.createSceneObject("ButtonLabel")
      lab.setParent(so)
      lab.getTransform().setLocalPosition(new vec3(0, 0, LABEL_Z))
      this.addText(lab, "Text", String(n), sz.title, 0, 0)
      btn.onTriggerUp.add(() => this.answer(n))
      addPressPop(btn, so)
    })
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
