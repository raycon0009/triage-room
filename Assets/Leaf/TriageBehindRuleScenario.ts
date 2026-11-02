/**
 * Scenario 6 - over many seeds, the casualty behind the start position is never the walker, F or X.
 * Covers the casualty rules in the brief: the one behind is always a breathing non-walker (A-E).
 * Part 1 checks the pure layout logic over 300 seeds x 3 Black settings; part 2 checks the built scene objects
 * for a spread of seeds.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {generateRun, validateRun, ForceBlack} from "../Scripts/TriageLayout"
import {CASUALTY_TABLE} from "../Scripts/TriageData"
import {getTriageMain, startFixedRun, casualtyObjects, resetToFreshStart} from "./TriageLeafHelpers"

const BEHIND_ALLOWED = ["A", "B", "C", "D", "E"]

@component
export class TriageBehindRuleScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)

    // Part 1: the layout rules, many seeds.
    const settings: ForceBlack[] = ["auto", "on", "off"]
    let runs = 0
    let blackRuns = 0
    for (let seed = 1; seed <= 300; seed++) {
      for (const fb of settings) {
        const run = generateRun(seed, fb)
        runs++
        if (run.blackIncluded) {
          blackRuns++
        }
        const def = CASUALTY_TABLE[run.behindId]
        if (def.walks || run.behindId === "F" || run.behindId === "X" || BEHIND_ALLOWED.indexOf(run.behindId) < 0) {
          throw new Error("Seed " + seed + " (" + fb + "): behind is " + run.behindId)
        }
        const errs = validateRun(run)
        if (errs.length > 0) {
          throw new Error("Seed " + seed + " (" + fb + ") broke a rule: " + errs.join("; "))
        }
      }
    }
    expect(runs).toBe(900)
    // both Black and non-Black runs were exercised
    expect(blackRuns).toBeGreaterThan(0)
    expect(blackRuns).toBeLessThan(runs)

    // Part 2: the actual scene objects for a spread of seeds.
    const tm = getTriageMain()
    const startZ = tm.sceneObject.getTransform().getWorldPosition().z
    for (let seed = 1; seed <= 24; seed++) {
      const state = startFixedRun(tm, seed * 7, seed % 3 === 0 ? "on" : "auto")
      const behind = state.casualties.filter((c) => c.behind)
      expect(behind.length).toBe(1)
      expect(behind[0].walks).toBe(false)
      expect(BEHIND_ALLOWED.indexOf(behind[0].id)).toBeGreaterThan(-1)
      const obj = casualtyObjects(tm).find((o) => o.name === behind[0].sceneObjectName)
      if (!obj) {
        throw new Error("Seed " + seed * 7 + ": behind casualty object missing")
      }
      expect(obj.getTransform().getWorldPosition().z > startZ).toBe(true)
    }

    resetToFreshStart(tm)
  }
}
