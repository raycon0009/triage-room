/**
 * Scenario 23 - the debrief measures when everyone came into view (real-miss change 3).
 *  A. Scripted run: three casualties are brought into view one after another, the first one is tagged, the one behind is
 *     never in view. The debrief says "1 person never came into view" and "You started before seeing everyone", the panel
 *     (3 missed, two extra lines) is inside the view limits, and nothing is recorded after the run has ended.
 *  B. Everyone brought into view, then a tag: "Everyone in view by m:ss" with the time the last one came into view, and
 *     no "started before" line.
 *  C. Nobody reached and nobody in view: "4 people never came into view", and the panel still fits.
 *  Restart resets the record.
 * "In view" is head direction (the camera's field of view), set here with the cue's viewer stand-in.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  getTriageMain,
  getCards,
  getClock,
  getCue,
  getDebrief,
  startRunFar,
  tagWithChecks,
  cleanup3,
  findSeedWith,
  casualtyWorldPos,
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {assertPanelReadableAndInView} from "./TriageLeafDebriefChecks"
import {CASUALTY_TABLE} from "../Scripts/TriageData"
import {clock as clockText} from "../Scripts/TriageFirstSeen"

async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  for (let t = 0; t < ms; t += 50) {
    if (cond()) {
      return true
    }
    await sleep(50)
  }
  return cond()
}

@component
export class TriageFirstSeenScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const cue = getCue()
    const clock = getClock()
    const debrief = getDebrief()
    const S = debrief.getSceneClear()!
    const up = new vec3(0, 1, 0) // looking at the ceiling: nobody is in view
    const lookAt = (id: string): vec3 => casualtyWorldPos(tm, id).sub(FAR_VIEWER)
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.timesUpSeconds = 1
    S.setViewerOverride(FAR_VIEWER, up)
    const seed = findSeedWith("A", "off")

    // ================= A. one tagged early, the one behind never in view =================
    cue.setViewerOverride(FAR_VIEWER, up)
    const state = await startRunFar(tm, cards, seed, "off")
    const tracker = tm.getFirstSeen()
    const front = state.casualties.filter((c) => !c.behind && c.id !== state.walkerId).map((c) => c.id)
    expect(front.length).toBe(2)
    const walkerId = state.walkerId
    expect(tracker.neverSeenCount()).toBe(4) // looking up: nobody yet
    cue.setViewerOverride(FAR_VIEWER, lookAt(front[0]))
    await sleep(500)
    expect(tracker.firstSeenAt(front[0]) === null).toBe(false)
    expect(tracker.firstSeenAt(front[1]) === null).toBe(true)
    expect(await tagWithChecks(cards, front[0], CASUALTY_TABLE[front[0]].correctTag as "Red")).toBe(true)
    expect(tracker.firstActionAt() === null).toBe(false)
    cue.setViewerOverride(FAR_VIEWER, lookAt(front[1]))
    await sleep(400)
    cue.setViewerOverride(FAR_VIEWER, lookAt(walkerId))
    await sleep(400)
    cue.setViewerOverride(FAR_VIEWER, up)
    expect(tracker.neverSeenCount()).toBe(1)
    expect(tracker.firstSeenAt(state.behindId)).toBe(null)
    const t1 = tracker.firstSeenAt(front[0]) as number
    const t2 = tracker.firstSeenAt(front[1]) as number
    expect(t1).toBeLessThan(tracker.firstActionAt() as number + 0.05)
    expect(t2).toBeGreaterThan(tracker.firstActionAt() as number) // the second was seen after the tag
    // end it with Scene clear (the real buttons' code paths)
    S.setViewerOverride(FAR_VIEWER, new vec3(0, 0, -1))
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(clock.getEndReason()).toBe("scene-clear")
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    const linesA = debrief.getViewLines()
    expect(linesA.length).toBe(2)
    expect(linesA[0]).toBe("1 person never came into view")
    expect(linesA[1]).toBe("You started before seeing everyone")
    expect(debrief.getSummaryLines().length).toBe(2) // the summary itself is unchanged
    expect(debrief.getEntries().filter((e) => e.status === "missed").length).toBe(3)
    assertPanelReadableAndInView(debrief, tm, true) // 3 missed + both lines: inside the view limits, text not below the minimum
    // sampling stops when the run ends: looking at the one behind now records nothing
    cue.setViewerOverride(FAR_VIEWER, lookAt(state.behindId))
    await sleep(600)
    expect(tracker.firstSeenAt(state.behindId)).toBe(null)
    expect(tracker.isStopped()).toBe(true)
    expect(debrief.getViewLines()[0]).toBe("1 person never came into view")

    // ---- Restart clears the record
    cue.setViewerOverride(FAR_VIEWER, up)
    debrief.pressRestart()
    expect(await waitFor(() => clock.isRunning(), 4000)).toBe(true)
    await sleep(400)
    expect(tracker.isStopped()).toBe(false)
    expect(tracker.neverSeenCount()).toBe(4)
    expect(tracker.firstActionAt()).toBe(null)

    // ================= B. everyone brought into view, tagged afterwards =================
    cards.setViewerOverride(FAR_VIEWER)
    cards.closeCard()
    const stateB = await startRunFar(tm, cards, seed, "off")
    cue.setViewerOverride(FAR_VIEWER, up)
    await sleep(300)
    let lastBefore = 0
    let lastAfter = 0
    const order = stateB.casualties.map((c) => c.id)
    for (let i = 0; i < order.length; i++) {
      if (i === order.length - 1) {
        lastBefore = clock.getElapsed()
      }
      cue.setViewerOverride(FAR_VIEWER, lookAt(order[i]))
      await sleep(350)
      if (i === order.length - 1) {
        lastAfter = clock.getElapsed()
      }
    }
    cue.setViewerOverride(FAR_VIEWER, up)
    expect(tracker.neverSeenCount()).toBe(0)
    const allAt = tracker.allSeenAt() as number
    expect(allAt).toBeGreaterThan(lastBefore - 0.05)
    expect(allAt).toBeLessThan(lastAfter + 0.05)
    const nonWalker = stateB.casualties.filter((c) => c.id !== stateB.walkerId)[0].id
    expect(await tagWithChecks(cards, nonWalker, CASUALTY_TABLE[nonWalker].correctTag as "Red")).toBe(true)
    expect(tracker.startedBeforeEveryone()).toBe(false)
    S.setViewerOverride(FAR_VIEWER, new vec3(0, 0, -1))
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    const linesB = debrief.getViewLines()
    expect(linesB.length).toBe(1)
    expect(linesB[0]).toBe("Everyone in view by " + clockText(allAt))
    expect(linesB[0].indexOf("Everyone in view by 0:") === 0).toBe(true)
    assertPanelReadableAndInView(debrief, tm, true)

    // ================= C. nobody reached, nobody in view: the panel still fits =================
    debrief.pressRestart()
    expect(await waitFor(() => clock.isRunning(), 4000)).toBe(true)
    cards.setViewerOverride(FAR_VIEWER)
    cards.closeCard()
    cue.setViewerOverride(FAR_VIEWER, up)
    await sleep(600)
    clock.configure(3, 1)
    expect(await waitFor(() => debrief.isOpen(), 8000)).toBe(true)
    expect(debrief.getReason()).toBe("time")
    expect(await waitFor(() => debrief.isRevealDone(), 10000)).toBe(true)
    expect(debrief.getEntries().every((e) => e.status === "missed")).toBe(true)
    expect(debrief.getViewLines().length).toBe(1)
    expect(debrief.getViewLines()[0]).toBe("4 people never came into view")
    assertPanelReadableAndInView(debrief, tm, true)

    S.setViewerOverride(null)
    cleanup3(tm, cards)
  }
}
