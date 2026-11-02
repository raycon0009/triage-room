/**
 * Scenario 12 - build step 3: the timer, the chime and the end state.
 *  - the timer is 3:00 and starts on Start;
 *  - it is shown only on an open card (never when the card is closed);
 *  - the chime fires once, when 0:30 is left;
 *  - at 0:00 (a shortened run is used so the test does not take three minutes) any open card closes, the run ends
 *    with a clear "Time's up" state, no card can open any more and the call-out button is gone.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, getClock, getCallOut, startRunFar, pressButton, cleanup3, findSeedWith} from "./TriageLeafHelpers"

@component
export class TriageTimerScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const clock = getClock()
    const callOut = getCallOut()

    // ---- 3:00, starts on Start
    await startRunFar(tm, cards, findSeedWith("A", "off"), "off")
    expect(clock.getDuration()).toBe(180)
    expect(clock.isRunning()).toBe(true)
    expect(clock.getRemaining()).toBeGreaterThan(176)
    expect(clock.getRemaining()).toBeLessThan(180.01)
    expect(clock.getChimeCount()).toBe(0)
    expect(clock.isTimesUpVisible()).toBe(false)

    // ---- shown only on an open card
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getTimerText()).toBe(clock.formatRemaining())
    await pressButton("OpenButton_A")
    expect(cards.isCardVisible()).toBe(true)
    let status = cards.getCardLabels().status
    expect(status.indexOf(clock.formatRemaining()) >= 0).toBe(true)
    expect(status.indexOf("2:5") >= 0 || status.indexOf("3:0") >= 0).toBe(true)
    await pressButton("OpenButton_A") // Close
    expect(cards.isCardVisible()).toBe(false)

    // ---- the chime: nothing at 2:00 left, exactly one at 0:30 left
    clock.debugAdvance(clock.getRemaining() - 120) // 2:00 left
    expect(clock.getChimeCount()).toBe(0)
    clock.debugAdvance(clock.getRemaining() - 31) // 0:31 left
    expect(clock.getChimeCount()).toBe(0)
    expect(clock.getRemaining()).toBeGreaterThan(30)
    clock.debugAdvance(1.5) // 0:29.5 left
    expect(clock.getChimeCount()).toBe(1)
    expect(clock.getRemaining()).toBeLessThan(30)
    expect(clock.chimeAudio.audioTrack === null).toBe(false)
    clock.debugAdvance(10)
    expect(clock.getChimeCount()).toBe(1) // once only
    // the card shows the running time
    await pressButton("OpenButton_A")
    status = cards.getCardLabels().status
    expect(status.indexOf("0:1") >= 0 || status.indexOf("0:2") >= 0).toBe(true)
    cards.closeCard()
    expect(clock.isEnded()).toBe(false)

    // ---- a shortened run: at 0:00 an open card closes and the run ends
    await startRunFar(tm, cards, findSeedWith("A", "off"), "off")
    clock.configure(4, 2)
    expect(callOut.isButtonVisible()).toBe(true)
    await pressButton("OpenButton_A")
    expect(cards.isCardVisible()).toBe(true)
    await sleep(1000)
    expect(clock.isEnded()).toBe(false)
    expect(cards.isCardVisible()).toBe(true)
    await sleep(3600)
    expect(clock.isEnded()).toBe(true)
    expect(clock.getEndReason()).toBe("time")
    expect(clock.isRunning()).toBe(false)
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getOpenCasualtyId() === null).toBe(true)
    expect(clock.getRemaining()).toBe(0)
    expect(clock.getChimeCount()).toBe(1) // the shortened run's chime point (2 s left)
    expect(clock.isTimesUpVisible()).toBe(true)
    expect(callOut.isButtonVisible()).toBe(false)

    // nothing opens any more, and the call-out does nothing
    cards.openCard("A", "button")
    expect(cards.isCardVisible()).toBe(false)
    expect(callOut.pressCallOut()).toBe(false)

    // a new run clears the state
    await startRunFar(tm, cards, findSeedWith("A", "off"), "off")
    expect(clock.isEnded()).toBe(false)
    expect(clock.isTimesUpVisible()).toBe(false)
    expect(clock.isRunning()).toBe(true)

    cleanup3(tm, cards)
  }
}
