/**
 * Scenario 2 - exactly one casualty starts behind the start position, and it is a breathing non-walker A-E.
 * Covers done criterion 1: "one of them is behind my starting view" (the placement part; groan/arrow = step 3).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, startFixedRun, casualtyObjects, resetToFreshStart} from "./TriageLeafHelpers"

@component
export class TriageBehindScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const state = startFixedRun(tm, 42, "auto")
    await sleep(300)

    // The Lens faces -Z from the start position, so "behind" means larger z than the room root.
    const startZ = tm.sceneObject.getTransform().getWorldPosition().z
    const objs = casualtyObjects(tm)
    expect(objs.length).toBe(4)

    const behindObjs = objs.filter((o) => o.getTransform().getWorldPosition().z > startZ + 50)
    expect(behindObjs.length).toBe(1)

    const behind = state.casualties.filter((c) => c.behind)
    expect(behind.length).toBe(1)
    expect(behind[0].sceneObjectName).toBe(behindObjs[0].name)
    expect(behind[0].id).toBe(state.behindId)
    expect(behind[0].walks).toBe(false)
    expect(["A", "B", "C", "D", "E"].indexOf(behind[0].id)).toBeGreaterThan(-1)

    // The other three are all in front of the start position.
    const front = objs.filter((o) => o.name !== behindObjs[0].name)
    for (const o of front) {
      expect(o.getTransform().getWorldPosition().z < startZ).toBe(true)
    }

    resetToFreshStart(tm)
  }
}
