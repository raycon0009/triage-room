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
import { Pose, STANDING_POSE, lerpPose, walkPose } from "./TriageFigurePose"
import { TriageFigureBuilder } from "./TriageFigureBuilder"
import { GAP, PAD, addPressPop, easeInOutCubic, hidePanel, hidePanelNow, showPanel, sizesAt } from "./TriageUi"

export type WalkPhase = "idle" | "standing" | "walking" | "arrived"

const BUTTON_LABEL_Z = 0.08
const CONTENT_Z = 0.6
/** Seconds to get up to full walking speed, and the distance (cm) over which the walker slows down to stop at the circle. */
const WALK_RAMP_SECONDS = 0.7
const WALK_BRAKE_CM = 70
const MIN_SPEED_RATIO = 0.15

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
  /** The button is on (it fades out over a moment after it is pressed, so `panel.enabled` lags this). */
  private panelShown = false
  private used = false
  private phase: WalkPhase = "idle"
  private phaseTime = 0
  private walkerId: CasualtyId | null = null
  private walker: SceneObject | null = null
  private figure: TriageFigureBuilder | null = null
  private startPose: Pose = STANDING_POSE
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
    return !!this.panel && this.panelShown
  }

  /** The call-out button's board (world centre and size in cm) while it is on show, so other boards can keep clear of it. */
  getButtonRect(): { pos: vec3; w: number; h: number } | null {
    if (!this.panel || isNull(this.panel) || !this.panelShown) return null
    return { pos: this.panel.getTransform().getWorldPosition(), w: this.buttonWidthCm + 2 * PAD, h: this.buttonHeightCm + 2 * PAD }
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

    // split the resting figure into moving body parts (merged again on arrival)
    this.figure = this.main.getFigureBuilder()
    this.startPose = this.figure.getPose(id)
    this.figure.startRig(obj, id)
    // where to stop: inside the circle on the far side from the start position, because the zone label lies on the
    // near side (facing the player); the walker is sideways-offset towards the side they come from
    const z = this.zoneCentre()
    const p = obj.getTransform().getWorldPosition()
    const root = this.main.sceneObject.getTransform().getWorldPosition()
    let ux = root.x - z.x
    let uz = root.z - z.z
    const ulen = Math.sqrt(ux * ux + uz * uz) || 1
    ux /= ulen
    uz /= ulen
    const px = -uz
    const pz = ux
    const side = Math.max(-1, Math.min(1, ((p.x - z.x) * px + (p.z - z.z) * pz) / 100))
    const r = state.minorZone.diameterCm / 2 - this.insideEdgeCm
    const far = r * 0.85
    const sideCm = side * r * 0.4
    this.dest = new vec3(z.x - ux * far + px * sideCm, p.y, z.z - uz * far + pz * sideCm)
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
    this.figure = null
    if (this.panel) hidePanelNow(this.panel)
    this.panelShown = false
  }

  private onRunStarted(): void {
    this.used = false
    this.phase = "idle"
    if (this.panel) showPanel(this.panel)
    this.panelShown = true
  }

  private hidePanel(): void {
    if (this.panel && this.panelShown) hidePanel(this.panel)
    this.panelShown = false
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
    if (!this.walker || isNull(this.walker) || !this.figure) {
      this.phase = "idle"
      return
    }
    const dt = getDeltaTime()
    this.phaseTime += dt
    if (this.phase === "standing") {
      const k = Math.min(1, this.phaseTime / this.standSeconds)
      this.blendToStanding(easeInOutCubic(k))
      this.faceTowards(this.dest, dt, 6)
      if (k >= 1) {
        this.setPhase("walking")
      }
    } else if (this.phase === "walking") {
      const t = this.walker.getTransform()
      const p = t.getWorldPosition()
      const dx = this.dest.x - p.x
      const dz = this.dest.z - p.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      // ease in from standing still and ease out into the circle (never quite zero, so the walker always arrives)
      const ramp = easeInOutCubic(Math.min(1, this.phaseTime / WALK_RAMP_SECONDS))
      const brake = easeInOutCubic(Math.min(1, dist / WALK_BRAKE_CM))
      const ratio = Math.max(MIN_SPEED_RATIO, ramp * brake)
      const step = this.walkSpeedCmPerSec * ratio * dt
      this.faceTowards(this.dest, dt, 8)
      if (dist <= step) {
        t.setWorldPosition(new vec3(this.dest.x, this.baseY, this.dest.z))
        this.arrive()
        return
      }
      this.gait += dt * 7 * Math.max(0.35, ratio)
      t.setWorldPosition(new vec3(p.x + (dx / dist) * step, this.baseY + Math.abs(Math.sin(this.gait)) * 1.2 * ratio, p.z + (dz / dist) * step))
      this.figure.applyPose(this.walker, this.walkerId as string, walkPose(Math.sin(this.gait) * Math.max(0.3, ratio)))
    }
  }

  private arrive(): void {
    // turn to face the user's start position, then show the band and the word
    const root = this.main.sceneObject.getTransform().getWorldPosition()
    const t = this.walker!.getTransform()
    const p = t.getWorldPosition()
    t.setWorldRotation(quat.fromEulerVec(new vec3(0, Math.atan2(root.x - p.x, root.z - p.z), 0)))
    this.setPhase("arrived")
    // back to one merged mesh in a relaxed standing pose
    if (this.figure && this.walkerId) this.figure.finishRig(this.walker!, this.walkerId, STANDING_POSE)
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

  /** Blend the whole body from the sitting pose to the standing pose, joint by joint (k from 0 to 1). */
  private blendToStanding(k: number): void {
    if (!this.figure || !this.walker || !this.walkerId) return
    this.figure.applyPose(this.walker, this.walkerId, this.figure.groundedPose(this.walkerId, lerpPose(this.startPose, STANDING_POSE, k)))
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
    flex.rowGap = GAP
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
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
    t.size = sizesAt(80).body
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
    addPressPop(btn, so)
    this.panel.enabled = false
  }
}
