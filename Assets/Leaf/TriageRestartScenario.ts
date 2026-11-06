/**
 * Scenario 16 - build step 5: Restart and the seeds.
 *  - pinching the real Restart button (waist height, above the map) clears EVERYTHING of the last run (tags, bands,
 *    the called-out walker, timer, debrief, arrow and groan state, Time's up) and starts a new run with a NEW seed,
 *    so the cases / slots change; nothing from the previous run is left in the scene;
 *  - two different seeds give different layouts; a fixed seed repeats; restarting without a fixed seed never repeats
 *    the same cases / slots as the run before;
 *  - the named demo seed gives the documented layout (also through the "Use demo seed" setting).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
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
  layoutKey,
  casualtyWorldPos,
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {countNamed} from "./TriageLeafDebriefChecks"
import {DEMO_SEED} from "../Scripts/TriageLayout"

function signature(state: {casualties: {id: string; slot: string}[]}): string {
  return state.casualties.map((c) => c.id + ":" + c.slot).join(",")
}

function hasDescendantNamed(root: SceneObject, prefix: string): boolean {
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const c = root.getChild(i)
    if (!c || isNull(c)) {
      continue
    }
    if (c.name.indexOf(prefix) === 0 || hasDescendantNamed(c, prefix)) {
      return true
    }
  }
  return false
}

@component
export class TriageRestartScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const clock = getClock()
    const callOut = getCallOut()
    const cue = getCue()
    const debrief = getDebrief()
    debrief.endGraceSeconds = 0.3
    debrief.timesUpSeconds = 1
    debrief.setViewerOverride(FAR_VIEWER)

    // ---- a first run with a mess in it: a wrong tag, a called-out walker (band on), a card left open, time's up
    // Learn mode: the arrow and the repeating groan are Learn-only now (Drill has neither); Restart keeps the mode
    const first = await startRunFar(tm, cards, findSeedWith("A", "off"), "off", "learn")
    const firstSig = signature(first)
    const firstWalker = first.walkerId
    const oldWalkerObj = tm.getCasualtyObject(firstWalker) as SceneObject
    expect(await tagWithChecks(cards, "A", "Yellow", "pulse")).toBe(true)
    expect(callOut.pressCallOut()).toBe(true)
    for (let i = 0; i < 120 && callOut.getPhase() !== "arrived"; i++) {
      await sleep(100)
    }
    expect(callOut.getPhase()).toBe("arrived")
    expect(cards.hasTagBand("A")).toBe(true)
    expect(cards.hasTagBand(firstWalker)).toBe(true)
    cue.setViewerOverride(FAR_VIEWER, new vec3(0, 0, -1))
    clock.configure(2, 1)
    for (let i = 0; i < 60 && !debrief.isOpen(); i++) {
      await sleep(100)
    }
    expect(debrief.isOpen()).toBe(true)
    expect(debrief.getReason()).toBe("time")
    expect(countNamed("TagBand_")).toBeGreaterThan(1)
    expect(countNamed("DebriefPanel")).toBe(1)
    // wait (up to 4 s) until the reveal has made the Restart button pressable, instead of a fixed 1.3 s that raced the reveal
    for (let i = 0; i < 40 && !findInteractableByName("RestartButton"); i++) {
      await sleep(100)
    }
    await sleep(200)

    // ---- pinch Restart (the real button)
    expect((debrief.getRestartButtonObject() as SceneObject) === null).toBe(false)
    await pressButton("RestartButton")
    for (let i = 0; i < 30 && debrief.isOpen(); i++) {
      await sleep(100)
    }
    await sleep(500)
    // the old debrief is hidden at once and destroyed about half a second later (after the pinching interactor let go)
    for (let i = 0; i < 20 && debrief.getRetiredCount() > 0; i++) {
      await sleep(100)
    }
    expect(debrief.getRetiredCount()).toBe(0)

    // ---- everything is cleared and a new run is going
    expect(debrief.isOpen()).toBe(false)
    expect(debrief.getMapObject() === null).toBe(true)
    expect(debrief.getPanelObject() === null).toBe(true)
    expect(debrief.getRestartButtonObject() === null).toBe(true)
    // no debrief objects left (the two permanent Scene clear panels are children of this object too, and stay)
    const debriefRoot = debrief.getSceneObject()
    let leftOver = 0
    for (let i = 0; i < debriefRoot.getChildrenCount(); i++) {
      if (debriefRoot.getChild(i).name.indexOf("SceneClear") !== 0) {
        leftOver++
      }
    }
    expect(leftOver).toBe(0)
    expect(debriefRoot.getChildrenCount()).toBe(2)
    expect(countNamed("DebriefPanel")).toBe(0)
    expect(countNamed("DebriefMap")).toBe(0)
    expect(countNamed("NotReachedWorld_")).toBe(0)
    expect(countNamed("Marker_")).toBe(0)
    expect(countNamed("RestartButton")).toBe(0)
    expect(countNamed("TagBand_")).toBe(0)
    expect(countNamed("GroanSource")).toBe(1) // only the new run's
    expect(countNamed("Casualty_")).toBe(4)
    expect(oldWalkerObj === null || isNull(oldWalkerObj)).toBe(true) // the old figures are gone

    const second = tm.getRunState()
    expect(tm.isStarted()).toBe(true)
    expect(second.seedFixed).toBe(false) // a new random seed
    expect(second.seed === first.seed).toBe(false)
    expect(signature(second) === firstSig).toBe(false) // the cases / slots changed
    expect(clock.isRunning()).toBe(true)
    expect(clock.isEnded()).toBe(false)
    expect(clock.getDuration()).toBe(180)
    expect(clock.getRemaining()).toBeGreaterThan(170)
    expect(clock.isTimesUpVisible()).toBe(false)
    expect(cards.isLocked()).toBe(false)
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getTimerText().length > 0).toBe(true)
    expect(tm.scenarioUI.isVisible()).toBe(true) // the scenario line again
    for (const c of second.casualties) {
      const r = cards.getRecord(c.id)
      expect(r.tag === null).toBe(true)
      expect(r.checks.length).toBe(0)
      expect(r.presses).toBe(0)
      expect(r.extraChecks).toBe(0)
      expect(r.calledOut).toBe(false)
      expect(r.openSeconds).toBeLessThan(2)
      const obj = tm.getCasualtyObject(c.id) as SceneObject
      expect(hasDescendantNamed(obj, "TagBand_")).toBe(false)
      expect(cards.hasTagBand(c.id)).toBe(false)
      // everyone is where the new layout put them (the walker did not keep the old walker's place)
      const p = casualtyWorldPos(tm, c.id)
      expect(Math.abs(p.x - c.position.x)).toBeLessThan(0.5)
      expect(Math.abs(p.z - c.position.z)).toBeLessThan(0.5)
    }
    expect(callOut.getPhase()).toBe("idle")
    expect(callOut.isUsed()).toBe(false)
    expect(callOut.isButtonVisible()).toBe(true)
    expect(callOut.getWalkerId()).toBe(null)
    expect(cue.getBehindId()).toBe(second.behindId)
    expect(cue.getGroanPlayCount()).toBeLessThan(2) // a fresh groan counter
    const gs = cue.getGroanSource() as SceneObject
    expect(gs === null).toBe(false)
    expect(gs.getParent().name).toBe("Casualty_" + second.behindId)
    await sleep(2200)
    expect(cue.isArrowVisible()).toBe(true) // the arrow works again for the new behind casualty
    expect(cue.getGroanPlayCount()).toBeGreaterThan(0)

    // ---- the new run plays: call out and tag in it
    expect(callOut.pressCallOut()).toBe(true)
    expect(cards.getRecord(second.walkerId).calledOut).toBe(true)

    // ---- two different seeds give different layouts; the same seed repeats
    const s21 = tm.restart(21, "off")
    const k21 = layoutKey(s21)
    const s22 = tm.restart(22, "off")
    expect(layoutKey(s22) === k21).toBe(false)
    expect(layoutKey(tm.restart(21, "off"))).toBe(k21)
    expect(s21.seedFixed).toBe(true)
    // restarting with no fixed seed never repeats the cases / slots of the run before
    let prev = signature(tm.restart())
    for (let i = 0; i < 6; i++) {
      const st = tm.restart()
      expect(signature(st) === prev).toBe(false)
      expect(st.seedFixed).toBe(false)
      expect(st.violations.length).toBe(0)
      prev = signature(st)
    }

    // ---- the named demo seed gives the documented layout
    this.expectDemoLayout(tm.restart(DEMO_SEED, "on"))
    tm.useDemoSeed = true
    expect(tm.configuredSeed()).toBe(DEMO_SEED)
    this.expectDemoLayout(tm.restart()) // "Use demo seed" setting: same layout on every restart
    this.expectDemoLayout(tm.restart())
    tm.useDemoSeed = false

    cleanup3(tm, cards)
  }

  /** Documented in devpost/build-log.md: D behind, C at the wall, X front-left, W1 (the walker) front-right; Black on. */
  private expectDemoLayout(state: {
    seed: number
    seedFixed: boolean
    blackIncluded: boolean
    walkerId: string
    behindId: string
    casualties: {id: string; slot: string; floorPosition: {x: number; z: number}}[]
  }): void {
    expect(state.seed).toBe(DEMO_SEED)
    expect(state.seedFixed).toBe(true)
    expect(state.blackIncluded).toBe(true)
    expect(state.walkerId).toBe("W1")
    expect(state.behindId).toBe("D")
    const bySlot: {[slot: string]: {id: string; x: number; z: number}} = {}
    for (const c of state.casualties) {
      bySlot[c.slot] = {id: c.id, x: c.floorPosition.x, z: c.floorPosition.z}
    }
    expect(bySlot.behind.id).toBe("D")
    expect(bySlot.wall.id).toBe("C")
    expect(bySlot.frontLeft.id).toBe("X")
    expect(bySlot.frontRight.id).toBe("W1")
    expect(Math.abs(bySlot.behind.x - 46)).toBeLessThan(1)
    expect(Math.abs(bySlot.behind.z - 213.5)).toBeLessThan(1)
    expect(Math.abs(bySlot.wall.z + 380)).toBeLessThan(1)
    expect(Math.abs(bySlot.frontLeft.x + 95.4)).toBeLessThan(1)
    expect(Math.abs(bySlot.frontLeft.z + 237.6)).toBeLessThan(1)
    expect(Math.abs(bySlot.frontRight.x - 95.6)).toBeLessThan(1)
    expect(Math.abs(bySlot.frontRight.z + 248.7)).toBeLessThan(1)
  }
}
