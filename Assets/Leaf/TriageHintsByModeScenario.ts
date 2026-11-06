/**
 * Scenario 22 - fewer hints in Drill (real-miss change 2).
 *  Drill: no arrow at any time; the groan plays once about 1.5 s after Start and never repeats; the caption
 *         "A groan, somewhere behind you" shows when it plays, in light text, inside the view, and fades after about 4 s.
 *  Learn: the groan repeats and the caption shows each time; the arrow shows until the casualty behind is first seen,
 *         then never again (even after turning away); the caption never covers an open card.
 * The viewer's position and look direction are test stand-ins (setViewerOverride).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep, findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, getCue, getClock, startRunFar, cleanup3, FAR_VIEWER, casualtyWorldPos} from "./TriageLeafHelpers"
import {GROAN_CAPTION} from "../Scripts/TriageBehindCue"

async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  for (let t = 0; t < ms; t += 50) {
    if (cond()) {
      return true
    }
    await sleep(50)
  }
  return cond()
}

@component
export class TriageHintsByModeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const cue = getCue()
    const clock = getClock()
    const ahead = new vec3(0, 0, -1)
    const camObj = findSceneObjectByName("Camera Object") as SceneObject
    const cam = camObj.getComponent("Component.Camera") as Camera
    const tanV = Math.tan(cam.fov / 2)
    cue.setViewerOverride(FAR_VIEWER, ahead)
    expect(cue.firstGroanDelaySeconds).toBe(1.5)
    expect(cue.groanIntervalSeconds).toBe(5)

    // ================= Drill =================
    const state = await startRunFar(tm, cards, 11, "off", "drill")
    expect(tm.getMode()).toBe("drill")
    expect(clock.isRunning()).toBe(true)
    const startedAt = Date.now()
    expect(cue.getGroanPlayCount()).toBe(0)
    expect(cue.isCaptionVisible()).toBe(false)
    let arrowEver = false
    let t0 = 0
    for (let i = 0; i < 160; i++) {
      arrowEver = arrowEver || cue.isArrowVisible()
      if (cue.getGroanPlayCount() >= 1 && t0 === 0) {
        t0 = Date.now()
        break
      }
      await sleep(50)
    }
    expect(t0 > 0).toBe(true)
    const delay = (t0 - startedAt + 400) / 1000 // startRunFar already waited 0.4 s
    expect(delay).toBeGreaterThan(1.2)
    expect(delay).toBeLessThan(2.1) // about 1.5 s after Start
    expect(cue.getGroanPlayCount()).toBe(1)
    expect(cue.isBehindInView()).toBe(false)
    await sleep(300)
    expect(cue.isCaptionVisible()).toBe(true)
    expect(cue.getCaptionText()).toBe(GROAN_CAPTION)
    expect(GROAN_CAPTION).toBe("A groan, somewhere behind you")
    // light text, and inside the view with a margin
    const capTxt = (cue.getCaptionObject() as SceneObject).getComponent("Component.Text") as Text
    expect(capTxt.textFill.color.r).toBeGreaterThan(0.9)
    expect(capTxt.textFill.color.g).toBeGreaterThan(0.9)
    expect(capTxt.textFill.color.b).toBeGreaterThan(0.9)
    const r = cue.getCaptionRect()
    expect(Math.abs(r.y) + r.h / 2).toBeLessThan(r.distance * tanV)
    expect(Math.abs(r.x) + r.w / 2).toBeLessThan(r.distance * tanV * cam.aspect)
    // about 4 s on screen, then gone
    await sleep(2400)
    expect(cue.isCaptionVisible()).toBe(true) // ~2.7 s after the groan
    for (let i = 0; i < 40; i++) {
      arrowEver = arrowEver || cue.isArrowVisible()
      await sleep(100)
    }
    expect(Date.now() - t0).toBeGreaterThan(5000)
    expect(cue.isCaptionVisible()).toBe(false) // gone well after ~4 s
    // and no repeat, even though the casualty is still out of view well past the old 5 s interval
    await sleep(3000)
    expect(cue.getGroanPlayCount()).toBe(1)
    expect(cue.isBehindInView()).toBe(false)
    expect(arrowEver).toBe(false) // Drill never shows the arrow
    expect(cue.isArrowVisible()).toBe(false)
    // turning away and back changes nothing in Drill
    const behindPos = casualtyWorldPos(tm, state.behindId)
    cue.setViewerOverride(FAR_VIEWER, behindPos.sub(FAR_VIEWER))
    await sleep(400)
    cue.setViewerOverride(FAR_VIEWER, ahead)
    await sleep(2500)
    expect(cue.getGroanPlayCount()).toBe(1)
    expect(cue.isArrowVisible()).toBe(false)

    // ================= Learn =================
    cleanup3(tm, cards)
    cue.setViewerOverride(FAR_VIEWER, ahead)
    cue.groanIntervalSeconds = 1.5
    cue.firstGroanDelaySeconds = 0.5
    const lstate = await startRunFar(tm, cards, 11, "off", "learn")
    expect(tm.getMode()).toBe("learn")
    expect(await waitFor(() => cue.getGroanPlayCount() >= 1, 3000)).toBe(true)
    await sleep(300)
    expect(cue.isArrowVisible()).toBe(true) // not seen yet
    expect(cue.hasSeenBehind()).toBe(false)
    expect(cue.isCaptionVisible()).toBe(true)
    expect(cue.getCaptionText()).toBe(GROAN_CAPTION)
    // the groan repeats and the caption shows each time (it is up again right after a repeat)
    const plays1 = cue.getGroanPlayCount()
    expect(await waitFor(() => cue.getGroanPlayCount() > plays1, 3000)).toBe(true)
    await sleep(300)
    expect(cue.isCaptionVisible()).toBe(true)
    expect(cue.getCaptionAlpha()).toBeGreaterThan(0.5)

    // the caption never covers an open card: sample while a card is open over the next groans
    const other = lstate.casualties.map((c) => c.id).filter((id) => id !== lstate.behindId && id !== lstate.walkerId)[0]
    cards.openCard(other, "button")
    await sleep(500)
    let sampled = 0
    for (let i = 0; i < 50; i++) {
      const ext = cards.getCardExtent()
      expect(ext === null).toBe(false)
      if (cue.isCaptionVisible() && ext) {
        const rel = ext.pos.sub(FAR_VIEWER)
        const s = r.distance / -rel.z // card looks along -z here
        const cx = rel.x * s
        const cy = rel.y * s
        const cr = cue.getCaptionRect()
        const overX = Math.abs(cr.x - cx) < ext.halfWidth * s + cr.w / 2
        const overY = cr.y - cr.h / 2 < cy + ext.top * s && cr.y + cr.h / 2 > cy - ext.bottom * s
        expect(overX && overY).toBe(false)
        const inside = Math.abs(cr.y) + cr.h / 2 < cr.distance * tanV
        expect(inside).toBe(true)
        sampled++
      }
      await sleep(100)
    }
    cards.closeCard()
    await sleep(300)

    // the arrow stops for good once the casualty behind has been in view
    const lbehind = casualtyWorldPos(tm, lstate.behindId)
    cue.setViewerOverride(FAR_VIEWER, lbehind.sub(FAR_VIEWER))
    await sleep(600)
    expect(cue.isBehindInView()).toBe(true)
    expect(cue.hasSeenBehind()).toBe(true)
    expect(cue.isArrowVisible()).toBe(false)
    cue.setViewerOverride(FAR_VIEWER, ahead)
    const playsAway = cue.getGroanPlayCount()
    await sleep(3000)
    expect(cue.isBehindInView()).toBe(false)
    expect(cue.isArrowVisible()).toBe(false) // gone for good
    expect(cue.getGroanPlayCount()).toBeGreaterThan(playsAway) // the groan is not part of that
    print("HINTS_CAPTION_SAMPLES_WITH_CARD " + sampled)

    cue.groanIntervalSeconds = 5
    cue.firstGroanDelaySeconds = 1.5
    cleanup3(tm, cards)
  }
}
