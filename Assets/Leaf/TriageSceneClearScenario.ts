/**
 * Scenario 21 - "Scene clear" (real-miss change 1): the player decides when they are finished.
 *  - no button before the first tag or call-out; it appears after the first tag; it hides while a card is open;
 *  - it sits below the middle of the view and never covers a casualty's head or torso (viewer looking straight at one);
 *  - pinching it asks "Have you found everyone?" with "Yes, scene clear" and "Keep looking" and nothing that gives the answer
 *    away (no numbers, no "remaining"); the clock keeps running while the question is open;
 *  - "Keep looking" closes the question and the SAME run goes on;
 *  - "Yes" ends the run with reason "scene-clear": no Time's up panel, the debrief opens after a short pause, anyone
 *    untagged is NOT REACHED and counts as missed (wrong);
 *  - with the walker still walking, the run only ends once they have arrived;
 *  - Restart clears all of it.
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
  pressButton,
  cleanup3,
  findSeedWith,
  casualtyWorldPos,
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {CASUALTY_TABLE} from "../Scripts/TriageData"
import {SCENE_CLEAR_KEEP, SCENE_CLEAR_LABEL, SCENE_CLEAR_QUESTION, SCENE_CLEAR_YES} from "../Scripts/TriageSceneClear"

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
export class TriageSceneClearScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const clock = getClock()
    const callOut = getCallOut()
    const debrief = getDebrief()
    const cue = getCue()
    const sc = debrief.getSceneClear()
    expect(sc === null).toBe(false)
    const S = sc!
    const ahead = new vec3(0, 0, -1)
    S.setViewerOverride(FAR_VIEWER, ahead)
    cue.setViewerOverride(FAR_VIEWER, ahead)
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.timesUpSeconds = 1.5

    const seed = findSeedWith("A", "off")
    const state = await startRunFar(tm, cards, seed, "off")
    const walkerId = state.walkerId
    const others = state.casualties.map((c) => c.id).filter((id) => id !== walkerId)
    expect(S.isButtonVisible()).toBe(false) // nothing tagged yet
    await sleep(600)
    expect(S.isButtonVisible()).toBe(false)

    // ---- the first tag brings the button; the button is below the middle of the view
    const first = others[0]
    expect(await tagWithChecks(cards, first, CASUALTY_TABLE[first].correctTag as "Red")).toBe(true)
    expect(await waitFor(() => S.isButtonVisible(), 1000)).toBe(true)
    await sleep(400)
    const btn = S.getButtonObject() as SceneObject
    const bp = btn.getTransform().getWorldPosition()
    expect(bp.y).toBeLessThan(-3) // below eye level
    expect(bp.z).toBeLessThan(-40) // in front
    expect(Math.atan2(Math.abs(bp.x), -bp.z) * 57.3).toBeLessThan(16) // inside the view

    // ---- a card hides it; closing the card brings it back
    cards.openCard(others[1], "button")
    await sleep(500)
    expect(S.isButtonVisible()).toBe(false)
    cards.closeCard()
    expect(await waitFor(() => S.isButtonVisible(), 1000)).toBe(true)

    // ---- never over a head or torso: look straight at a casualty and the button moves aside
    const target = others[1]
    const tp = casualtyWorldPos(tm, target)
    const look = tp.sub(FAR_VIEWER).normalize()
    S.setViewerOverride(FAR_VIEWER, look)
    await sleep(2000)
    expect(S.isButtonVisible()).toBe(true)
    const b2 = (S.getButtonObject() as SceneObject).getTransform().getWorldPosition()
    const sz = S.getSizes().button
    expect(S.covers(b2, FAR_VIEWER, look, sz.w, sz.h)).toBe(false)
    S.setViewerOverride(FAR_VIEWER, ahead)
    await sleep(2000)

    // ---- the question: shown by pinching the button, with two answers and no hint
    const elapsed0 = clock.getElapsed()
    await pressButton("SceneClearButton")
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.isButtonVisible()).toBe(false)
    const texts = S.getQuestionTexts()
    expect(texts.indexOf(SCENE_CLEAR_QUESTION) >= 0).toBe(true)
    expect(texts.indexOf(SCENE_CLEAR_YES) >= 0).toBe(true)
    expect(texts.indexOf(SCENE_CLEAR_KEEP) >= 0).toBe(true)
    expect(texts.length).toBe(3)
    for (const t of texts) {
      expect(/[0-9]|remain|left|missing|everyone else|how many/i.test(t.replace(SCENE_CLEAR_QUESTION, ""))).toBe(false)
    }
    expect(SCENE_CLEAR_LABEL).toBe("Scene clear")
    await sleep(800)
    expect(clock.getElapsed()).toBeGreaterThan(elapsed0 + 0.5) // the clock keeps running while the question is open
    expect(clock.isRunning()).toBe(true)

    // ---- Keep looking: the question closes and the same run carries on
    const seedBefore = tm.getRunState().seed
    await pressButton("SceneClearKeep")
    expect(await waitFor(() => !S.isQuestionOpen(), 1000)).toBe(true)
    expect(clock.isEnded()).toBe(false)
    expect(clock.isRunning()).toBe(true)
    expect(tm.getRunState().seed).toBe(seedBefore)
    expect(cards.getRecord(first).tag).toBe(CASUALTY_TABLE[first].correctTag)
    expect(debrief.isOpen()).toBe(false)
    expect(clock.getElapsed()).toBeGreaterThan(elapsed0 + 0.8)
    expect(await waitFor(() => S.isButtonVisible(), 1000)).toBe(true) // and the button is back

    // ---- Yes: the run ends with "scene-clear"; the other three are not reached
    await pressButton("SceneClearButton")
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    await pressButton("SceneClearYes")
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(clock.isEnded()).toBe(true)
    expect(clock.getEndReason()).toBe("scene-clear")
    expect(debrief.getReason()).toBe("scene-clear")
    expect(clock.isTimesUpVisible()).toBe(false)
    expect(S.isButtonVisible()).toBe(false)
    expect(S.isQuestionOpen()).toBe(false)
    expect((debrief.getPanelObject() as SceneObject).enabled).toBe(false) // a short pause first
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    expect(clock.isTimesUpVisible()).toBe(false) // never shown
    const entries = debrief.getEntries()
    const missed = entries.filter((e) => e.status === "missed")
    expect(missed.length).toBe(3)
    expect(missed.every((e) => e.id !== first)).toBe(true)
    for (const m of missed) {
      expect(debrief.getRowTexts(m.id).notReached).toBe("NOT REACHED")
      expect(debrief.isNotReachedFlashing(m.id)).toBe(true)
      expect(m.myTag === null).toBe(true)
      expect(m.correctTag).toBe(CASUALTY_TABLE[m.id].correctTag)
    }
    const summary = debrief.getSummary()!
    expect(summary.missed).toBe(3)
    expect(summary.correct).toBe(1) // the one tagged correctly; the missed three count as wrong
    expect(summary.text.indexOf("1 of 4 correct · 3 missed") === 0).toBe(true)

    // ---- Restart clears it all; the button is not there until the next tag
    debrief.pressRestart()
    expect(await waitFor(() => clock.isRunning(), 4000)).toBe(true)
    await sleep(700)
    expect(clock.getEndReason() === null).toBe(true)
    expect(S.isButtonVisible()).toBe(false)
    expect(S.isQuestionOpen()).toBe(false)
    expect(S.isPending()).toBe(false)
    cards.setViewerOverride(FAR_VIEWER)
    cards.closeCard()

    // ---- a walker still walking: "Yes" waits until they have arrived
    const seed2 = findSeedWith("A", "off")
    await startRunFar(tm, cards, seed2, "off")
    expect(callOut.pressCallOut()).toBe(true)
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    await sleep(500)
    expect(callOut.getPhase() === "arrived").toBe(false)
    expect(clock.isEnded()).toBe(false) // still walking: not ended yet
    expect(S.isPending()).toBe(true)
    expect(await waitFor(() => clock.isEnded(), 15000)).toBe(true)
    expect(callOut.getPhase()).toBe("arrived")
    expect(clock.getEndReason()).toBe("scene-clear")
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    expect(debrief.getEntries().filter((e) => e.status === "missed").length).toBe(3)

    S.setViewerOverride(null)
    cleanup3(tm, cards)
  }
}
