/**
 * Scenario 25 - the bigger casualty pool: G is the first case decided by capillary refill (rate 20, pulse present, refill 3 s).
 *  - G's card: after Breathing and Rate no tag is offered; the pulse / refill button then shows the refill (3 s) and only then do
 *    the tag buttons appear; tagging Red at that step is correct with 0 extra checks.
 *  - Learn mode: the chips follow G (Rate is current, then the Pulse chip decides RED and the later chips stay dim).
 *  - Drill: tagging G wrongly (Yellow) gives a debrief line that names the real condition, "Refill 3 s is over 2 s → Red",
 *    and the panel still fits the view with every text inside it.
 *  - The other new cases (H, J, W3) appear in runs and show their scripted results.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, getClock, getDebrief, startRunFar, pressButton, cleanup3, findSeedWith, FAR_VIEWER} from "./TriageLeafHelpers"
import {assertPanelReadableAndInView} from "./TriageLeafDebriefChecks"
import {CASUALTY_TABLE} from "../Scripts/TriageData"

@component
export class TriageBiggerPoolScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const clock = getClock()
    const debrief = getDebrief()
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.timesUpSeconds = 1.5

    // ---- Learn: G's card and chips
    const seedG = findSeedWith("G", "off")
    cards.setViewerOverride(FAR_VIEWER)
    cards.closeCard()
    tm.regenerate(seedG, "off")
    tm.startRun("learn")
    await sleep(400)
    expect(tm.getMode()).toBe("learn")
    expect(tm.getRunState().casualties.some((c) => c.id === "G")).toBe(true)
    cards.openCard("G", "button")
    await sleep(300)
    expect(cards.isTagPanelVisible()).toBe(false)
    cards.pressCheck("breathing")
    cards.pressCheck("rate")
    await sleep(150)
    expect(cards.getCardLabels().second).toBe("Rate: 20/min")
    expect(cards.isTagPanelVisible()).toBe(false) // rate 20 does not decide
    expect(cards.getLearnChips().chips.map((c) => c.state).join(",")).toBe("done,done,done,current,dim")
    cards.pressCheck("pulse")
    await sleep(150)
    const refillText = cards.getCardLabels().pulse
    expect(refillText.toLowerCase().indexOf("refill 3 s") >= 0).toBe(true) // the refill result: 3 s
    expect(refillText.toLowerCase().indexOf("present") >= 0).toBe(true)
    expect(cards.isTagPanelVisible()).toBe(true) // tags are offered only now
    const row = cards.getLearnChips()
    expect(row.chips.map((c) => c.state).join(",")).toBe("done,done,done,decided,dim")
    expect(row.chips[3].label).toBe("RED")
    expect(row.chips[3].tag).toBe("Red")
    await pressButton("TagBtn_Red")
    await sleep(300)
    const rec = cards.getRecord("G")
    expect(rec.tag).toBe("Red")
    expect(rec.correctTag).toBe("Red")
    expect(rec.decidingStep).toBe(4)
    expect(rec.extraChecks).toBe(0)
    expect(rec.checks.length).toBe(3)
    expect(cards.getTagWordText("G")).toBe("RED")

    // ---- Drill: G tagged wrongly, the debrief line names the real condition
    const state = await startRunFar(tm, cards, findSeedWith("G", "off"), "off")
    expect(tm.getMode()).toBe("drill")
    expect(state.casualties.some((c) => c.id === "G")).toBe(true)
    cards.openCard("G", "button")
    await sleep(300)
    cards.pressCheck("breathing")
    cards.pressCheck("rate")
    expect(cards.isTagPanelVisible()).toBe(false)
    cards.pressCheck("pulse")
    expect(cards.isTagPanelVisible()).toBe(true)
    expect(cards.chooseTag("Yellow")).toBe(true) // wrong on purpose
    clock.configure(3, 1)
    for (let i = 0; i < 100 && !debrief.isOpen(); i++) {
      await sleep(100)
    }
    expect(debrief.isOpen()).toBe(true)
    await sleep(2300)
    const g = debrief.getEntries().filter((e) => e.id === "G")[0]
    expect(g.status).toBe("wrong")
    expect(g.myWord).toBe("YELLOW")
    expect(g.correctWord).toBe("RED")
    expect(g.explanation).toBe("Refill 3 s is over 2 s → Red")
    expect(debrief.getRowTexts("G").explanation).toBe("Refill 3 s is over 2 s → Red")
    assertPanelReadableAndInView(debrief, tm, true) // fits the panel, every text inside it
    cleanup3(tm, cards)

    // ---- the other new cases appear and keep to their scripted results
    for (const id of ["H", "J", "W3"]) {
      const seed = findSeedWith(id, "off")
      await startRunFar(tm, cards, seed, "off")
      const def = CASUALTY_TABLE[id]
      expect(tm.getRunState().casualties.some((c) => c.id === id)).toBe(true)
      if (id === "W3") {
        expect(def.walks).toBe(true)
        expect(tm.getRunState().walkerId).toBe("W3")
      } else {
        cards.openCard(id, "button")
        await sleep(300)
        cards.pressCheck("breathing")
        cards.pressCheck("rate")
        await sleep(100)
        expect(cards.getCardLabels().second).toBe("Rate: " + def.respRate + "/min")
        expect(cards.isTagPanelVisible()).toBe(id === "J") // J (rate 32) is decided by the rate; H still needs the pulse and commands
        cards.closeCard()
      }
      cleanup3(tm, cards)
    }
  }
}
