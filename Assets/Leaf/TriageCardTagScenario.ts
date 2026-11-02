/**
 * Scenario 9 - done criterion 3, end + criterion 4 (rate 16, pulse present, refill 1 s, follows commands -> Yellow):
 * tagging closes the card and puts a coloured band and a word on the casualty.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, findSeedWith, startRunFar, pressButton, cleanup} from "./TriageLeafHelpers"

@component
export class TriageCardTagScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    await startRunFar(tm, cards, findSeedWith("D", "off"), "off")

    expect(cards.hasTagBand("D")).toBe(false)
    await pressButton("OpenButton_D")
    await pressButton("CardBtn_breathing")
    await pressButton("CardBtn_second")
    await pressButton("CardBtn_pulse")
    await pressButton("CardBtn_commands")
    expect(cards.isTagPanelVisible()).toBe(true)

    await pressButton("TagBtn_Yellow")
    await sleep(300)

    // card closed
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getOpenCasualtyId() === null).toBe(true)
    // coloured band + the word on the casualty
    expect(cards.hasTagBand("D")).toBe(true)
    expect(cards.getTagWordText("D")).toBe("YELLOW")
    // record: Yellow, no extra checks, four distinct checks, some time on the card
    const rec = cards.getRecord("D")
    expect(rec.tag).toBe("Yellow")
    expect(rec.correctTag).toBe("Yellow")
    expect(rec.extraChecks).toBe(0)
    expect(rec.checks.length).toBe(4)
    expect(rec.openSeconds).toBeGreaterThan(0)

    cleanup(tm, cards)
  }
}
