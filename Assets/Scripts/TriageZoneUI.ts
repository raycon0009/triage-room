/**
 * TriageZoneUI.ts - passive view: the "MINOR" word lying flat on the green zone's floor disc.
 * The authored object carrying this script is rotated -90 deg about X so the text lies on the floor
 * and reads correctly from the start position. Public API: getLabel().
 */
@component
export class TriageZoneUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageZoneUI - MINOR floor label</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Word shown on the green zone")
  label: string = "MINOR"

  @input
  @widget(new SliderWidget(100, 900, 10))
  @hint("Text size (em-square cm = size / 43.9)")
  textSize: number = 380

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Label colour (white reads on the green disc; never black)")
  textColor: vec4
  @ui.group_end

  private text!: Text

  onAwake() {
    this.text = this.sceneObject.createComponent("Component.Text") as Text
    this.text.text = this.label
    this.text.depthTest = true
    this.text.size = this.textSize
    this.text.textFill.color = this.textColor
    this.text.horizontalAlignment = HorizontalAlignment.Center
    this.text.verticalAlignment = VerticalAlignment.Center
    this.text.horizontalOverflow = HorizontalOverflow.Overflow
    this.text.verticalOverflow = VerticalOverflow.Overflow
    this.text.layoutRect = Rect.create(-45, 45, -20, 20)
  }

  getLabel(): string {
    return this.label
  }
}
