/**
 * Scenario 17 - build step 5 polish: the start screen. Before Start the panel shows the title "Triage Room", the
 * Start button and the small line "Training drill, not certification" (all light, none of it tiny); after Start the
 * panel is gone and the one-line scenario shows.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep, findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, resetToFreshStart, pressButton} from "./TriageLeafHelpers"

function collectTexts(so: SceneObject, out: Text[]): void {
  const t = so.getComponent("Component.Text") as Text
  if (t) {
    out.push(t)
  }
  for (let i = 0; i < so.getChildrenCount(); i++) {
    collectTexts(so.getChild(i), out)
  }
}

@component
export class TriageStartScreenScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    resetToFreshStart(tm)
    await sleep(500)

    const panel = findSceneObjectByName("StartPanel") as SceneObject
    expect(panel.enabled).toBe(true)
    const texts: Text[] = []
    collectTexts(panel, texts)
    const byText: {[s: string]: Text} = {}
    for (const t of texts) {
      byText[t.text] = t
    }
    expect(byText["Triage Room"] === undefined).toBe(false)
    expect(byText["Drill"] === undefined).toBe(false)
    expect(byText["Learn"] === undefined).toBe(false)
    expect(byText["Training drill, not certification"] === undefined).toBe(false)
    // light text, and the small line is not tiny (it was size 38)
    for (const s of ["Triage Room", "Learn", "Drill", "Training drill, not certification"]) {
      const c = byText[s].textFill.color
      expect(c.r > 0.9 && c.g > 0.9 && c.b > 0.9).toBe(true)
      expect(byText[s].size).toBeGreaterThan(45)
    }
    expect(tm.scenarioUI.isVisible()).toBe(false) // the scenario line comes after Start

    await pressButton("StartButton")
    await sleep(300)
    expect(tm.isStarted()).toBe(true)
    expect(panel.enabled).toBe(false)
    expect(tm.scenarioUI.isVisible()).toBe(true)
    expect(tm.scenarioUI.getText()).toBe(tm.scenarioText)

    resetToFreshStart(tm)
  }
}
