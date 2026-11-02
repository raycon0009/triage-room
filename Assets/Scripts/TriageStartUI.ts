/**
 * TriageStartUI.ts - passive view: the Start panel (title, pinchable Start button, drill footnote).
 * Owns: UIKit composition of the panel (BackPlate + FlexLayout + Button). Holds no run state.
 * Public API: onStart (Event<mode>, fires once per press: "learn" or "drill"), hide(), show(), pressStart(mode) (programmatic
 * press for tests). Two buttons: "Learn" (START guide on the check card) and "Drill" (as before). Both start the same timed run.
 * Inspector: labels, button size. The buttons are named "LearnButton" and "StartButton" (the Drill button).
 * Must not: start the run itself - TriageMain subscribes to onStart.
 */
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"

const FONT_SIZE_SCALE = 1.0
type TextRole = "Title2" | "Headline2" | "Button" | "Caption"
const TYPE_SCALE: Record<TextRole, { size: number; weight: number }> = {
  Title2: { size: 93, weight: 700 },
  Headline2: { size: 48, weight: 700 },
  Button: { size: 52, weight: 500 },
  Caption: { size: 52, weight: 500 },
}
function applyTextRole(t: Text, role: TextRole): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE
  ;(t as Text & { weight?: number }).weight = TYPE_SCALE[role].weight
}

const BUTTON_LABEL_Z = 0.08
const CONTENT_Z = 0.6

@component
export class TriageStartUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageStartUI - Start panel (passive view)</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Panel title")
  titleText: string = "Triage Room"

  @input
  @hint("Label on the Drill button (the plain drill, as before)")
  drillLabel: string = "Drill"

  @input
  @hint("Label on the Learn button (the same drill with the START guide on the card)")
  learnLabel: string = "Learn"

  @input
  @hint("Small line under the button")
  footnoteText: string = "Training drill, not certification"

  @input
  @widget(new SliderWidget(8, 24, 0.5))
  @hint("Start button width (cm)")
  buttonWidthCm: number = 14

  @input
  @widget(new SliderWidget(3, 10, 0.5))
  @hint("Start button height (cm)")
  buttonHeightCm: number = 5.5

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Colour of the title and footnote text")
  textColor: vec4
  @ui.group_end

  private _onStart = new Event<string>()
  get onStart(): PublicApi<string> {
    return this._onStart.publicApi()
  }

  private startButton: Button | null = null
  private pressed = false

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")
    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 1.0
    flex.paddingTop = 1.6
    flex.paddingBottom = 1.6
    flex.paddingLeft = 2.0
    flex.paddingRight = 2.0
    flex.width = -1
    flex.height = -1

    const wText = Math.max(this.buttonWidthCm + 6, 22)
    this.addText(content, flex, "Title", this.titleText, "Headline2", wText, 3.2)

    this.addModeButton(content, "LearnButton", this.learnLabel, "learn")
    this.startButton = this.addModeButton(content, "StartButton", this.drillLabel, "drill")

    this.addText(content, flex, "Footnote", this.footnoteText, "Caption", wText, 2.0)
  }

  private addModeButton(content: SceneObject, name: string, label: string, mode: string): Button {
    const btnSO = global.scene.createSceneObject(name)
    btnSO.setParent(content)
    const btn = btnSO.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(this.buttonWidthCm, this.buttonHeightCm, 1)
    this.addButtonLabel(btnSO, label, this.buttonWidthCm - 0.5)
    const btnItem = btnSO.createComponent(FlexItem.getTypeName()) as FlexItem
    btnItem.overrideWidth = this.buttonWidthCm
    btnItem.overrideHeight = this.buttonHeightCm
    btn.onTriggerUp.add(() => this.pressStart(mode))
    return btn
  }

  /** Called by the Learn / Drill buttons; tests may also call it directly. Fires onStart once with the mode. */
  pressStart(mode: string = "drill"): void {
    if (this.pressed) return
    this.pressed = true
    this._onStart.invoke(mode)
  }

  hide(): void {
    this.sceneObject.enabled = false
  }

  show(): void {
    this.pressed = false
    this.sceneObject.enabled = true
  }

  private addText(parent: SceneObject, flex: FlexLayout, name: string, text: string, role: TextRole, widthCm: number, heightCm: number): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.textFill.color = this.textColor
    applyTextRole(t, role)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCm
    item.overrideHeight = heightCm
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCm: number): void {
    const so = global.scene.createSceneObject("ButtonLabel")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, "Button")
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -1.2, 1.2)
  }
}
