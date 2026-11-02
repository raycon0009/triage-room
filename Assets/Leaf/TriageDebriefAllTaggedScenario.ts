/**
 * Scenario 14 - done criterion 5 (build step 4), "everyone tagged" end:
 *  - tagging the last casualty (here the called-out walker, who must have ARRIVED first) ends the run with reason
 *    "all-tagged" and opens the debrief;
 *  - the map lies flat on the floor about 1.2 m in front of the start position, each casualty at their real position
 *    (scaled down), the start position marked;
 *  - every casualty has an upright label above the map facing the viewer: my tag vs the correct tag (words + colours),
 *    time spent and extra checks; a wrong tag carries its one-line START explanation;
 *  - the summary counts are right for this scripted run (one wrong tag with one extra check);
 *  - the timer, arrow, groan, open card and call-out button are gone.
 * The viewer's position is a test stand-in (setViewerOverride).
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
  cleanup3,
  findSeedWith,
  casualtyWorldPos,
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {CASUALTY_TABLE} from "../Scripts/TriageData"

function findByName(root: SceneObject, name: string): SceneObject | null {
  if (root.name === name) {
    return root
  }
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const r = findByName(root.getChild(i), name)
    if (r) {
      return r
    }
  }
  return null
}

@component
export class TriageDebriefAllTaggedScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const clock = getClock()
    const callOut = getCallOut()
    const cue = getCue()
    const debrief = getDebrief()
    debrief.endGraceSeconds = 0.3
    debrief.setViewerOverride(FAR_VIEWER)

    const state = await startRunFar(tm, cards, findSeedWith("A", "off"), "off")
    const walkerId = state.walkerId
    expect(debrief.isOpen()).toBe(false)

    // ---- tag the three non-walkers: A wrongly (Yellow, with one extra check), the others correctly
    for (const c of state.casualties) {
      if (c.id === walkerId) {
        continue
      }
      if (c.id === "A") {
        expect(await tagWithChecks(cards, "A", "Yellow", "pulse")).toBe(true)
      } else {
        expect(await tagWithChecks(cards, c.id, CASUALTY_TABLE[c.id].correctTag as "Red")).toBe(true)
      }
    }
    await sleep(800)
    expect(debrief.isOpen()).toBe(false) // the walker is not tagged yet: not everyone is
    expect(clock.isEnded()).toBe(false)

    // ---- the last one: the walker answers the call-out. The debrief waits until they have arrived.
    expect(callOut.pressCallOut()).toBe(true)
    await sleep(500)
    expect(debrief.isOpen()).toBe(false)
    expect(callOut.getPhase() === "arrived").toBe(false)
    for (let i = 0; i < 150 && !debrief.isOpen(); i++) {
      await sleep(100)
    }
    expect(debrief.isOpen()).toBe(true)
    expect(callOut.getPhase()).toBe("arrived")
    expect(clock.isEnded()).toBe(true)
    expect(clock.getEndReason()).toBe("all-tagged")
    expect(debrief.getReason()).toBe("all-tagged")
    await sleep(300)

    // ---- each entry: my tag, correct tag, time, extra checks
    const entries = debrief.getEntries()
    expect(entries.length).toBe(4)
    for (const e of entries) {
      const rec = cards.getRecord(e.id)
      expect(e.myTag).toBe(rec.tag)
      expect(e.correctTag).toBe(CASUALTY_TABLE[e.id].correctTag)
      expect(e.extraChecks).toBe(rec.extraChecks)
      expect(e.notReached).toBe(false)
      if (e.id === walkerId) {
        expect(e.status).toBe("correct")
        expect(e.calledOut).toBe(true)
        expect(e.timeText.indexOf("called out at ") === 0).toBe(true)
        expect(e.timeSeconds).toBeGreaterThan(0.3)
        expect(e.extraChecks).toBe(0)
        expect(e.explanation.indexOf("reassesses walkers later") >= 0).toBe(true)
      } else {
        expect(e.timeSeconds).toBeGreaterThan(0.2)
        expect(e.timeText).toBe(Math.round(e.timeSeconds) + " s")
      }
    }
    const a = entries.filter((e) => e.id === "A")[0]
    expect(a.status).toBe("wrong")
    expect(a.myWord).toBe("YELLOW")
    expect(a.correctWord).toBe("RED")
    expect(a.extraChecks).toBe(1)
    expect(a.explanation).toBe("Rate 34 is over 30 → Red")
    for (const e of entries) {
      if (e.id !== "A" && e.id !== walkerId) {
        expect(e.status).toBe("correct")
        expect(e.extraChecks).toBe(0)
      }
    }

    // ---- what the labels show (A: wrong tag)
    const la = debrief.getLabelTexts("A")
    expect(la.youWord).toBe("YELLOW")
    expect(la.correctWord).toBe("RED")
    expect(la.stats.indexOf("Extra checks 1") >= 0).toBe(true)
    expect(la.explanation).toBe("Rate 34 is over 30 → Red")
    const yc = debrief.getLabelTextColour("A", "youWord") as vec4
    const rc = debrief.getLabelTextColour("A", "correctWord") as vec4
    expect(yc.r).toBeGreaterThan(0.9)
    expect(yc.g).toBeGreaterThan(0.8) // yellow
    expect(yc.b).toBeLessThan(0.5)
    expect(rc.r).toBeGreaterThan(0.9)
    expect(rc.g).toBeLessThan(0.6) // red
    expect(rc.b).toBeLessThan(0.6)

    // ---- summary: 3 correct, 1 wrong, 0 missed, 1 extra check
    const s = debrief.getSummary()
    expect(s === null).toBe(false)
    expect(s!.total).toBe(4)
    expect(s!.correct).toBe(3)
    expect(s!.wrong).toBe(1)
    expect(s!.missed).toBe(0)
    expect(s!.totalExtraChecks).toBe(1)
    expect(s!.timeUsedSeconds).toBeGreaterThan(1)
    expect(s!.text.indexOf("3 of 4 correct · 0 missed · 1 extra check · ") === 0).toBe(true)
    expect(debrief.getSummaryTextValue()).toBe(s!.text)

    // ---- the map: flat on the floor, about 1.2 m in front, casualties at their real positions (scaled), start marked
    const map = debrief.getMapObject() as SceneObject
    expect(map === null).toBe(false)
    const floorY = tm.sceneObject.getTransform().getWorldPosition().y
    const mp = map.getTransform().getWorldPosition()
    expect(Math.abs(mp.x)).toBeLessThan(5)
    expect(mp.z).toBeLessThan(-105)
    expect(mp.z).toBeGreaterThan(-135) // about 1.2 m in front of the start position (z = 0)
    expect(mp.y - floorY).toBeGreaterThan(-0.5)
    expect(mp.y - floorY).toBeLessThan(3) // on the floor
    const up = map.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 1, 0))
    expect(up.y).toBeGreaterThan(0.999) // lies flat (top-down)
    expect(findByName(map, "StartMarker") === null).toBe(false)
    const scale = 0.16
    const midZ = (-410 + 260) / 2
    for (const c of state.casualties) {
      const marker = debrief.getMarkerObject(c.id) as SceneObject
      expect(marker === null).toBe(false)
      const real = casualtyWorldPos(tm, c.id)
      const room = tm.sceneObject.getTransform().getWorldPosition()
      const mk = marker.getTransform().getWorldPosition()
      expect(Math.abs(mk.x - (mp.x + (real.x - room.x) * scale))).toBeLessThan(1)
      expect(Math.abs(mk.z - (mp.z + (real.z - room.z - midZ) * scale))).toBeLessThan(1)
    }
    const startM = (findByName(map, "StartMarker") as SceneObject).getTransform().getWorldPosition()
    expect(Math.abs(startM.x - mp.x)).toBeLessThan(1)
    expect(Math.abs(startM.z - (mp.z + (0 - midZ) * scale))).toBeLessThan(1)

    // ---- labels stand upright above the map and face the viewer
    for (const c of state.casualties) {
      const lab = debrief.getLabelObject(c.id) as SceneObject
      expect(lab === null).toBe(false)
      const lp = lab.getTransform().getWorldPosition()
      expect(lp.y - mp.y).toBeGreaterThan(20) // above the map
      const fwd = lab.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, 1))
      expect(Math.abs(fwd.y)).toBeLessThan(0.01) // upright: no tilt
      const toViewer = new vec3(FAR_VIEWER.x - lp.x, 0, FAR_VIEWER.z - lp.z).normalize()
      expect(fwd.dot(toViewer)).toBeGreaterThan(0.99) // facing the viewer
      expect(debrief.isNotReachedFlashing(c.id)).toBe(false)
    }

    // ---- everything else is off
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getTimerText()).toBe("")
    expect(cue.isArrowVisible()).toBe(false)
    expect(callOut.isButtonVisible()).toBe(false)
    const plays = cue.getGroanPlayCount()
    await sleep(1500)
    expect(cue.getGroanPlayCount()).toBe(plays)
    expect(cue.isGroanPlaying()).toBe(false)
    expect(clock.isTimesUpVisible()).toBe(false) // everyone tagged is not "Time's up"

    cleanup3(tm, cards)
  }
}
