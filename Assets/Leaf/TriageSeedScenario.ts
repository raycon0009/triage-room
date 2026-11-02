/**
 * Scenario 4 - a fixed seed gives the same layout every time; different seeds give different layouts;
 * with a fixed seed the Black case can be forced on or off.
 * Covers the build step 1 "seedable shuffle" requirement.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, startFixedRun, layoutKey, resetToFreshStart} from "./TriageLeafHelpers"

@component
export class TriageSeedScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()

    // Same seed, same layout (compare world positions of the built objects, not just the data).
    const first = startFixedRun(tm, 42, "auto")
    const second = startFixedRun(tm, 42, "auto")
    expect(first.seedFixed).toBe(true)
    expect(first.seed).toBe(42)
    expect(layoutKey(second)).toBe(layoutKey(first))

    // Different seeds, different layouts.
    const other = startFixedRun(tm, 43, "auto")
    expect(layoutKey(other)).not.toBe(layoutKey(first))

    // With a fixed seed, Black can be forced on or off, and the layout is still repeatable.
    const on1 = startFixedRun(tm, 42, "on")
    const on2 = startFixedRun(tm, 42, "on")
    const off1 = startFixedRun(tm, 42, "off")
    const off2 = startFixedRun(tm, 42, "off")
    expect(on1.blackIncluded).toBe(true)
    expect(on1.casualties.filter((c) => c.id === "X").length).toBe(1)
    expect(layoutKey(on2)).toBe(layoutKey(on1))
    expect(off1.blackIncluded).toBe(false)
    expect(off1.casualties.filter((c) => c.id === "X").length).toBe(0)
    expect(layoutKey(off2)).toBe(layoutKey(off1))

    // Random runs (seed 0) report that the seed is not fixed.
    const random = tm.regenerate(0, "on")
    expect(random.seedFixed).toBe(false)

    resetToFreshStart(tm)
  }
}
