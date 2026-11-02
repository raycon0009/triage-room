/**
 * Scenario 3 - after Start the scenario line is shown, and it is the brief's text.
 * Covers the build step 1 "scenario line" item (not part of done criterion 1's wording, but part of step 1).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, startFixedRun, resetToFreshStart} from "./TriageLeafHelpers"

@component
export class TriageScenarioLineScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    resetToFreshStart(tm)
    expect(tm.scenarioUI.isVisible()).toBe(false)

    startFixedRun(tm, 42, "auto")
    await sleep(300)

    expect(tm.scenarioUI.isVisible()).toBe(true)
    const text = tm.scenarioUI.getText()
    expect(text.includes("A gas cylinder burst in the college canteen.")).toBe(true)
    expect(text.includes("The fire is out.")).toBe(true)
    expect(text.includes("four people need you.")).toBe(true)

    resetToFreshStart(tm)
  }
}
