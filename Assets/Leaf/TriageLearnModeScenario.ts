/**
 * Scenario 19 - Learn mode (START guide) and Drill mode.
 *  - The start screen has Learn and Drill; the real buttons start the same timed run in the right mode.
 *  - Learn: the open card shows one row of five step chips; the current step is highlighted as checks are made (including
 *    "Airway" for F / X), the deciding chip shows the tag word in the tag colour, steps not reached stay dim.
 *  - Drill: no chip row, and the card layout is the one it always had (also after a Learn run).
 *  - The Learn card stays inside the same card (chips inside the card width, nothing pushed out of the top or bottom).
 *  - The debrief notes the mode ("Learn · ..."), Drill's summary is unchanged, and Restart keeps the mode.
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
  resetToFreshStart,
  pressButton,
  findSeedWith,
  tagWithChecks,
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {assertPanelReadableAndInView} from "./TriageLeafDebriefChecks"
import {DEMO_SEED} from "../Scripts/TriageLayout"

type Chip = {label: string; state: string; tag: string | null; textColor: vec4; barOn: boolean; localX: number; widthCm: number}

function states(chips: Chip[]): string {
  return chips.map((c) => c.state).join(",")
}
function labels(chips: Chip[]): string {
  return chips.map((c) => c.label).join(",")
}

@component
export class TriageLearnModeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const clock = getClock()
    const debrief = getDebrief()
    debrief.setViewerOverride(FAR_VIEWER)

    // ---- the start screen: Learn and Drill, each starts the same run in its own mode
    // Pin the viewer at the start position first, so this covers the Drill-first case whatever position the preview camera starts in.
    cards.setViewerOverride(FAR_VIEWER)
    getCue().setViewerOverride(FAR_VIEWER)
    resetToFreshStart(tm)
    await sleep(400)
    await pressButton("LearnButton")
    await sleep(300)
    expect(tm.isStarted()).toBe(true)
    expect(tm.getMode()).toBe("learn")
    expect(clock.isRunning()).toBe(true)
    resetToFreshStart(tm)
    await sleep(400)
    await pressButton("StartButton") // the Drill button
    await sleep(300)
    expect(tm.isStarted()).toBe(true)
    expect(tm.getMode()).toBe("drill")
    expect(clock.isRunning()).toBe(true)

    // ---- Drill: the card has no chip row; remember its layout
    let state = await startRunFar(tm, cards, DEMO_SEED, "on")
    expect(tm.getMode()).toBe("drill")
    cards.openCard("D", "button")
    await sleep(300)
    expect(cards.getLearnChips().visible).toBe(false)
    const drillFit = cards.getCardFit()
    const drillSize = cards.getCardSizeCm()
    cards.closeCard()

    // ---- Learn, casualty D (Yellow, decided by the last step)
    state = startRunFarLearn(tm, cards, DEMO_SEED, "on")
    await sleep(400)
    expect(tm.getMode()).toBe("learn")
    expect(state.casualties.length).toBe(4)
    cards.openCard("D", "button")
    await sleep(300)
    let row = cards.getLearnChips()
    expect(row.visible).toBe(true)
    expect(row.chips.length).toBe(5)
    expect(labels(row.chips)).toBe("Walks?,Breath?,Rate,Pulse,Obeys?")
    expect(states(row.chips)).toBe("done,current,dim,dim,dim")
    // the current step is highlighted (bar + bright text), dim steps are dimmer than finished ones
    expect(row.chips[1].barOn).toBe(true)
    expect(row.chips[0].barOn).toBe(false)
    expect(row.chips[1].textColor.r > 0.95 && row.chips[1].textColor.b > 0.95).toBe(true)
    expect(row.chips[2].textColor.r < 0.6).toBe(true)
    expect(row.chips[0].textColor.r > row.chips[2].textColor.r).toBe(true)
    const startRowY = row.rowY

    cards.pressCheck("breathing")
    await sleep(150)
    expect(states(cards.getLearnChips().chips)).toBe("done,done,current,dim,dim")
    cards.pressCheck("rate")
    await sleep(150)
    expect(states(cards.getLearnChips().chips)).toBe("done,done,done,current,dim")
    cards.pressCheck("pulse")
    await sleep(150)
    expect(states(cards.getLearnChips().chips)).toBe("done,done,done,done,current")
    expect(cards.isTagPanelVisible()).toBe(false)
    cards.pressCheck("commands")
    await sleep(150)
    row = cards.getLearnChips()
    expect(states(row.chips)).toBe("done,done,done,done,decided")
    expect(row.chips[4].label).toBe("YELLOW")
    expect(row.chips[4].tag).toBe("Yellow")
    const y = row.chips[4].textColor
    expect(y.r > 0.9 && y.g > 0.8 && y.b < 0.5).toBe(true) // yellow
    expect(row.chips[4].barOn).toBe(true)
    expect(cards.isTagPanelVisible()).toBe(true)

    // the Learn card is the same card: chips inside its width, nothing pushed out of the top or bottom
    const fit = cards.getCardFit()
    const size = cards.getCardSizeCm()
    expect(size.width).toBe(drillSize.width)
    expect(size.height).toBe(drillSize.height)
    for (const c of row.chips) {
      expect(Math.abs(c.localX) + c.widthCm / 2 <= fit.halfWidth).toBe(true)
    }
    expect(fit.lowestButtonBottom >= -fit.halfHeight).toBe(true)
    // the chip row sits directly under the header row (pose + timer) and above the latest-result line, inside the card
    expect(startRowY + 0.85 <= fit.titleBottom + 0.3).toBe(true)
    expect(startRowY - 0.85 >= fit.statusTop - 0.4).toBe(true)
    expect(fit.titleTop <= fit.halfHeight).toBe(true)
    cards.closeCard()

    // ---- Learn, casualty X: after "Breathing: No" the Airway step is highlighted; the airway decides Expectant
    cards.openCard("X", "button")
    await sleep(300)
    expect(states(cards.getLearnChips().chips)).toBe("done,current,dim,dim,dim")
    cards.pressCheck("breathing")
    await sleep(150)
    row = cards.getLearnChips()
    expect(states(row.chips)).toBe("done,current,dim,dim,dim")
    expect(row.chips[1].label).toBe("Airway")
    expect(cards.getCardLabels().second).toBe("Open airway")
    cards.pressCheck("airway")
    await sleep(150)
    row = cards.getLearnChips()
    expect(states(row.chips)).toBe("done,decided,dim,dim,dim")
    expect(row.chips[1].label).toBe("EXPECTANT")
    expect(row.chips[1].tag).toBe("Black")
    expect(row.chips[1].textColor.r > 0.95 && row.chips[1].textColor.g > 0.95).toBe(true) // white, never black
    cards.closeCard()

    // ---- Learn, the walker: "Walks?" decides Green at once, the rest stay dim
    cards.openCard("W1", "button")
    await sleep(300)
    row = cards.getLearnChips()
    expect(states(row.chips)).toBe("decided,dim,dim,dim,dim")
    expect(row.chips[0].label).toBe("GREEN")
    expect(row.chips[0].textColor.g > 0.9 && row.chips[0].textColor.r < 0.6).toBe(true)
    cards.closeCard()

    // ---- Learn, a rate-over-30 case: Rate decides Red, the later chips stay dim even after an extra check
    const seedA = findSeedWith("A", "off")
    startRunFarLearn(tm, cards, seedA, "off")
    await sleep(400)
    cards.openCard("A", "button")
    await sleep(300)
    cards.pressCheck("breathing")
    cards.pressCheck("rate")
    await sleep(150)
    row = cards.getLearnChips()
    expect(states(row.chips)).toBe("done,done,decided,dim,dim")
    expect(row.chips[2].label).toBe("RED")
    cards.pressCheck("pulse")
    await sleep(150)
    expect(states(cards.getLearnChips().chips)).toBe("done,done,decided,dim,dim")
    cards.closeCard()

    // ---- Drill again: no chip row, and the card layout is exactly the old one (also after a Learn run)
    await startRunFar(tm, cards, DEMO_SEED, "on")
    expect(tm.getMode()).toBe("drill")
    cards.openCard("D", "button")
    await sleep(300)
    expect(cards.getLearnChips().visible).toBe(false)
    const again = cards.getCardFit()
    expect(Math.abs(again.lowestButtonBottom - drillFit.lowestButtonBottom) < 0.01).toBe(true)
    expect(Math.abs(again.titleTop - drillFit.titleTop) < 0.01).toBe(true)
    cards.closeCard()

    // ---- the debrief notes the mode in Learn, Drill's summary is unchanged
    debrief.timesUpSeconds = 1.5
    startRunFarLearn(tm, cards, DEMO_SEED, "on")
    await sleep(400)
    expect(await tagWithChecks(cards, "X", "Black")).toBe(true) // one tagged, three missed (the shape the panel is sized for)
    clock.configure(3, 1)
    for (let i = 0; i < 100 && !debrief.isOpen(); i++) {
      await sleep(100)
    }
    expect(debrief.isOpen()).toBe(true)
    await sleep(2200)
    const learnLines = debrief.getSummaryLines()
    expect(learnLines[0].indexOf("Learn · ") === 0).toBe(true)
    expect(learnLines[0]).toBe("Learn · 1 of 4 correct · 3 missed")
    expect((debrief.getSummary() as {text: string}).text.indexOf("Learn · 1 of 4 correct") === 0).toBe(true)
    assertPanelReadableAndInView(debrief, tm, true) // the longer first line still fits the panel

    // ---- Restart keeps the mode (still Learn): a new run, chips on its card
    await pressButton("RestartButton")
    await sleep(600)
    expect(tm.isStarted()).toBe(true)
    expect(tm.getMode()).toBe("learn")
    cards.setViewerOverride(FAR_VIEWER)
    const firstId = tm.getRunState().casualties[0].id
    cards.openCard(firstId, "button")
    await sleep(300)
    expect(cards.getLearnChips().visible).toBe(true)
    cards.closeCard()

    // ---- Drill debrief: no mode prefix, and Restart keeps Drill
    startFixedDrill(tm, cards)
    await sleep(400)
    expect(await tagWithChecks(cards, "X", "Black")).toBe(true)
    clock.configure(3, 1)
    for (let i = 0; i < 100 && !debrief.isOpen(); i++) {
      await sleep(100)
    }
    expect(debrief.isOpen()).toBe(true)
    await sleep(2200)
    const drillLines = debrief.getSummaryLines()
    expect(drillLines[0]).toBe("1 of 4 correct · 3 missed")
    await pressButton("RestartButton")
    await sleep(600)
    expect(tm.getMode()).toBe("drill")
    cards.openCard(tm.getRunState().casualties[0].id, "button")
    await sleep(300)
    expect(cards.getLearnChips().visible).toBe(false)
    cards.closeCard()

    cards.setViewerOverride(null)
    debrief.setViewerOverride(null)
    getCue().setViewerOverride(null)
    resetToFreshStart(tm)
  }
}

function startRunFarLearn(tm: ReturnType<typeof getTriageMain>, cards: ReturnType<typeof getCards>, seed: number, forceBlack: string) {
  cards.setViewerOverride(FAR_VIEWER)
  cards.closeCard()
  tm.regenerate(seed, forceBlack)
  tm.startRun("learn")
  return tm.getRunState()
}

function startFixedDrill(tm: ReturnType<typeof getTriageMain>, cards: ReturnType<typeof getCards>) {
  cards.setViewerOverride(FAR_VIEWER)
  cards.closeCard()
  tm.regenerate(DEMO_SEED, "on")
  tm.startRun("drill")
  return tm.getRunState()
}
