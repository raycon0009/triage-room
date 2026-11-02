/**
 * Scenario 11 - done criterion 2 (build step 3): "Call out: walk to me".
 *  - pinching the real CallOutButton makes the walker stand up, walk to the green MINOR circle and stand in it
 *    with a green band and the word GREEN;
 *  - nobody else moves (positions unchanged), nobody else is tagged;
 *  - it counts as tagging the walker Green at the deciding step: tag Green, 0 extra checks, no checks pressed,
 *    the time into the run recorded;
 *  - the button is gone afterwards and a second call-out does nothing.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, getCallOut, getClock, startRunFar, pressButton, cleanup3, casualtyWorldPos} from "./TriageLeafHelpers"

function dist2d(a: vec3, b: vec3): number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z))
}

@component
export class TriageCallOutScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const callOut = getCallOut()
    const clock = getClock()
    const state = await startRunFar(tm, cards, 7, "off")
    const walkerId = state.walkerId
    expect(CASUALTY_WALKS(walkerId)).toBe(true)

    // the big button is there after Start
    expect(callOut.isButtonVisible()).toBe(true)
    expect(callOut.isUsed()).toBe(false)

    // everybody's position before
    const ids = state.casualties.map((c) => c.id as string)
    const before: {[id: string]: vec3} = {}
    for (const id of ids) {
      before[id] = casualtyWorldPos(tm, id)
    }
    await sleep(600) // a little time on the run clock so the recorded time is above zero

    // ---- pinch the button (LEAF's scripted interactor presses the real UI Kit button)
    await pressButton("CallOutButton")
    expect(callOut.isUsed()).toBe(true)
    expect(callOut.getWalkerId()).toBe(walkerId)
    expect(callOut.isButtonVisible()).toBe(false)

    // counted at once: tagged Green at the deciding step, no checks, time recorded
    const rec = cards.getRecord(walkerId)
    expect(rec.tag).toBe("Green")
    expect(rec.tagWord).toBe("GREEN")
    expect(rec.calledOut).toBe(true)
    expect(rec.decidingStep).toBe(0)
    expect(rec.extraChecks).toBe(0)
    expect(rec.checks.length).toBe(0)
    expect(rec.calledOutAtSeconds === null).toBe(false)
    expect(rec.calledOutAtSeconds as number).toBeGreaterThan(0.3)
    expect(rec.calledOutAtSeconds as number).toBeLessThan(10)
    expect(Math.abs((rec.calledOutAtSeconds as number) - clock.getElapsed())).toBeLessThan(3)

    // ---- the walker stands up, then walks, then arrives (poll up to 12 s)
    let sawStanding = callOut.getPhase() === "standing"
    let sawWalking = false
    for (let i = 0; i < 120 && callOut.getPhase() !== "arrived"; i++) {
      await sleep(100)
      if (callOut.getPhase() === "standing") sawStanding = true
      if (callOut.getPhase() === "walking") sawWalking = true
    }
    expect(sawStanding).toBe(true)
    expect(sawWalking).toBe(true)
    expect(callOut.getPhase()).toBe("arrived")
    await sleep(300)

    // stands inside the green circle (diameter 100 cm) with the band and the word
    expect(callOut.getArrivalDistanceCm()).toBeGreaterThan(-0.5)
    expect(callOut.getArrivalDistanceCm()).toBeLessThan(50)
    expect(cards.hasTagBand(walkerId)).toBe(true)
    expect(cards.getTagWordText(walkerId)).toBe("GREEN")
    const walker = tm.getCasualtyObject(walkerId) as SceneObject
    const wp = walker.getTransform().getWorldPosition()
    expect(dist2d(wp, before[walkerId])).toBeGreaterThan(60) // it really went somewhere

    // and is standing: the head is high above the floor (floor is y of the room root)
    const floorY = tm.sceneObject.getTransform().getWorldPosition().y
    let headY = -1e9
    const visit = (so: SceneObject): void => {
      if (so.name === "Head") headY = so.getTransform().getWorldPosition().y
      for (let i = 0; i < so.getChildrenCount(); i++) visit(so.getChild(i))
    }
    visit(walker)
    expect(headY - floorY).toBeGreaterThan(130)

    // ---- nobody else moved, nobody else was tagged
    for (const id of ids) {
      if (id === walkerId) continue
      expect(dist2d(casualtyWorldPos(tm, id), before[id])).toBeLessThan(0.5)
      expect(cards.getRecord(id).tag === null).toBe(true)
      expect(cards.getRecord(id).calledOut).toBe(false)
    }

    // ---- a second call-out does nothing
    expect(callOut.pressCallOut()).toBe(false)

    cleanup3(tm, cards)
  }
}

function CASUALTY_WALKS(id: string): boolean {
  return id === "W1" || id === "W2"
}
