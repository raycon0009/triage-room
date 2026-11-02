/**
 * TriageCallOut.ts - build step 3: the "Call out: walk to me" button and the walker's response.
 * Owns: the big pinchable button near the start view (appears on Start), and the walker's animation: stands up,
 *       walks to the green MINOR circle, stands there and gets a green band with the word GREEN.
 *       Nobody else moves. Pressing it counts as tagging the walker Green at the deciding step (0 extra checks),
 *       with the run time recorded (TriageCheckCards.markCalledOut).
 * Public API (for tests): pressCallOut(), isUsed(), getPhase(), getWalkerId(), getArrivalDistanceCm().
 * Stand-in: voice is not used in this build; "walk to me" is a button (design brief).
 * Must not: own the timer or the end state (TriageRunClock), or tag anyone but the walker.
 */
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { TriageMain } from "./TriageMain"
import { TriageCheckCards } from "./TriageCheckCards"
import { TriageRunClock } from "./TriageRunClock"
import { CasualtyId } from "./TriageData"
import { Part, STANDING_HIP_Y, STANDING_SHOULDER_Y, standingParts, startingParts } from "./TriageFigureBuilder"

export type WalkPhase = "idle" | "standing" | "walking" | "arrived"

const BUTTON_LABEL_Z = 0.08
const CONTENT_Z = 0.6

@component
export class TriageCallOut extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageCallOut - call-out button and walker (step 3)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Run orchestrator (Start event, casualty objects, green zone position)")
  main!: TriageMain
  @input
  @hint("Check cards (records the walker's Green tag)")
  cards!: TriageCheckCards
  @input
  @hint("Run clock (time of the call-out; the button is off once the run has ended)")
  clock!: TriageRunClock
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Text on the button")
  buttonLabel: string = "Call out: walk to me"

  @input
  @widget(new SliderWidget(14, 40, 1))
  @hint("Button width (cm)")
  buttonWidthCm: number = 30

  @input
  @widget(new SliderWidget(5, 16, 0.5))
  @hint("Button height (cm)")
  buttonHeightCm: number = 9

  @input
  @widget(new SliderWidget(40, 200, 5))
  @hint("Walking speed (cm per second)")
  walkSpeedCmPerSec: number = 110

  @input
  @widget(new SliderWidget(0.3, 3, 0.1))
  @hint("Seconds the walker takes to stand up")
  standSeconds: number = 1.2

  @input
  @widget(new SliderWidget(10, 45, 1))
  @hint("The walker stops this far inside the edge of the green circle (cm)")
  insideEdgeCm: number = 20

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Colour of the button text (keep it light; black is invisible on additive displays)")
  textColor: vec4
  @ui.group_end

  private panel: SceneObject | null = null
  private used = false
  private phase: WalkPhase = "idle"
  private phaseTime = 0
  private walkerId: CasualtyId | null = null
  private walker: SceneObject | null = null
  private body: SceneObject | null = null
  private start: Part[] = []
  private target: Part[] = []
  private partObjs: { [name: string]: SceneObject } = {}
  private dest = new vec3(0, 0, 0)
  private gait = 0
  private baseY = 0

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private onStart(): void {
    if (!this.main || !this.cards || !this.clock) {
      print("TriageCallOut: required @input not wired - check the scene bootstrap")
      return
    }
    this.buildPanel()
    this.main.onRunStarted.add(() => this.onRunStarted())
    this.main.onRegenerated.add(() => this.reset())
    this.clock.onRunEnded.add(() => this.hidePanel())
  }

  // ------------------------------------------------------------------ public API

  isUsed(): boolean {
    return this.used
  }
  getPhase(): WalkPhase {
    return this.phase
  }
  getWalkerId(): string | null {
    return this.walkerId
  }
  isButtonVisible(): boolean {
    return !!this.panel && this.panel.enabled
  }

  /** Horizontal distance (cm) from the walker to the centre of the green circle; -1 if there is no walker yet. */
  getArrivalDistanceCm(): number {
    if (!this.walker || isNull(this.walker)) return -1
    const z = this.zoneCentre()
    const p = this.walker.getTransform().getWorldPosition()
    return Math.sqrt((p.x - z.x) * (p.x - z.x) + (p.z - z.z) * (p.z - z.z))
  }

  /** Same code path as pinching the button. Returns false if it does nothing (not started, ended, already used). */
  pressCallOut(): boolean {
    if (this.used || !this.main.isStarted() || this.clock.isEnded()) return false
    const state = this.main.getRunState()
    const id = state.walkerId as CasualtyId
    const obj = this.main.getCasualtyObject(id)
    if (!obj) return false
    this.used = true
    this.hidePanel()
    this.walkerId = id
    this.walker = obj
    this.cards.markCalledOut(id, this.clock.getElapsed())

    this.body = obj.getChild(0)
    this.start = startingParts(id)
    this.target = standingParts(id)
    this.partObjs = {}
    for (let i = 0; i < this.body.getChildrenCount(); i++) {
      const c = this.body.getChild(i)
      this.partObjs[c.name] = c
    }
    // where to stop: inside the circle, on the side the walker comes from, so the MINOR word stays readable
    const z = this.zoneCentre()
    const p = obj.getTransform().getWorldPosition()
    let dx = p.x - z.x
    let dz = p.z - z.z
    const len = Math.sqrt(dx * dx + dz * dz) || 1
    dx /= len
    dz /= len
    const r = state.minorZone.diameterCm / 2 - this.insideEdgeCm
    this.dest = new vec3(z.x + dx * r, p.y, z.z + dz * r)
    this.baseY = p.y
    this.setPhase("standing")
    print("TRIAGE_CALL_OUT walker=" + id)
    return true
  }

  // ------------------------------------------------------------------ internals

  private reset(): void {
    this.used = false
    this.phase = "idle"
    this.walker = null
    this.walkerId = null
    this.body = null
    this.partObjs = {}
    if (this.panel) this.panel.enabled = false
  }

  private onRunStarted(): void {
    this.used = false
    this.phase = "idle"
    if (this.panel) this.panel.enabled = true
  }

  private hidePanel(): void {
    if (this.panel) this.panel.enabled = false
  }

  private zoneCentre(): vec3 {
    const root = this.main.sceneObject.getTransform().getWorldPosition()
    const z = this.main.getRunState().minorZone
    return new vec3(root.x + z.x, root.y, root.z + z.z)
  }

  private setPhase(p: WalkPhase): void {
    this.phase = p
    this.phaseTime = 0
  }

  private tick(): void {
    if (this.phase === "idle" || this.phase === "arrived") return
    if (!this.walker || isNull(this.walker) || !this.body || isNull(this.body)) {
      this.phase = "idle"
      return
    }
    const dt = getDeltaTime()
    this.phaseTime += dt
    if (this.phase === "standing") {
      const k = Math.min(1, this.phaseTime / this.standSeconds)
      this.blendToStanding(k * k * (3 - 2 * k))
      this.faceTowards(this.dest, dt, 6)
      if (k >= 1) {
        this.finishStanding()
        this.setPhase("walking")
      }
    } else if (this.phase === "walking") {
      const t = this.walker.getTransform()
      const p = t.getWorldPosition()
      const dx = this.dest.x - p.x
      const dz = this.dest.z - p.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      const step = this.walkSpeedCmPerSec * dt
      this.faceTowards(this.dest, dt, 8)
      if (dist <= step) {
        t.setWorldPosition(new vec3(this.dest.x, this.baseY, this.dest.z))
        this.swing(0, 0)
        this.arrive()
        return
      }
      this.gait += dt * 7
      t.setWorldPosition(new vec3(p.x + (dx / dist) * step, this.baseY + Math.abs(Math.sin(this.gait)) * 1.2, p.z + (dz / dist) * step))
      this.swing(Math.sin(this.gait) * 24, Math.sin(this.gait) * 16)
    }
  }

  private arrive(): void {
    // turn to face the user's start position, then show the band and the word
    const root = this.main.sceneObject.getTransform().getWorldPosition()
    const t = this.walker!.getTransform()
    const p = t.getWorldPosition()
    t.setWorldRotation(quat.fromEulerVec(new vec3(0, Math.atan2(root.x - p.x, root.z - p.z), 0)))
    this.setPhase("arrived")
    if (this.walkerId) this.cards.showCalledOutTag(this.walkerId)
    print("TRIAGE_WALKER_ARRIVED " + this.walkerId + " distToZoneCentre=" + Math.round(this.getArrivalDistanceCm()))
  }

  private faceTowards(to: vec3, dt: number, rate: number): void {
    const t = this.walker!.getTransform()
    const p = t.getWorldPosition()
    const dx = to.x - p.x
    const dz = to.z - p.z
    if (dx * dx + dz * dz < 1) return
    const goal = quat.fromEulerVec(new vec3(0, Math.atan2(dx, dz), 0))
    t.setWorldRotation(quat.slerp(t.getWorldRotation(), goal, Math.min(1, dt * rate)))
  }

  /** Blend every part from its sitting pose to its standing pose (k from 0 to 1). */
  private blendToStanding(k: number): void {
    const d = Math.PI / 180
    for (const s of this.start) {
      const o = this.partObjs[s.name]
      if (!o || isNull(o)) continue
      const g = this.target.filter((p) => p.name === s.name)[0]
      const unit = s.kind === "box" ? this.main.boxUnitCm : this.main.sphereUnitCm
      const t = o.getTransform()
      if (!g) {
        // parts the standing figure does not have shrink away
        const sc = 1 - k
        t.setLocalScale(new vec3((s.size[0] / unit) * sc, (s.size[1] / unit) * sc, (s.size[2] / unit) * sc))
        continue
      }
      const pos = [0, 1, 2].map((i) => s.pos[i] + (g.pos[i] - s.pos[i]) * k)
      const size = [0, 1, 2].map((i) => s.size[i] + (g.size[i] - s.size[i]) * k)
      const r0 = s.rot || [0, 0, 0]
      const r1 = g.rot || [0, 0, 0]
      const rot = [0, 1, 2].map((i) => r0[i] + (r1[i] - r0[i]) * k)
      t.setLocalPosition(new vec3(pos[0], pos[1], pos[2]))
      t.setLocalScale(new vec3(size[0] / unit, size[1] / unit, size[2] / unit))
      t.setLocalRotation(quat.fromEulerVec(new vec3(rot[0] * d, rot[1] * d, rot[2] * d)))
    }
  }

  private finishStanding(): void {
    this.blendToStanding(1)
    // parts that have no standing counterpart are gone
    for (const s of this.start) {
      if (this.target.filter((p) => p.name === s.name).length === 0) {
        const o = this.partObjs[s.name]
        if (o && !isNull(o)) o.enabled = false
      }
    }
  }

  /** Swing the legs and arms about the hip / shoulder (degrees). */
  private swing(legDeg: number, armDeg: number): void {
    const d = Math.PI / 180
    const limbs: { name: string; pivotY: number; half: number; sign: number; deg: number }[] = [
      { name: "LegL", pivotY: STANDING_HIP_Y, half: 40, sign: 1, deg: legDeg },
      { name: "LegR", pivotY: STANDING_HIP_Y, half: 40, sign: -1, deg: legDeg },
      { name: "ArmL", pivotY: STANDING_SHOULDER_Y, half: 22, sign: -1, deg: armDeg },
      { name: "ArmR", pivotY: STANDING_SHOULDER_Y, half: 22, sign: 1, deg: armDeg },
    ]
    for (const l of limbs) {
      const o = this.partObjs[l.name]
      const g = this.target.filter((p) => p.name === l.name)[0]
      if (!o || isNull(o) || !g) continue
      const a = l.sign * l.deg * d
      o.getTransform().setLocalPosition(new vec3(g.pos[0], l.pivotY - l.half * Math.cos(a), -l.half * Math.sin(a)))
      o.getTransform().setLocalRotation(quat.angleAxis(a, new vec3(1, 0, 0)))
    }
  }

  // ------------------------------------------------------------------ button

  private buildPanel(): void {
    const root = this.sceneObject
    this.panel = global.scene.createSceneObject("CallOutPanel")
    this.panel.setParent(root)
    this.panel.createComponent("Component.Canvas")
    const back = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate
    const content = global.scene.createSceneObject("Content")
    content.setParent(this.panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.onLayoutComplete.add((r) => {
      back.size = new vec2(r.containerWidth, r.containerHeight)
    })
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.paddingTop = 1.2
    flex.paddingBottom = 1.2
    flex.paddingLeft = 1.4
    flex.paddingRight = 1.4
    flex.width = -1
    flex.height = -1

    const so = global.scene.createSceneObject("CallOutButton")
    so.setParent(content)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(this.buttonWidthCm, this.buttonHeightCm, 1)
    const lab = global.scene.createSceneObject("ButtonLabel")
    lab.setParent(so)
    lab.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = lab.createComponent("Component.Text") as Text
    t.text = this.buttonLabel
    t.depthTest = true
    t.size = 62
    t.textFill.color = this.textColor
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-this.buttonWidthCm / 2, this.buttonWidthCm / 2, -2, 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = this.buttonWidthCm
    item.overrideHeight = this.buttonHeightCm
    btn.onTriggerUp.add(() => this.pressCallOut())
    this.panel.enabled = false
  }
}
