/**
 * Scenario 8 - done criterion 3, middle: each check button shows that casualty's scripted result, and the tag
 * buttons appear only once a step has decided the tag. Casualty D: rate 16, pulse present, refill 1 s, follows
 * commands -> the tag is decided only by the last check ("Follows commands?"); no tag buttons before that.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, findSeedWith, startRunFar, pressButton, cleanup} from "./TriageLeafHelpers"

@component
export class TriageCardResultsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    await startRunFar(tm, cards, findSeedWith("D", "off"), "off")

    await pressButton("OpenButton_D")
    expect(cards.getOpenCasualtyId()).toBe("D")
    let l = cards.getCardLabels()
    expect(l.breathing).toBe("Breathing?")
    expect(l.second).toBe("Breathing rate")
    expect(l.pulse).toBe("Pulse / refill")
    expect(l.commands).toBe("Follows commands?")
    expect(cards.isTagPanelVisible()).toBe(false)

    await pressButton("CardBtn_breathing")
    expect(cards.getCardLabels().breathing).toBe("Breathing: Yes")
    expect(cards.isTagPanelVisible()).toBe(false)

    await pressButton("CardBtn_second")
    expect(cards.getCardLabels().second).toBe("Rate: 16/min")
    expect(cards.isTagPanelVisible()).toBe(false)

    await pressButton("CardBtn_pulse")
    expect(cards.getCardLabels().pulse).toBe("Pulse present, refill 1 s")
    expect(cards.isTagPanelVisible()).toBe(false)

    await pressButton("CardBtn_commands")
    l = cards.getCardLabels()
    expect(l.commands).toBe("Follows commands: Yes")
    // the deciding step has now been made: tag buttons appear
    expect(cards.isTagPanelVisible()).toBe(true)
    expect(l.TagBtn_Red).toBe("RED")
    expect(l.TagBtn_Yellow).toBe("YELLOW")
    expect(l.TagBtn_Green).toBe("GREEN")
    expect(l.TagBtn_Expectant).toBe("EXPECTANT")

    await sleep(100)
    cleanup(tm, cards)
  }
}
