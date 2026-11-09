/**
 * Scenario - "Handover": when a run ends, the ambulance crew asks "How many need to go first (Red)?" before the debrief.
 *  askHandover is ON here (the shared helper turns it off for every other scenario).
 *  For each end reason (scene-clear, all-tagged, time): the question appears BEFORE the debrief (the debrief stays shut while it
 *   is open), it has five buttons labelled 0..4, sits inside the view limits, and shows no number other than the button
 *   labels; at time's up the Time's up panel has stepped aside first. Pinching a number opens the debrief.
 *  A Drill run where a Red casualty (A) is not reached: the result line on the tip plate shows the right count, the missed
 *   person included, and the plate holds the line and the tip, behind them and in view.
 *  With askHandover off the debrief opens directly (no question, no result line).
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
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {VIEW_HALF_H_DEG, VIEW_HALF_V_DEG} from "./TriageLeafDebriefChecks"
import {CASUALTY_TABLE} from "../Scripts/TriageData"
import {handoverLine, HANDOVER_LINE_1, HANDOVER_LINE_2} from "../Scripts/TriageHandoverText"

async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  for (let t = 0; t < ms; t += 50) {
    if (cond()) {
      return true
    }
    await sleep(50)
  }
  return cond()
}

function deg(rad: number): number {
  return (rad * 180) / Math.PI
}

@component
export class TriageHandoverScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const cue = getCue()
    const clock = getClock()
    const callOut = getCallOut()
    const debrief = getDebrief()
    const S = debrief.getSceneClear()!
    const H = debrief.getHandover()!
    const up = new vec3(0, 1, 0) // the cue and Scene clear look at the ceiling: nobody is in view
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.setHandoverLook(new vec3(0, 0, -1)) // the question appears in front of a viewer looking ahead
    debrief.timesUpSeconds = 1
    debrief.endGraceSeconds = 0.3
    S.setViewerOverride(FAR_VIEWER, up)
    cue.setViewerOverride(FAR_VIEWER, up)
    debrief.askHandover = true

    /** The question is on show, the debrief is not; five buttons, labels 0..4 only, inside the view. */
    const assertQuestion = async (): Promise<void> => {
      expect(await waitFor(() => H.isOpen(), 8000)).toBe(true)
      expect(debrief.isHandoverPending()).toBe(true)
      expect(debrief.isOpen()).toBe(false)
      expect(clock.isTimesUpVisible()).toBe(false)
      await sleep(900)
      expect(debrief.isOpen()).toBe(false) // it waits for an answer
      for (const name of H.getButtonNames()) {
        expect(!!findInteractableByName(name)).toBe(true)
      }
      expect(H.getButtonNames().length).toBe(5)
      const texts = H.getQuestionTexts()
      expect(texts.length).toBe(7)
      expect(texts[0]).toBe(HANDOVER_LINE_1)
      expect(texts[1]).toBe(HANDOVER_LINE_2)
      for (let i = 0; i < 2; i++) {
        expect(/[0-9]/.test(texts[i])).toBe(false) // no number but the button labels
      }
      for (let n = 0; n < 5; n++) {
        expect(texts[2 + n]).toBe(String(n))
      }
      const q = H.getQuestionObject() as SceneObject
      const size = H.getSize()
      const m = q.getTransform().getWorldTransform()
      let worstH = 0
      let worstV = 0
      for (const sx of [-0.5, 0.5]) {
        for (const sy of [-0.5, 0.5]) {
          const p = m.multiplyPoint(new vec3(sx * size.w, sy * size.h, 0))
          expect(p.z).toBeLessThan(-30)
          worstH = Math.max(worstH, deg(Math.atan2(Math.abs(p.x), -p.z)))
          worstV = Math.max(worstV, deg(Math.atan2(Math.abs(p.y), -p.z)))
        }
      }
      print("HANDOVER question view worst h " + worstH.toFixed(2) + " v " + worstV.toFixed(2) + ", " + size.w.toFixed(1) + " x " + size.h.toFixed(1) + " cm")
      expect(worstH).toBeLessThan(VIEW_HALF_H_DEG)
      expect(worstV).toBeLessThan(VIEW_HALF_V_DEG)
    }

    const redInRun = (ids: string[]): number => ids.filter((id) => CASUALTY_TABLE[id].correctTag === "Red").length

    // ================= 1. scene-clear, Drill, a Red casualty (A) not reached =================
    const seed = findSeedWith("A", "off")
    const state1 = await startRunFar(tm, cards, seed, "off")
    expect(tm.getMode()).toBe("drill")
    const ids1 = state1.casualties.map((c) => c.id)
    const tagId = ids1.filter((id) => id !== state1.walkerId && id !== "A")[0]
    expect(await tagWithChecks(cards, tagId, CASUALTY_TABLE[tagId].correctTag as "Red")).toBe(true)
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    await assertQuestion()
    expect(clock.getEndReason()).toBe("scene-clear")
    const red1 = redInRun(ids1)
    expect(red1).toBeGreaterThan(0)
    expect(cards.getRecords().filter((r) => r.id === "A")[0].tag === null).toBe(true) // the Red casualty was never reached
    await pressButton("HandoverButton_1")
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(H.isOpen()).toBe(false)
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    await sleep(500)
    expect(debrief.getHandoverLine()).toBe(handoverLine(1, red1))
    print("HANDOVER line: " + debrief.getHandoverLine())

    // ---- the plate: holds the result line above the tip, behind them, inside the view
    const plate = debrief.getTipPlateObject() as SceneObject
    expect(plate === null).toBe(false)
    const lineObj = debrief.getHandoverLineObject() as SceneObject
    const tipObj = debrief.getTipObject() as SceneObject
    expect(lineObj === null).toBe(false)
    expect(tipObj === null).toBe(false)
    const lineText = lineObj.getComponent("Component.Text") as Text
    expect(lineText.text).toBe(handoverLine(1, red1))
    expect(lineObj.getTransform().getWorldPosition().y).toBeGreaterThan(tipObj.getTransform().getWorldPosition().y) // second line, above the tip
    const ps = debrief.getTipPlateSize()
    const inv = plate.getTransform().getInvertedWorldTransform()
    const worldCorners: vec3[] = []
    for (const obj of [lineObj, tipObj]) {
      const t = obj.getComponent("Component.Text") as Text
      const b = t.getBoundingBox()
      const tm2 = obj.getTransform().getWorldTransform()
      for (const x of [b.left, b.right]) {
        for (const y of [b.top, b.bottom]) {
          const w = tm2.multiplyPoint(new vec3(x, y, 0))
          worldCorners.push(w)
          const l = inv.multiplyPoint(w)
          expect(Math.abs(l.x)).toBeLessThan(ps.w / 2) // inside the plate
          expect(Math.abs(l.y)).toBeLessThan(ps.h / 2)
          expect(l.z).toBeGreaterThan(0.2) // the plate is behind the text
        }
      }
    }
    const pm = plate.getTransform().getWorldTransform()
    const plateCorners: vec3[] = []
    for (const sx of [-0.5, 0.5]) {
      for (const sy of [-0.5, 0.5]) {
        plateCorners.push(pm.multiplyPoint(new vec3(sx * ps.w, sy * ps.h, 0)))
      }
    }
    const pc = plate.getTransform().getWorldPosition()
    const look = pc.add(new vec3(0, -3, 0)).sub(FAR_VIEWER).normalize() // looking a little below the plate, towards the buttons
    const right = look.cross(new vec3(0, 1, 0)).normalize()
    const upv = right.cross(look).normalize()
    let wH = 0
    let wV = 0
    for (const p of plateCorners.concat(worldCorners)) {
      const d = p.sub(FAR_VIEWER)
      const z = d.dot(look)
      wH = Math.max(wH, Math.abs(deg(Math.atan2(d.dot(right), z))))
      wV = Math.max(wV, Math.abs(deg(Math.atan2(d.dot(upv), z))))
    }
    print("HANDOVER plate " + ps.w.toFixed(1) + " x " + ps.h.toFixed(1) + " cm, view worst h " + wH.toFixed(2) + " v " + wV.toFixed(2))
    expect(wH).toBeLessThan(VIEW_HALF_H_DEG)
    expect(wV).toBeLessThan(VIEW_HALF_V_DEG)
    // the scoring and tip are unchanged by the question: A not reached is wrong, the tip is rule 1
    expect(debrief.getSummary()!.correct).toBeLessThan(4)
    expect(debrief.getTipText()).toBe("Next run: look all the way round before your first check")

    // ================= 2. all-tagged =================
    const state2 = await startRunFar(tm, cards, findSeedWith("A", "off"), "off")
    const non2 = state2.casualties.map((c) => c.id).filter((id) => id !== state2.walkerId)
    for (const id of non2) {
      expect(await tagWithChecks(cards, id, CASUALTY_TABLE[id].correctTag as "Red")).toBe(true)
    }
    expect(callOut.pressCallOut()).toBe(true)
    await assertQuestion()
    expect(clock.getEndReason()).toBe("all-tagged")
    const red2 = redInRun(state2.casualties.map((c) => c.id))
    await pressButton("HandoverButton_" + Math.min(4, red2)) // the right answer this time
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    expect(debrief.getHandoverLine()).toBe(handoverLine(red2, red2))
    expect(debrief.getSummary()!.correct).toBe(4)

    // ================= 3. time's up =================
    await startRunFar(tm, cards, findSeedWith("X", "on"), "on")
    clock.debugAdvance(clock.getRemaining() + 1)
    expect(clock.getEndReason()).toBe("time")
    expect(clock.isTimesUpVisible()).toBe(true) // the Time's up panel comes first
    expect(debrief.isOpen()).toBe(false)
    expect(H.isOpen()).toBe(false)
    await assertQuestion() // ... and has stepped aside before the question
    expect(clock.getEndReason()).toBe("time")
    await pressButton("HandoverButton_0")
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    expect(debrief.getHandoverLine().indexOf("Handover: you said 0 ") === 0).toBe(true)

    // ================= 4. switched off: the debrief opens directly =================
    debrief.askHandover = false
    const state4 = await startRunFar(tm, cards, findSeedWith("A", "off"), "off")
    const tag4 = state4.casualties.map((c) => c.id).filter((id) => id !== state4.walkerId)[0]
    expect(await tagWithChecks(cards, tag4, CASUALTY_TABLE[tag4].correctTag as "Red")).toBe(true)
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(H.isOpen()).toBe(false)
    expect(debrief.isHandoverPending()).toBe(false)
    expect(debrief.getHandoverLine()).toBe("")
    expect(debrief.getHandoverLineObject() === null).toBe(true)
    expect(debrief.getTipPlateObject() === null).toBe(false) // the plate still backs the tip alone

    debrief.setHandoverLook(null)
    S.setViewerOverride(null)
    cue.setViewerOverride(FAR_VIEWER, up)
    cleanup3(tm, cards)
  }
}
