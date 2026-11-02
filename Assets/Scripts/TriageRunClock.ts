/**
 * TriageRunClock.ts - build step 3: the 3:00 timer, the 0:30 chime and the run's end state.
 * Owns: the countdown (starts on Start), pushing the remaining time to the check card (shown on an open card only,
 *       nowhere else in the view), the chime at 0:30 left, and the end state: endRun(reason) closes any open card,
 *       locks the cards and stops everything; for "time" it shows a clear "Time's up" panel.
 * Hooks for later steps: onRunEnded (reason "time" | "all-tagged"), isEnded(), getEndReason(), endRun(reason).
 *   Step 4 (debrief map) subscribes to onRunEnded and calls endRun("all-tagged") when everyone is tagged.
 * Test hooks: configure(durationSeconds, chimeAtSeconds), debugAdvance(seconds), getChimeCount().
 * Must not: build the debrief map, or implement check/START logic.
 */
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { TriageMain } from "./TriageMain"
import { TriageCheckCards } from "./TriageCheckCards"

export type EndReason = "time" | "all-tagged"

@component
export class TriageRunClock extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageRunClock - timer, chime, end state (step 3)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Run orchestrator (Start / new run events)")
  main!: TriageMain
  @input
  @hint("Check cards (timer text, lock at the end)")
  cards!: TriageCheckCards
  @input
  @hint("Plays the chime at 0:30 left (a normal, non-spatial AudioComponent)")
  chimeAudio!: AudioComponent
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(30, 600, 5))
  @hint("Length of a run in seconds (3:00 = 180)")
  durationSeconds: number = 180

  @input
  @widget(new SliderWidget(5, 120, 1))
  @hint("The chime plays when this many seconds are left (0:30 = 30)")
  chimeAtSeconds: number = 30

  @input
  @widget(new SliderWidget(0.1, 1, 0.05))
  @hint("Chime volume")
  chimeVolume: number = 0.7

  @input
  @hint("Big line shown when time runs out")
  timesUpText: string = "Time's up"

  @input
  @hint("Small line under it")
  timesUpSubText: string = "The drill has ended"

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Colour of the Time's up text (keep it light; black is invisible on additive displays)")
  textColor: vec4
  @ui.group_end

  private _onRunEnded = new Event<EndReason>()
  get onRunEnded(): PublicApi<EndReason> {
    return this._onRunEnded.publicApi()
  }
  private _onChime = new Event<void>()
  get onChime(): PublicApi<void> {
    return this._onChime.publicApi()
  }

  private running = false
  private ended = false
  private endReason: EndReason | null = null
  private elapsed = 0
  private duration = 180
  private chimeAt = 30
  private chimed = false
  private chimeCount = 0
  private timesUp: SceneObject | null = null

  onAwake() {
    this.duration = this.durationSeconds
    this.chimeAt = this.chimeAtSeconds
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private onStart(): void {
    if (!this.main || !this.cards) {
      print("TriageRunClock: required @input not wired - check the scene bootstrap")
      return
    }
    this.buildTimesUp()
    if (this.chimeAudio) {
      this.chimeAudio.playbackMode = Audio.PlaybackMode.LowLatency
      this.chimeAudio.volume = this.chimeVolume
    }
    this.main.onRunStarted.add(() => this.begin())
    this.main.onRegenerated.add(() => this.reset())
  }

  // ------------------------------------------------------------------ public API

  isRunning(): boolean {
    return this.running
  }
  isEnded(): boolean {
    return this.ended
  }
  getEndReason(): EndReason | null {
    return this.endReason
  }
  getElapsed(): number {
    return this.elapsed
  }
  getRemaining(): number {
    return Math.max(0, this.duration - this.elapsed)
  }
  getChimeCount(): number {
    return this.chimeCount
  }
  getDuration(): number {
    return this.duration
  }
  isTimesUpVisible(): boolean {
    return !!this.timesUp && this.timesUp.enabled
  }

  /** The debrief hides the "Time's up" panel a few seconds after it opens (it is in the way of the map's labels). */
  hideTimesUp(): void {
    if (this.timesUp) this.timesUp.enabled = false
  }

  /** "m:ss", rounded up so the display reads 0:00 only at the very end. */
  formatRemaining(): string {
    const s = Math.ceil(this.getRemaining() - 1e-6)
    const m = Math.floor(s / 60)
    const r = s % 60
    return m + ":" + (r < 10 ? "0" : "") + r
  }

  /** Test hook: restart the countdown with a different length / chime point. */
  configure(durationSeconds: number, chimeAtSeconds: number): void {
    this.duration = durationSeconds
    this.chimeAt = chimeAtSeconds
    this.elapsed = 0
    this.chimed = false
    this.chimeCount = 0
  }

  /** Test hook: jump forward in the run's time. */
  debugAdvance(seconds: number): void {
    if (!this.running) return
    this.elapsed += seconds
    this.check()
  }

  /** Ends the run: closes any open card, locks the cards, stops the clock. Safe to call twice. */
  endRun(reason: EndReason): void {
    if (this.ended) return
    this.ended = true
    this.running = false
    this.endReason = reason
    this.cards.setLocked(true)
    this.cards.setTimerText("")
    if (reason === "time" && this.timesUp) this.timesUp.enabled = true
    print("TRIAGE_RUN_ENDED " + reason + " elapsed=" + Math.round(this.elapsed * 10) / 10)
    this._onRunEnded.invoke(reason)
  }

  // ------------------------------------------------------------------ internals

  private begin(): void {
    this.elapsed = 0
    this.chimed = false
    this.ended = false
    this.endReason = null
    this.running = true
    if (this.timesUp) this.timesUp.enabled = false
    this.cards.setLocked(false)
    this.cards.setTimerText(this.formatRemaining())
    print("TRIAGE_TIMER_STARTED " + this.duration)
  }

  private reset(): void {
    this.running = false
    this.ended = false
    this.endReason = null
    this.elapsed = 0
    this.chimed = false
    this.duration = this.durationSeconds
    this.chimeAt = this.chimeAtSeconds
    if (this.timesUp) this.timesUp.enabled = false
    this.cards.setLocked(false)
    this.cards.setTimerText("")
  }

  private tick(): void {
    if (!this.running) return
    this.elapsed += getDeltaTime()
    this.check()
  }

  private check(): void {
    if (!this.running) return
    const left = this.duration - this.elapsed
    if (!this.chimed && left <= this.chimeAt) {
      this.chimed = true
      this.chimeCount++
      if (this.chimeAudio) this.chimeAudio.play(1)
      print("TRIAGE_CHIME remaining=" + Math.round(left * 10) / 10)
      this._onChime.invoke()
    }
    if (left <= 0) {
      this.endRun("time")
      return
    }
    this.cards.setTimerText(this.formatRemaining())
  }

  /** "Time's up" panel: a large, light line in the start view. */
  private buildTimesUp(): void {
    const root = global.scene.createSceneObject("TimesUpPanel")
    root.setParent(this.sceneObject)
    root.getTransform().setLocalPosition(new vec3(0, -4, -85))
    root.createComponent("Component.Canvas")
    const back = root.createComponent(BackPlate.getTypeName()) as BackPlate
    const content = global.scene.createSceneObject("Content")
    content.setParent(root)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.onLayoutComplete.add((r) => {
      back.size = new vec2(r.containerWidth, r.containerHeight)
    })
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0.8
    flex.paddingTop = 2
    flex.paddingBottom = 2
    flex.paddingLeft = 3
    flex.paddingRight = 3
    flex.width = -1
    flex.height = -1
    this.addText(content, "TimesUpTitle", this.timesUpText, 130, 30, 6.4)
    this.addText(content, "TimesUpSub", this.timesUpSubText, 62, 30, 2.6)
    root.enabled = false
    this.timesUp = root
  }

  private addText(parent: SceneObject, name: string, text: string, size: number, widthCm: number, heightCm: number): void {
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
  }
}
