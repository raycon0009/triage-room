/**
 * Scenario 20 - debrief reveal order, and the "nobody reached" fit (polish).
 *  - Nobody tagged, time runs out: Time's up shows first, the panel waits for a short pause, then appears.
 *  - Reveal order: the panel first, then every NOT REACHED row (with the marker over the real person) together, then
 *    the other rows one by one. With nobody reached all four missed rows come in together.
 *  - Once fully in, the 4-missed panel is inside the view limits (it used to be 0.15 degrees too tall) and readable.
 *  - A mixed run (one tagged, the rest missed): the missed rows come in before the tagged one.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, getClock, getDebrief, startRunFar, tagWithChecks, FAR_VIEWER} from "./TriageLeafHelpers"
import {assertPanelReadableAndInView} from "./TriageLeafDebriefChecks"
import {DEMO_SEED} from "../Scripts/TriageLayout"

async function waitOpen(debrief: ReturnType<typeof getDebrief>): Promise<void> {
  for (let i = 0; i < 100 && !debrief.isOpen(); i++) {
    await sleep(100)
  }
  expect(debrief.isOpen()).toBe(true)
}

@component
export class TriageDebriefRevealScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const clock = getClock()
    const debrief = getDebrief()
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.timesUpSeconds = 1.5

    // ---- nobody reached
    await startRunFar(tm, cards, DEMO_SEED, "on")
    clock.configure(3, 1)
    await waitOpen(debrief)
    expect(clock.isTimesUpVisible()).toBe(true)
    expect((debrief.getPanelObject() as SceneObject).enabled).toBe(false) // pause: the panel waits for Time's up
    // watch the order of appearance as it happens
    for (let i = 0; i < 60 && !debrief.isRevealDone(); i++) {
      await sleep(100)
    }
    expect(debrief.isRevealDone()).toBe(true)
    expect(clock.isTimesUpVisible()).toBe(false)
    const log = debrief.getRevealLog()
    expect(log.length).toBe(5) // panel + four NOT REACHED rows
    expect(log[0].kind).toBe("panel")
    for (let i = 1; i < 5; i++) {
      expect(log[i].kind).toBe("missed")
      expect(log[i].t >= log[0].t).toBe(true)
    }
    expect(debrief.getEntries().filter((e) => e.status === "missed").length).toBe(4)
    // the missed rows come in together (same planned time), after the panel
    const plan = debrief.getRevealPlan()
    expect(plan[1].at > plan[0].at).toBe(true)
    expect(plan[1].at).toBe(plan[4].at)
    // every NOT REACHED row and its marker over the real person is showing
    for (const e of debrief.getEntries()) {
      expect(debrief.isNotReachedFlashing(e.id)).toBe(true)
    }
    // fully in: inside the view limits from the start position (was 0.15 degrees too tall), readable, in the table
    assertPanelReadableAndInView(debrief, tm, true)

    // ---- mixed run: X tagged, three missed. Missed rows first, then the tagged row.
    await startRunFar(tm, cards, DEMO_SEED, "on")
    expect(await tagWithChecks(cards, "X", "Black")).toBe(true)
    clock.configure(3, 1)
    await waitOpen(debrief)
    for (let i = 0; i < 60 && !debrief.isRevealDone(); i++) {
      await sleep(100)
    }
    expect(debrief.isRevealDone()).toBe(true)
    const log2 = debrief.getRevealLog()
    expect(log2.map((l) => l.kind).join(",")).toBe("panel,missed,missed,missed,row")
    expect(log2[4].id).toBe("X")
    expect(log2[4].t > log2[3].t).toBe(true)
    assertPanelReadableAndInView(debrief, tm, true)

    debrief.setViewerOverride(null)
    cards.setViewerOverride(null)
  }
}
