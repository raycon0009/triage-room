/**
 * Scenario 5 - every casualty pose sits on the floor at roughly human size (not tiny, not floating).
 * Covers done criterion 1: "casualties appear on the floor at real size".
 * Bounds are in centimetres. A person is about 150-200 cm long when lying and about 80-100 cm tall when
 * seated on the floor, so a body's largest extent must be 70-220 cm, its lowest point within a few cm of
 * the floor, and nothing may rise above 130 cm (nobody is standing in step 1's casualty poses).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, startFixedRun, casualtyObjects, measureFigure, resetToFreshStart} from "./TriageLeafHelpers"

@component
export class TriageSizeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const floorY = tm.sceneObject.getTransform().getWorldPosition().y

    const checked: {[id: string]: boolean} = {}
    for (let seed = 1; seed <= 60; seed++) {
      startFixedRun(tm, seed, seed % 2 === 1 ? "on" : "off")
      for (const o of casualtyObjects(tm)) {
        const id = o.name.substring("Casualty_".length)
        if (checked[id]) {
          continue
        }
        checked[id] = true
        const b = measureFigure(o)
        const sx = b.maxX - b.minX
        const sy = b.maxY - b.minY
        const sz = b.maxZ - b.minZ
        const largest = Math.max(sx, sy, sz)
        const label = id + " (largest " + Math.round(largest) + " cm, lowest " + Math.round(b.minY - floorY) + " cm above floor, top " + Math.round(b.maxY - floorY) + " cm)"
        if (!(largest >= 70 && largest <= 220)) {
          throw new Error("Casualty " + label + " is not human-sized (expected 70-220 cm)")
        }
        if (!(b.minY - floorY >= -3 && b.minY - floorY <= 8)) {
          throw new Error("Casualty " + label + " is not on the floor (expected lowest point -3..8 cm)")
        }
        if (!(b.maxY - floorY <= 130)) {
          throw new Error("Casualty " + label + " rises too high (expected top <= 130 cm)")
        }
      }
    }
    // every case in the pool was measured: W1, W2, W3, A, B, C, D, E, F, G, H, J, X
    expect(Object.keys(checked).length).toBe(13)

    resetToFreshStart(tm)
  }
}
