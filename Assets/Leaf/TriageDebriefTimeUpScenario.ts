/**
 * Scenario 15 - done criterion 5, time's up with people missed (updated for the build step 5 panel; the worst case
 * for the panel: three people missed, so three big NOT REACHED rows):
 *  - the debrief opens at time's up (shortened run), with the "Time's up" state first, and the cards are locked;
 *  - a missed casualty is row 1 (all missed come first) with NOT REACHED as the biggest, brightest text on the panel,
 *    flashing between red and white; the correct tag is still shown; each counts as a wrong tag;
 *  - the Expectant case (tagged correctly) carries its one short line; a missed walker the walker line; a missed
 *    non-walker the START rule that decides them;
 *  - the panel is still ONE panel, fully in view from the start position, with every text inside it;
 *  - the map markers carry the same numbers as the rows; a flashing NOT REACHED floats over each real missed person;
 *  - the summary lines are exact: "1 of 4 correct · 3 missed" / "0 extra checks · 0:03 used".
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
import {assertPanelReadableAndInView} from "./TriageLeafDebriefChecks"
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

    // ---- time runs out (shortened run): the debrief opens; Time's up is shown alone first
    clock.configure(3, 1)
    for (let i = 0; i < 80 && !debrief.isOpen(); i++) {
      await sleep(100)
    }
    expect(debrief.isOpen()).toBe(true)
    expect(clock.isEnded()).toBe(true)
    expect(clock.getEndReason()).toBe("time")
    expect(debrief.getReason()).toBe("time")
    expect(clock.isTimesUpVisible()).toBe(true) // the clear "Time's up" state
    expect((debrief.getPanelObject() as SceneObject).enabled).toBe(false) // the panel waits for it
    expect(cards.isLocked()).toBe(true)
    expect(cards.isCardVisible()).toBe(false)
    await sleep(2000)
    expect(clock.isTimesUpVisible()).toBe(false)
    expect((debrief.getPanelObject() as SceneObject).enabled).toBe(true)
    await sleep(300)

    // ---- rows: the three missed first (rows 1-3), X last (row 4)
    const entries = debrief.getEntries()
    expect(entries.length).toBe(4)
    expect(entries[3].id).toBe("X")
    expect(entries[3].row).toBe(4)
    const x = entries[3]
    expect(x.status).toBe("correct")
    expect(x.myWord).toBe("EXPECTANT")
    expect(debrief.getRowTexts("X").explanation).toBe("No breathing after airway → Expectant")
    expect(debrief.getRowTexts("X").notReached === undefined).toBe(true)

    for (let i = 0; i < 3; i++) {
      const e = entries[i]
      const def = CASUALTY_TABLE[e.id]
      expect(e.id === "X").toBe(false)
      expect(e.row).toBe(i + 1)
      expect(e.status).toBe("missed")
      expect(e.notReached).toBe(true)
      expect(e.myTag === null).toBe(true)
      expect(e.correctTag).toBe(def.correctTag) // the correct tag is still shown
      const t = debrief.getRowTexts(e.id)
      expect(t.notReached).toBe("NOT REACHED")
      expect(t.correctWord).toBe(e.correctWord)
      expect(t.name).toBe(e.shortName)
      expect(t.youWord === undefined).toBe(true) // no tag of mine
      if (e.id === walkerId) {
        expect(t.explanation).toBe("Can walk → Green (reassessed later)")
      } else {
        expect(t.explanation.indexOf("→") >= 0).toBe(true) // the START rule that decides them
      }
      // NOT REACHED is the biggest text on the panel (bigger than the summary and than any row text)
      expect(debrief.getRowTextSize(e.id, "notReached")).toBe(debrief.getMaxTextSize())
      // flashing: on the panel, on the map marker, and over the real person
      expect(debrief.isNotReachedFlashing(e.id)).toBe(true)
      const wf = debrief.getWorldFlashObject(e.id) as SceneObject
      expect(wf === null).toBe(false)
      const real = casualtyWorldPos(tm, e.id)
      const wp = wf.getTransform().getWorldPosition()
      expect(Math.abs(wp.x - real.x)).toBeLessThan(5)
      expect(Math.abs(wp.z - real.z)).toBeLessThan(5)
      expect(wp.y - real.y).toBeGreaterThan(120)
    }

    // ---- the panel: one, readable, fully in view even with three NOT REACHED rows; numbers on the markers; Restart
    assertPanelReadableAndInView(debrief, tm, true)

    // ---- the flash really flashes: red <-> white. Bright phase = white; dim phase = red.
    const id1 = entries[0].id
    let gLo = 2
    let gHi = -1
    let lo = 2
    let hi = -1
    for (let i = 0; i < 16; i++) {
      const c = debrief.getRowTextColour(id1, "notReached") as vec4
      gLo = Math.min(gLo, c.g)
      gHi = Math.max(gHi, c.g)
      lo = Math.min(lo, debrief.getFlashLevel())
      hi = Math.max(hi, debrief.getFlashLevel())
      await sleep(60)
    }
    expect(hi - lo).toBeGreaterThan(0.3)
    expect(gHi - gLo).toBeGreaterThan(0.3)
    debrief.flashHz = 0 // hold the bright phase
    await sleep(300)
    const bright = debrief.getRowTextColour(id1, "notReached") as vec4
    expect(bright.r > 0.97 && bright.g > 0.97 && bright.b > 0.97).toBe(true) // white
    debrief.flashHz = 1.8

    // ---- summary: counts as wrong; exact lines
    const s = debrief.getSummary()
    expect(s!.total).toBe(4)
    expect(s!.correct).toBe(1)
    expect(s!.missed).toBe(3)
    expect(s!.wrong).toBe(0)
    expect(s!.total - s!.correct).toBe(s!.wrong + s!.missed) // a missed person counts as a wrong tag
    expect(s!.totalExtraChecks).toBe(0)
    expect(s!.text).toBe("1 of 4 correct · 3 missed · 0 extra checks · 0:03 used")
    expect(debrief.getSummaryLines()[0]).toBe("1 of 4 correct · 3 missed")
    expect(debrief.getSummaryLines()[1]).toBe("0 extra checks · 0:03 used")
    const sc = debrief.getSummaryLines()[0]
    const sumCol = debrief.getRowTextColour("X", "name") as vec4
    expect(sc.length > 0).toBe(true)
    expect(sumCol.r > 0.95).toBe(true)

    // nothing opens any more
    cards.openCard("A", "button")
    expect(cards.isCardVisible()).toBe(false)

    cleanup3(tm, cards)
  }
}
