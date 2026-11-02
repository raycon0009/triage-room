/**
 * TriageBehindCue.ts - build step 3: the groan and the arrow that point to the casualty behind the start position.
 * Owns:
 *  - the groan: a soft spatial sound whose source (an AudioComponent) sits on the casualty behind. It repeats every
 *    few seconds while that casualty is out of view and untagged, and stops when they come into view or are tagged;
 *  - the arrow: a small arrow at the edge of the view (head-locked) pointing the way to turn, shown only while that
 *    casualty is out of view and untagged. It disappears once they are in view.
 * "In view" = the head or torso centre of the casualty falls inside the camera's field of view.
 * Public API (for tests): getGroanSource(), getGroanPlayCount(), isArrowVisible(), getArrowSide(), isBehindInView(),
 *   getBehindId(), setViewerOverride(position, look).
 * Must not: tag anyone, own the timer, or open cards.
 */
import { TriageMain } from "./TriageMain"
import { TriageCheckCards } from "./TriageCheckCards"
import { TriageRunClock } from "./TriageRunClock"
import { TriageFigureBuilder } from "./TriageFigureBuilder"

@component
export class TriageBehindCue extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageBehindCue - groan and arrow (step 3)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Run orchestrator (casualty objects, Start / new run events)")
  main!: TriageMain
  @input
  @hint("Check cards (is the casualty behind tagged yet?)")
  cards!: TriageCheckCards
  @input
  @hint("Run clock (the cue is off before Start and after the run has ended)")
  clock!: TriageRunClock
  @input
  @hint("The camera object (viewer eye position / look direction / field of view)")
  cameraObject!: SceneObject
  @input
  @hint("The groan sound (generated with build-sfx, Assets/GeneratedSFX/triage_groan.wav)")
  groanTrack!: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(2, 12, 0.5))
  @hint("Seconds between groans while the casualty is out of view")
  groanIntervalSeconds: number = 5

  @input
  @widget(new SliderWidget(0, 5, 0.1))
  @hint("Seconds after Start before the first groan")
  firstGroanDelaySeconds: number = 1.5

  @input
  @widget(new SliderWidget(0.1, 1, 0.05))
  @hint("Groan volume (kept soft)")
  groanVolume: number = 0.5

  @input
  @widget(new SliderWidget(50, 400, 10))
  @hint("The groan is at full volume within this distance (cm)")
  groanMinDistanceCm: number = 120

  @input
  @widget(new SliderWidget(300, 2000, 50))
  @hint("The groan fades to nothing at this distance (cm)")
  groanMaxDistanceCm: number = 1200

  @input
  @widget(new SliderWidget(30, 100, 1))
  @hint("Distance of the arrow from the eyes (cm)")
  arrowDistanceCm: number = 55

  @input
  @widget(new SliderWidget(0.5, 0.95, 0.01))
  @hint("How close to the edge of the view the arrow sits (fraction of the half-width)")
  arrowEdgeFraction: number = 0.8

  @input
  @widget(new SliderWidget(0.5, 2, 0.1))
  @hint("Arrow size multiplier (the arrow is about 5 cm long at 1)")
  arrowScale: number = 0.7

  @input('vec4', '{1,0.85,0.4,1}')
  @widget(new ColorWidget())
  @hint("Arrow colour (keep it light and bright; black is invisible on additive displays)")
  arrowColor: vec4
  @ui.group_end

  private builder: TriageFigureBuilder | null = null
  private arrow: SceneObject | null = null
  private arrowSide = 1
  private groanSource: SceneObject | null = null
  private groanAudio: AudioComponent | null = null
  private groanPlays = 0
  private untilNext = 0
  private behindId: string | null = null
  private inView = false
  private viewerOverride: vec3 | null = null
  private lookOverride: vec3 | null = null
  private pulse = 0

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private onStart(): void {
    if (!this.main || !this.cards || !this.clock || !this.cameraObject || !this.groanTrack) {
      print("TriageBehindCue: required @input not wired - check the scene bootstrap")
      return
    }
    this.builder = new TriageFigureBuilder({
      box: this.main.boxMesh,
      sphere: this.main.sphereMesh,
      material: this.main.figureMaterial,
      boxUnitCm: this.main.boxUnitCm,
      sphereUnitCm: this.main.sphereUnitCm,
    })
    this.buildArrow()
    this.main.onRegenerated.add(() => this.setupRun())
    this.main.onRunStarted.add(() => {
      this.untilNext = this.firstGroanDelaySeconds
    })
    if (this.main.isReady()) this.setupRun()
  }

  // ------------------------------------------------------------------ public API

  /** Test hook: pretend the viewer stands here looking this way. null = use the camera. */
  setViewerOverride(p: vec3 | null, look?: vec3 | null): void {
    this.viewerOverride = p
    this.lookOverride = p && look ? look.normalize() : null
  }

  getBehindId(): string | null {
    return this.behindId
  }
  getGroanSource(): SceneObject | null {
    return this.groanSource && !isNull(this.groanSource) ? this.groanSource : null
  }
  getGroanPlayCount(): number {
    return this.groanPlays
  }
  isGroanPlaying(): boolean {
    return !!this.groanAudio && !isNull(this.groanAudio) && this.groanAudio.isPlaying()
  }
  isArrowVisible(): boolean {
    return !!this.arrow && this.arrow.enabled
  }
  /** +1 = at the right edge (turn right), -1 = at the left edge (turn left). */
  getArrowSide(): number {
    return this.arrowSide
  }
  isBehindInView(): boolean {
    return this.inView
  }

  // ------------------------------------------------------------------ run setup

  private setupRun(): void {
    // the previous run's casualty objects (and the groan source on one of them) have just been destroyed
    this.groanSource = null
    this.groanAudio = null
    this.groanPlays = 0
    this.inView = false
    this.untilNext = this.firstGroanDelaySeconds
    if (this.arrow) this.arrow.enabled = false
    const state = this.main.getRunState()
    this.behindId = state.behindId
    const cas = this.main.getCasualtyObject(state.behindId)
    if (!cas) return
    const so = global.scene.createSceneObject("GroanSource")
    so.setParent(cas)
    so.getTransform().setLocalPosition(new vec3(0, 15, 0))
    const a = so.createComponent("Component.AudioComponent") as AudioComponent
    a.audioTrack = this.groanTrack
    a.volume = this.groanVolume
    a.playbackMode = Audio.PlaybackMode.LowPower // ambient cue, not tied to a button press
    a.spatialAudio.enabled = true
    a.spatialAudio.positionEffect.enabled = true
    a.spatialAudio.distanceEffect.enabled = true
    a.spatialAudio.distanceEffect.type = Audio.DistanceCurveType.Linear
    a.spatialAudio.distanceEffect.minDistance = this.groanMinDistanceCm
    a.spatialAudio.distanceEffect.maxDistance = this.groanMaxDistanceCm
    this.groanSource = so
    this.groanAudio = a
  }

  // ------------------------------------------------------------------ view maths

  private eye(): vec3 {
    return this.viewerOverride ? this.viewerOverride : this.cameraObject.getTransform().getWorldPosition()
  }

  private look(): vec3 {
    if (this.lookOverride) return this.lookOverride
    return this.cameraObject.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1)).normalize()
  }

  /** tan of the half field of view (horizontal, vertical) from the camera. */
  private halfTans(): { h: number; v: number } {
    const cam = this.cameraObject.getComponent("Component.Camera") as Camera
    let fov = cam ? cam.fov : 0.9
    if (!(fov > 0.05 && fov < 3)) fov = 0.9
    let aspect = cam ? cam.aspect : 1
    if (!(aspect > 0.2 && aspect < 5)) aspect = 1
    const v = Math.tan(fov / 2)
    return { h: v * aspect, v: v }
  }

  private axes(look: vec3): { right: vec3; up: vec3 } {
    let right = look.cross(new vec3(0, 1, 0))
    right = right.length < 0.001 ? new vec3(1, 0, 0) : right.normalize()
    return { right: right, up: right.cross(look).normalize() }
  }

  /** Where the casualty is (world): head and torso centres. */
  private bodyPoints(id: string): vec3[] {
    const cas = this.main.getCasualtyObject(id)
    if (!cas) return []
    const pts: vec3[] = []
    const visit = (so: SceneObject): void => {
      if (so.name === "Head" || so.name === "Torso") pts.push(so.getTransform().getWorldPosition())
      for (let i = 0; i < so.getChildrenCount(); i++) visit(so.getChild(i))
    }
    visit(cas)
    if (pts.length === 0) pts.push(cas.getTransform().getWorldPosition())
    return pts
  }

  private computeInView(eye: vec3, look: vec3, id: string): boolean {
    const ax = this.axes(look)
    const t = this.halfTans()
    for (const q of this.bodyPoints(id)) {
      const v = q.sub(eye)
      const z = v.dot(look)
      if (z < 1) continue
      if (Math.abs(v.dot(ax.right) / z) < t.h && Math.abs(v.dot(ax.up) / z) < t.v) return true
    }
    return false
  }

  // ------------------------------------------------------------------ per frame

  private tick(): void {
    if (!this.main || !this.clock || !this.behindId || !this.arrow) return
    const active = this.main.isStarted() && this.clock.isRunning() && !this.clock.isEnded() && !!this.groanAudio
    const id = this.behindId
    const tagged = active && this.cards.getRecord(id).tag !== null
    if (!active || tagged) {
      this.arrow.enabled = false
      this.inView = false
      this.stopGroan()
      return
    }
    const dt = getDeltaTime()
    const eye = this.eye()
    const look = this.look()
    this.inView = this.computeInView(eye, look, id)

    if (this.inView) {
      this.arrow.enabled = false
      this.stopGroan()
    } else {
      this.updateArrow(eye, look, id, dt)
      this.untilNext -= dt
      if (this.untilNext <= 0) {
        this.untilNext = this.groanIntervalSeconds
        this.playGroan()
      }
    }
  }

  private playGroan(): void {
    if (!this.groanAudio || isNull(this.groanAudio)) return
    this.groanAudio.play(1)
    this.groanPlays++
    print("TRIAGE_GROAN " + this.behindId)
  }

  private stopGroan(): void {
    if (this.groanAudio && !isNull(this.groanAudio) && this.groanAudio.isPlaying()) this.groanAudio.stop(true)
  }

  private updateArrow(eye: vec3, look: vec3, id: string, dt: number): void {
    const arrow = this.arrow!
    const ax = this.axes(look)
    const pts = this.bodyPoints(id)
    const target = pts.length ? pts[0] : eye
    const dir = target.sub(eye)
    const sideDot = dir.dot(ax.right)
    // which way is the shorter turn? (keep the previous side when the casualty is almost exactly behind)
    if (Math.abs(sideDot) > 0.05 * (dir.length || 1)) this.arrowSide = sideDot >= 0 ? 1 : -1
    const t = this.halfTans()
    const D = this.arrowDistanceCm
    const edgeX = D * t.h * this.arrowEdgeFraction
    const dropY = D * t.v * 0.12
    const pos = eye.add(look.uniformScale(D)).add(ax.right.uniformScale(this.arrowSide * edgeX)).sub(ax.up.uniformScale(dropY))
    const tr = arrow.getTransform()
    tr.setWorldPosition(pos)
    // face the eye, upright; local +X points to the edge (flip for the left edge)
    const yawQ = quat.fromEulerVec(new vec3(0, Math.atan2(-look.x, -look.z), 0))
    const pitchQ = quat.angleAxis(Math.asin(Math.max(-1, Math.min(1, look.y))), new vec3(1, 0, 0))
    let q = yawQ.multiply(pitchQ)
    if (this.arrowSide < 0) q = q.multiply(quat.angleAxis(Math.PI, new vec3(0, 0, 1)))
    tr.setWorldRotation(q)
    // a gentle pulse so it is noticed without being jarring
    this.pulse += dt * 3
    const s = this.arrowScale * (1 + 0.12 * Math.sin(this.pulse))
    tr.setWorldScale(new vec3(s, s, s))
    arrow.enabled = true
  }

  /** A small chevron arrow (about 5 cm long) built from three bars, pointing along local +X. */
  private buildArrow(): void {
    const root = global.scene.createSceneObject("BehindArrow")
    root.setParent(this.sceneObject)
    const b = this.builder!
    const col = [this.arrowColor.r, this.arrowColor.g, this.arrowColor.b]
    b.createPart(root, "Shaft", "box", [0, 0, 0], [4.2, 0.9, 0.3], col)
    b.createPart(root, "HeadUp", "box", [1.45, 0.95, 0], [2.4, 0.9, 0.3], col, [0, 0, -40])
    b.createPart(root, "HeadDown", "box", [1.45, -0.95, 0], [2.4, 0.9, 0.3], col, [0, 0, 40])
    root.enabled = false
    this.arrow = root
  }
}
