/**
 * Scenario 1 - pinching the Start button starts the run and shows four casualties on the floor.
 * Covers done criterion 1 (first sentence): "four casualties appear" after Start.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {getTriageMain, resetToFreshStart, casualtyObjects} from "./TriageLeafHelpers"

@component
export class TriageStartScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    resetToFreshStart(tm)
    await sleep(300)

    // Before Start: nothing is started and the casualties are hidden.
    expect(tm.isStarted()).toBe(false)
    expect(tm.casualtiesRoot.enabled).toBe(false)

    const startButton = findInteractableByName("StartButton")
    if (!startButton) {
      throw new Error('Interactable "StartButton" not found')
    }
    const interactor = new DefaultLeafInteractor()
    await interactor.trigger(startButton)
    await sleep(500)

    // After the Start pinch.
    expect(tm.isStarted()).toBe(true)
    expect(tm.startUI.getSceneObject().enabled).toBe(false)
    expect(tm.casualtiesRoot.enabled).toBe(true)

    const objs = casualtyObjects(tm)
    expect(objs.length).toBe(4)
    const state = tm.getRunState()
    expect(state.casualties.length).toBe(4)
    for (const c of state.casualties) {
      const o = objs.find((x) => x.name === c.sceneObjectName)
      if (!o) {
        throw new Error("Missing scene object " + c.sceneObjectName)
      }
      expect(o.isEnabledInHierarchy).toBe(true)
    }
    // exactly one walker among the four
    expect(state.casualties.filter((c) => c.walks).length).toBe(1)

    resetToFreshStart(tm)
  }
}
