/**
 * Scenario 15 - done criterion 5 (build step 4), time's up with people missed:
 *  - the debrief opens at time's up (shortened run), with the "Time's up" state, and the cards are locked;
 *  - the Expectant casualty (tagged correctly here) has the one-line "why Expectant was right";
 *  - everyone untagged is "Not reached": flashing label, flashing marker, flashing text over the real person, the
 *    correct tag still shown, and each counts as a wrong tag;
 *  - the explanation lines: walkers ("real START reassesses walkers later"), and the deciding START rule for a miss;
 *  - the summary line is exact for this scripted run: 1 of 4 correct, 3 missed, 0 extra checks, 0:03 used.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  getTriageMain,
  getCards,
  getClock,
  getDebrief,
  startRunFar,
  tagWithChecks,
  cleanup3,
  findSeedWith,
  casualtyWorldPos,
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {CASUALTY_TABLE} from "../Scripts/TriageData"

@component
export class TriageDebriefTimeUpScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const clock = getClock()
    const debrief = getDebrief()
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.timesUpSeconds = 1.5

    const state = await startRunFar(tm, cards, findSeedWith("X", "on"), "on")
    const walkerId = state.walkerId
    expect(state.blackIncluded).toBe(true)

    // ---- only X (Expectant) is tagged, correctly; the other three are never reached
    expect(await tagWithChecks(cards, "X", "Black")).toBe(true)
    expect(debrief.isOpen()).toBe(false)

    // ---- time runs out (shortened run): the debrief opens
    clock.configure(3, 1)
    for (let i = 0; i < 80 && !debrief.isOpen(); i++) {
      await sleep(100)
    }
    expect(debrief.isOpen()).toBe(true)
    expect(clock.isEnded()).toBe(true)
    expect(clock.getEndReason()).toBe("time")
    expect(debrief.getReason()).toBe("time")
    expect(clock.isTimesUpVisible()).toBe(true) // the clear "Time's up" state
    expect(cards.isLocked()).toBe(true)
    expect(cards.isCardVisible()).toBe(false)
    await sleep(300)

    // ---- the entries
    const entries = debrief.getEntries()
    expect(entries.length).toBe(4)
    const x = entries.filter((e) => e.id === "X")[0]
    expect(x.status).toBe("correct")
    expect(x.myWord).toBe("EXPECTANT")
    expect(x.correctWord).toBe("EXPECTANT")
    expect(x.explanation.indexOf("Expectant was the right call") >= 0).toBe(true)
    expect(debrief.getLabelTexts("X").explanation.length > 0 || debrief.getLabelTexts("X").explanation1 !== undefined).toBe(true)

    let missed = 0
    for (const e of entries) {
      if (e.id === "X") {
        continue
      }
      missed++
      const def = CASUALTY_TABLE[e.id]
      expect(e.status).toBe("missed")
      expect(e.notReached).toBe(true)
      expect(e.myTag === null).toBe(true)
      expect(e.myWord).toBe("")
      expect(e.correctTag).toBe(def.correctTag) // the correct tag is still shown
      expect(e.correctWord.length > 0).toBe(true)
      if (e.id === walkerId) {
        expect(e.explanation.indexOf("reassesses walkers later") >= 0).toBe(true)
      } else {
        expect(e.explanation.indexOf("→") >= 0).toBe(true) // the START rule that decides them
      }
      // flashing: label word, marker, and text over the real person
      expect(debrief.isNotReachedFlashing(e.id)).toBe(true)
      expect(debrief.getLabelTexts(e.id).notReached).toBe("NOT REACHED")
      expect(debrief.getLabelTexts(e.id).correctWord).toBe(e.correctWord)
      const wf = debrief.getWorldFlashObject(e.id) as SceneObject
      expect(wf === null).toBe(false)
      const real = casualtyWorldPos(tm, e.id)
      const wp = wf.getTransform().getWorldPosition()
      expect(Math.abs(wp.x - real.x)).toBeLessThan(5)
      expect(Math.abs(wp.z - real.z)).toBeLessThan(5)
      expect(wp.y - real.y).toBeGreaterThan(120) // over the person, at head height or above
    }
    expect(missed).toBe(3)

    // the flash really flashes: its brightness swings
    let lo = 2
    let hi = -1
    let rLo = 2
    let rHi = -1
    for (let i = 0; i < 14; i++) {
      const lvl = debrief.getFlashLevel()
      lo = Math.min(lo, lvl)
      hi = Math.max(hi, lvl)
      const c = debrief.getLabelTextColour(entries.filter((e) => e.notReached)[0].id, "notReached") as vec4
      rLo = Math.min(rLo, c.r)
      rHi = Math.max(rHi, c.r)
      await sleep(60)
    }
    expect(hi - lo).toBeGreaterThan(0.3)
    expect(rHi - rLo).toBeGreaterThan(0.2)

    // ---- summary: counts as wrong; exact line
    const s = debrief.getSummary()
    expect(s!.total).toBe(4)
    expect(s!.correct).toBe(1)
    expect(s!.missed).toBe(3)
    expect(s!.wrong).toBe(0)
    expect(s!.total - s!.correct).toBe(s!.wrong + s!.missed) // a missed person counts as a wrong tag
    expect(s!.totalExtraChecks).toBe(0)
    expect(s!.text).toBe("1 of 4 correct · 3 missed · 0 extra checks · 0:03 used")
    expect(debrief.getSummaryTextValue()).toBe(s!.text)

    // ---- the Time's up panel steps aside for the map after a moment
    await sleep(1600)
    expect(clock.isTimesUpVisible()).toBe(false)
    expect(debrief.isOpen()).toBe(true)

    // nothing opens any more
    cards.openCard("A", "button")
    expect(cards.isCardVisible()).toBe(false)

    cleanup3(tm, cards)
  }
}
