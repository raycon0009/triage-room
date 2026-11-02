/**
 * TriageScenarioUI.ts - passive view: the scenario line shown after Start, which then fades.
 * Public API: showScenario(text, holdSeconds, fadeSeconds), hideNow(), isVisible(), getText().
 * Must not: decide when to show - TriageMain calls showScenario.
 */
const FADE_TEXT_SIZE_SCALE = 1.0

@component
export class TriageScenarioUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageScenarioUI - scenario line (passive view)</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(20, 70, 1))
  @hint("Width of the text block (cm); the line wraps inside it")
  widthCm: number = 46

  @input
  @widget(new SliderWidget(6, 30, 1))
  @hint("Height of the text block (cm)")
  heightCm: number = 14

  @input
  @widget(new SliderWidget(30, 90, 1))
  @hint("Text size (Specs type scale: 39 = body at 110 cm)")
  textSize: number = 58

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Text colour (keep it light; black is invisible on additive displays)")
  textColor: vec4
  @ui.group_end

  private text!: Text
  private currentText = ""
  private visible = false
  private elapsed = 0
  private hold = 0
  private fade = 1
  private updater: UpdateEvent | null = null

  onAwake() {
    this.text = this.sceneObject.createComponent("Component.Text") as Text
    this.text.depthTest = true
    this.text.size = this.textSize * FADE_TEXT_SIZE_SCALE
    this.text.horizontalAlignment = HorizontalAlignment.Center
    this.text.verticalAlignment = VerticalAlignment.Center
    this.text.horizontalOverflow = HorizontalOverflow.Wrap
    this.text.verticalOverflow = VerticalOverflow.Overflow
    this.text.layoutRect = Rect.create(-this.widthCm / 2, this.widthCm / 2, -this.heightCm / 2, this.heightCm / 2)
    this.text.text = ""
    this.setAlpha(0)
    this.sceneObject.enabled = true
    this.updater = this.createEvent("UpdateEvent")
    this.updater.bind(() => this.tick())
  }

  showScenario(text: string, holdSeconds: number, fadeSeconds: number): void {
    this.currentText = text
    this.text.text = text
    this.visible = true
    this.elapsed = 0
    this.hold = Math.max(0, holdSeconds)
    this.fade = Math.max(0.01, fadeSeconds)
    this.setAlpha(1)
  }

  hideNow(): void {
    this.visible = false
    this.setAlpha(0)
    this.text.text = ""
  }

  isVisible(): boolean {
    return this.visible
  }

  getText(): string {
    return this.currentText
  }

  private setAlpha(a: number): void {
    const c = this.textColor
    this.text.textFill.color = new vec4(c.r, c.g, c.b, a)
  }

  private tick(): void {
    if (!this.visible) return
    this.elapsed += getDeltaTime()
    if (this.elapsed <= this.hold) return
    const k = (this.elapsed - this.hold) / this.fade
    if (k >= 1) {
      this.hideNow()
    } else {
      this.setAlpha(1 - k)
    }
  }
}
