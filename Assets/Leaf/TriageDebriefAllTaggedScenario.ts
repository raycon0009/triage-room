/**
 * Scenario 14 - done criterion 5, "everyone tagged" end (updated for the build step 5 panel):
 *  - tagging the last casualty (here the called-out walker, who must have ARRIVED first) ends the run with reason
 *    "all-tagged" and opens the debrief;
 *  - ONE upright panel about 1.2 m in front, slightly below eye level, fully inside the view from the start position,
 *    with large text; rows numbered 1-4 and the same numbers on the floor map's markers; no leader lines;
 *  - each row shows my tag against the correct tag (words + colours), time and extra checks; a wrong tag carries its
 *    one-line START explanation; the walker row says call-out and "reassessed later";
 *  - the summary counts are right for this scripted run (one wrong tag with one extra check);
 *  - the floor map lies flat about 1.2 m in front, casualties at their real positions (scaled);
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
import {assertPanelReadableAndInView} from "./TriageLeafDebriefChecks"
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
    await sleep(400)

    // ---- the entries: nobody missed, so the rows keep their order, numbered 1-4
    const entries = debrief.getEntries()
    expect(entries.length).toBe(4)
    for (const e of entries) {
      const rec = cards.getRecord(e.id)
      expect(e.myTag).toBe(rec.tag)
      expect(e.correctTag).toBe(CASUALTY_TABLE[e.id].correctTag)
      expect(e.extraChecks).toBe(rec.extraChecks)
      expect(e.notReached).toBe(false)
      const t = debrief.getRowTexts(e.id)
      expect(t.name).toBe(e.shortName)
      expect(t.stats).toBe(e.statsText)
      expect(t.youWord).toBe(e.myWord)
      expect(t.correctWord).toBe(e.correctWord)
      expect(t.youLabel).toBe("You")
      expect(t.correctLabel).toBe("Correct")
      expect(t.notReached === undefined).toBe(true)
      if (e.id === walkerId) {
        expect(e.status).toBe("correct")
        expect(e.calledOut).toBe(true)
        expect(e.statsText.indexOf("call-out ") === 0).toBe(true)
        expect(e.timeSeconds).toBeGreaterThan(0.3)
        expect(e.extraChecks).toBe(0)
        expect(t.explanation).toBe("Can walk → Green (reassessed later)")
      } else {
        expect(e.timeSeconds).toBeGreaterThan(0.2)
        expect(e.statsText).toBe(Math.round(e.timeSeconds) + " s · " + e.extraChecks + " extra")
      }
    }
    const a = entries.filter((e) => e.id === "A")[0]
    expect(a.status).toBe("wrong")
    expect(a.myWord).toBe("YELLOW")
    expect(a.correctWord).toBe("RED")
    expect(a.extraChecks).toBe(1)
    expect(a.explanation).toBe("Rate 34 is over 30 → Red")
    const ta = debrief.getRowTexts("A")
    expect(ta.youWord).toBe("YELLOW")
    expect(ta.correctWord).toBe("RED")
    expect(ta.stats.indexOf(" · 1 extra") > 0).toBe(true)
    expect(ta.explanation).toBe("Rate 34 is over 30 → Red")
    // tag words keep their colour, everything else is white
    const yc = debrief.getRowTextColour("A", "youWord") as vec4
    const rc = debrief.getRowTextColour("A", "correctWord") as vec4
    expect(yc.r).toBeGreaterThan(0.9)
    expect(yc.g).toBeGreaterThan(0.8) // yellow
    expect(yc.b).toBeLessThan(0.5)
    expect(rc.r).toBeGreaterThan(0.9)
    expect(rc.g).toBeLessThan(0.6) // red
    expect(rc.b).toBeLessThan(0.6)
    for (const name of ["name", "stats", "youLabel", "correctLabel", "explanation", "number"]) {
      const c = debrief.getRowTextColour("A", name) as vec4
      expect(c.r > 0.95 && c.g > 0.95 && c.b > 0.95).toBe(true)
    }
    for (const e of entries) {
      if (e.id !== "A" && e.id !== walkerId) {
        expect(e.status).toBe("correct")
        expect(e.extraChecks).toBe(0)
      }
    }

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
    expect(debrief.getSummaryLines()[0]).toBe("3 of 4 correct · 0 missed")
    expect(debrief.getSummaryLines()[1].indexOf("1 extra check · ") === 0).toBe(true)
    const sc = debrief.getSummaryLines().length
    expect(sc).toBe(2)

    // ---- the panel: one, readable, fully in view; numbers on the markers; Restart at waist height
    assertPanelReadableAndInView(debrief, tm, false)

    // ---- the floor map: flat, about 1.2 m in front, casualties at their real positions (scaled), start marked
    const map = debrief.getMapObject() as SceneObject
    expect(map === null).toBe(false)
    const floorY = tm.sceneObject.getTransform().getWorldPosition().y
    const mp = map.getTransform().getWorldPosition()
    expect(Math.abs(mp.x)).toBeLessThan(5)
    expect(mp.z).toBeLessThan(-105)
    expect(mp.z).toBeGreaterThan(-135)
    expect(mp.y - floorY).toBeGreaterThan(-0.5)
    expect(mp.y - floorY).toBeLessThan(3)
    const up = map.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 1, 0))
    expect(up.y).toBeGreaterThan(0.999)
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
