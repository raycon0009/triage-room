/**
 * Scenario 26 - "Run comparison": after a Restart the debrief compares this run with the one just before.
 *  Run 1 (Drill, a fixed seed): one casualty tagged correctly, nobody brought into view, then Scene clear with three untagged.
 *   - the debrief has NO comparison lines (first run of the session).
 *  Restart, switch to Learn: everyone tagged correctly (the walker by call-out), everyone brought into view, the first
 *  tag made before the last person was in view (so the panel carries 2 "in view" lines + 2 comparison lines = 4 notes).
 *   - the two lines read "Last run (Drill): 1 of 4 · 4 never in view" / "This run (Learn): 4 of 4 · all in view m:ss",
 *     with the time the first-seen tracker recorded, rounded the same way;
 *   - the panel stays fully inside the view limits with the text not below the minimum, every line inside the panel;
 *   - the lines are part of the TRIAGE_DEBRIEF print and have no "better / worse / looked at" wording.
 * The viewer's position and look direction are test stand-ins (setViewerOverride).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  getTriageMain,
  getCards,
  getClock,
  getCallOut,
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
import {MAX_COMPARE_CHARS} from "../Scripts/TriageRunCompare"

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
export class TriageRunCompareScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const cue = getCue()
    const clock = getClock()
    const callOut = getCallOut()
    const debrief = getDebrief()
    const S = debrief.getSceneClear()!
    const up = new vec3(0, 1, 0) // looking at the ceiling: nobody is in view
    const lookAt = (id: string): vec3 => casualtyWorldPos(tm, id).sub(FAR_VIEWER)
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.timesUpSeconds = 1
    debrief.endGraceSeconds = 0.3
    S.setViewerOverride(FAR_VIEWER, up)
    cue.setViewerOverride(FAR_VIEWER, up)

    // ================= Run 1: Drill, one tagged, nobody in view, Scene clear =================
    const seed = findSeedWith("A", "off")
    const state1 = await startRunFar(tm, cards, seed, "off")
    expect(tm.getMode()).toBe("drill")
    const nonWalkers1 = state1.casualties.map((c) => c.id).filter((id) => id !== state1.walkerId)
    expect(await tagWithChecks(cards, nonWalkers1[0], CASUALTY_TABLE[nonWalkers1[0]].correctTag as "Red")).toBe(true)
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(clock.getEndReason()).toBe("scene-clear")
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    expect(debrief.getCompareLines().length).toBe(0) // the first run of the session: nothing to compare with
    expect(debrief.getSummary()!.correct).toBe(1)
    expect(debrief.getViewLines()[0]).toBe("4 people never came into view") // the view lines are unchanged
    assertPanelReadableAndInView(debrief, tm, true)

    // ================= Restart, switch to Learn =================
    debrief.pressRestart()
    expect(await waitFor(() => clock.isRunning(), 4000)).toBe(true)
    await sleep(700)
    tm.setMode("learn")
    expect(tm.getMode()).toBe("learn")
    cards.setViewerOverride(FAR_VIEWER)
    cards.closeCard()
    cue.setViewerOverride(FAR_VIEWER, up)
    S.setViewerOverride(FAR_VIEWER, up)
    const state2 = tm.getRunState()
    expect(state2.casualties.length).toBe(4)
    const walker2 = state2.walkerId
    const non2 = state2.casualties.map((c) => c.id).filter((id) => id !== walker2)
    const tracker = tm.getFirstSeen()
    expect(tracker.neverSeenCount()).toBe(4)

    // ---- the first tag comes before everyone has been in view; then everyone is brought into view
    cue.setViewerOverride(FAR_VIEWER, lookAt(non2[0]))
    await sleep(500)
    expect(await tagWithChecks(cards, non2[0], CASUALTY_TABLE[non2[0]].correctTag as "Red")).toBe(true)
    for (const id of [non2[1], non2[2], walker2]) {
      cue.setViewerOverride(FAR_VIEWER, lookAt(id))
      await sleep(450)
    }
    cue.setViewerOverride(FAR_VIEWER, lookAt(state2.behindId))
    await sleep(450)
    cue.setViewerOverride(FAR_VIEWER, up)
    expect(tracker.neverSeenCount()).toBe(0)
    const seenAt = tracker.allSeenAt() as number
    expect(seenAt === null).toBe(false)
    expect(await tagWithChecks(cards, non2[1], CASUALTY_TABLE[non2[1]].correctTag as "Red")).toBe(true)
    expect(await tagWithChecks(cards, non2[2], CASUALTY_TABLE[non2[2]].correctTag as "Red")).toBe(true)
    expect(callOut.pressCallOut()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 20000)).toBe(true)
    expect(clock.getEndReason()).toBe("all-tagged")
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)

    // ---- the comparison
    expect(debrief.getSummary()!.correct).toBe(4)
    const lines = debrief.getCompareLines()
    expect(lines.length).toBe(2)
    expect(lines[0]).toBe("Last run (Drill): 1 of 4 · 4 never in view")
    expect(lines[1]).toBe("This run (Learn): 4 of 4 · all in view " + clockText(seenAt))
    for (const l of lines) {
      expect(l.length <= MAX_COMPARE_CHARS).toBe(true)
      expect(/better|worse|star|score|looked at/i.test(l)).toBe(false)
    }
    expect(debrief.getViewLines().length).toBe(2) // "Everyone in view by ..." and "You started before seeing everyone"
    expect(debrief.getViewLines()[0]).toBe("Everyone in view by " + clockText(seenAt))
    expect(debrief.getSummaryLines().length).toBe(2) // the summary itself is unchanged
    assertPanelReadableAndInView(debrief, tm, false) // 4 notes: inside the view limits, text not below the minimum, every line in the panel

    cue.setViewerOverride(FAR_VIEWER, up)
    S.setViewerOverride(null)
    cleanup3(tm, cards)
  }
}
