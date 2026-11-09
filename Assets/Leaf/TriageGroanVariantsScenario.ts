/**
 * Scenario - groan variants: three calm groans, chosen by the run's seed.
 *  - Learn: over 4 groans no two in a row are the same and at least 2 different groans play;
 *  - Drill: exactly 1 groan, and it is the one the seed asks for;
 *  - the same seed twice gives the same groan order (and it matches the pure pick rule).
 * Timings are shortened for the test only.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, getCue, startRunFar, cleanup3, FAR_VIEWER} from "./TriageLeafHelpers"
import {groanSequence, pickGroan} from "../Scripts/TriageGroanPick"
import {TriageBehindCue} from "../Scripts/TriageBehindCue"

/** Poll the cue until `want` groans have played; returns the index of each one, in order. */
async function collect(cue: TriageBehindCue, want: number): Promise<number[]> {
  const seq: number[] = []
  let seen = 0
  for (let i = 0; i < 400 && seq.length < want; i++) {
    const n = cue.getGroanPlayCount()
    if (n > seen) {
      // a poll is much shorter than the gap between groans, so n is seen[+1] at most
      seen = n
      seq.push(cue.getLastGroanIndex())
    }
    await sleep(40)
  }
  return seq
}

@component
export class TriageGroanVariantsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const cue = getCue()

    cue.groanIntervalSeconds = 0.5
    cue.firstGroanDelaySeconds = 2.5
    cue.setViewerOverride(FAR_VIEWER, new vec3(0, 0, -1)) // looking ahead: the casualty behind stays out of view

    // ---- Learn: 4 groans, never the same twice in a row, at least 2 different ones
    let state = await startRunFar(tm, cards, 11, "off", "learn")
    expect(cue.getLastGroanIndex()).toBe(-1) // nothing played yet in this run
    const first = await collect(cue, 4)
    expect(first.length).toBe(4)
    for (let i = 0; i < first.length; i++) {
      expect(first[i] >= 0 && first[i] <= 2).toBe(true)
      if (i > 0) expect(first[i] === first[i - 1]).toBe(false)
    }
    expect(new Set(first).size).toBeGreaterThan(1)
    expect(cue.getLastGroanIndex()).toBe(first[first.length - 1])
    // it is the seed's order
    const expected = groanSequence(state.seed, 4)
    for (let i = 0; i < 4; i++) expect(first[i]).toBe(expected[i])

    // ---- the same seed again gives the same order
    state = await startRunFar(tm, cards, 11, "off", "learn")
    expect(cue.getLastGroanIndex()).toBe(-1)
    const second = await collect(cue, 4)
    expect(second.length).toBe(4)
    for (let i = 0; i < 4; i++) expect(second[i]).toBe(first[i])

    // ---- Drill: exactly one groan, the one the seed asks for
    cue.firstGroanDelaySeconds = 0.5
    state = await startRunFar(tm, cards, 11, "off", "drill")
    await sleep(2500)
    expect(cue.getGroanPlayCount()).toBe(1)
    expect(cue.getLastGroanIndex()).toBe(pickGroan(state.seed, 0, -1))
    await sleep(2000)
    expect(cue.getGroanPlayCount()).toBe(1)

    cue.groanIntervalSeconds = 5
    cue.firstGroanDelaySeconds = 1.5
    cleanup3(tm, cards)
  }
}
