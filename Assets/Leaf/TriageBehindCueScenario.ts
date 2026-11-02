/**
 * Scenario 13 - done criterion 1, second half (build step 3): the groan and the arrow for the casualty behind.
 *  - the groan source (a spatial AudioComponent) is on the casualty behind the start position;
 *  - it plays (and repeats) while that casualty is out of view, and not while they are in view;
 *  - the arrow is shown at the edge of the view while they are out of view, and hidden once they are in view;
 *  - once that casualty is tagged, neither the arrow nor the groan comes back.
 * The viewer's position and look direction are test stand-ins (setViewerOverride): LEAF cannot move the preview camera.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep, findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, getCue, getClock, startRunFar, cleanup3, FAR_VIEWER, casualtyWorldPos} from "./TriageLeafHelpers"

function isDescendantOf(so: SceneObject, ancestorName: string): boolean {
  let p: SceneObject | null = so.hasParent() ? so.getParent() : null
  while (p) {
    if (p.name === ancestorName) return true
    p = p.hasParent() ? p.getParent() : null
  }
  return false
}

@component
export class TriageBehindCueScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const cue = getCue()
    const clock = getClock()

    // defaults the design asks for: a groan every few seconds
    expect(cue.groanIntervalSeconds).toBe(5)
    // shorten the waits for the test only
    cue.groanIntervalSeconds = 1.5
    cue.firstGroanDelaySeconds = 0.5

    const ahead = new vec3(0, 0, -1)
    cue.setViewerOverride(FAR_VIEWER, ahead)
    const state = await startRunFar(tm, cards, 11, "off")
    const behindId = state.behindId
    expect(cue.getBehindId()).toBe(behindId)

    // ---- the groan source sits on the casualty behind (and not on anyone else)
    const src = cue.getGroanSource()
    expect(src === null).toBe(false)
    expect(isDescendantOf(src as SceneObject, "Casualty_" + behindId)).toBe(true)
    for (const c of state.casualties) {
      if (c.id !== behindId) {
        expect(isDescendantOf(src as SceneObject, "Casualty_" + c.id)).toBe(false)
      }
    }
    const behindPos = casualtyWorldPos(tm, behindId)
    expect(behindPos.z).toBeGreaterThan(100) // really behind the start position (+z)
    expect((src as SceneObject).getTransform().getWorldPosition().sub(behindPos).length).toBeLessThan(40)
    const audio = (src as SceneObject).getComponent("Component.AudioComponent") as AudioComponent
    expect(audio.audioTrack === null).toBe(false)
    expect(audio.spatialAudio.enabled).toBe(true)

    // ---- looking ahead: behind is out of view -> arrow shown, groan repeating
    await sleep(2800)
    expect(clock.isRunning()).toBe(true)
    expect(cue.isBehindInView()).toBe(false)
    expect(cue.isArrowVisible()).toBe(true)
    expect(cue.getGroanPlayCount()).toBeGreaterThan(1) // first groan, then it repeats

    // the arrow sits at the edge of the view: inside it, towards the side, in front of the eyes
    const arrow = findSceneObjectByName("BehindArrow") as SceneObject
    const ap = arrow.getTransform().getWorldPosition().sub(FAR_VIEWER)
    expect(ap.z).toBeLessThan(-20) // in front of the viewer
    const camObj = findSceneObjectByName("Camera Object") as SceneObject
    const cam = camObj.getComponent("Component.Camera") as Camera
    const halfH = Math.atan(Math.tan(cam.fov / 2) * cam.aspect)
    const ang = Math.atan2(Math.abs(ap.x), -ap.z)
    expect(ang).toBeGreaterThan(halfH * 0.6)
    expect(ang).toBeLessThan(halfH * 1.0)
    if (Math.abs(behindPos.x) > 30) {
      expect(cue.getArrowSide()).toBe(behindPos.x > 0 ? 1 : -1)
    }

    // ---- turn round so the casualty is in view: arrow gone, groan stops
    const toBehind = behindPos.sub(FAR_VIEWER)
    cue.setViewerOverride(FAR_VIEWER, toBehind)
    await sleep(500)
    expect(cue.isBehindInView()).toBe(true)
    expect(cue.isArrowVisible()).toBe(false)
    const playsWhenSeen = cue.getGroanPlayCount()
    await sleep(3500)
    expect(cue.getGroanPlayCount()).toBe(playsWhenSeen)
    expect(cue.isArrowVisible()).toBe(false)

    // ---- turn away again: out of view, the arrow comes back and the groan resumes
    cue.setViewerOverride(FAR_VIEWER, ahead)
    await sleep(2500)
    expect(cue.isBehindInView()).toBe(false)
    expect(cue.isArrowVisible()).toBe(true)
    expect(cue.getGroanPlayCount()).toBeGreaterThan(playsWhenSeen)

    // ---- tag the casualty behind: no arrow and no groan any more
    cards.openCard(behindId, "button")
    for (const check of ["breathing", "rate", "pulse", "commands"] as const) {
      if (cards.isTagPanelVisible()) break
      cards.pressCheck(check)
    }
    expect(cards.isTagPanelVisible()).toBe(true)
    expect(cards.chooseTag("Red")).toBe(true)
    await sleep(300)
    const playsWhenTagged = cue.getGroanPlayCount()
    await sleep(3500)
    expect(cue.getGroanPlayCount()).toBe(playsWhenTagged)
    expect(cue.isArrowVisible()).toBe(false)

    cue.groanIntervalSeconds = 5
    cue.firstGroanDelaySeconds = 1.5
    cleanup3(tm, cards)
  }
}
