/**
 * Scenario 27 - "Look-around ring": the debrief map shows which directions were in view before the first tag or call-out.
 *  Run 1 (Drill, a fixed seed): the viewer looks straight ahead, one front casualty is tagged, then Scene clear.
 *   - the ring exists on the map, flat, in the map's orientation (segment 0 ahead, segment 3 to the right);
 *   - the front segments are lit (filled), the segments towards the person behind are not (outline only, never dark);
 *   - the marker of the person behind sits by an unlit segment;
 *   - the ring clears every marker, the green zone and its label; the label text is "Lit: in view before you started".
 *  Restart: the ring was reset (looking backwards lights the back, not the front); then the viewer turns through a full
 *  circle before the first tag: all 12 segments are lit.
 * The viewer's position and look direction are test stand-ins (setViewerOverride).
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
  tagWithChecks,
  cleanup3,
  findSeedWith,
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {CASUALTY_TABLE} from "../Scripts/TriageData"
import {RING_LABEL, LookRingTracker, yawDegOf} from "../Scripts/TriageLookRing"

async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  for (let t = 0; t < ms; t += 50) {
    if (cond()) {
      return true
    }
    await sleep(50)
  }
  return cond()
}

function findChild(root: SceneObject, name: string): SceneObject | null {
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const c = root.getChild(i)
    if (c.name === name) {
      return c
    }
    const deeper = findChild(c, name)
    if (deeper) {
      return deeper
    }
  }
  return null
}

function litSegments(ring: SceneObject): boolean[] {
  const out: boolean[] = []
  for (let k = 0; k < 12; k++) {
    const seg = findChild(ring, "RingSeg_" + k)
    expect(seg === null).toBe(false)
    out.push(findChild(seg as SceneObject, "Fill") !== null)
  }
  return out
}

function partColour(so: SceneObject): vec4 {
  return (so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor
}

@component
export class TriageLookRingScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const cue = getCue()
    const clock = getClock()
    const debrief = getDebrief()
    const S = debrief.getSceneClear()!
    const ahead = new vec3(0, 0, -1)
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.timesUpSeconds = 1
    debrief.endGraceSeconds = 0.3
    S.setViewerOverride(FAR_VIEWER, ahead)

    // ================= Run 1: Drill, looking straight ahead, one tag, Scene clear =================
    cue.setViewerOverride(FAR_VIEWER, ahead)
    const seed = findSeedWith("A", "off")
    const state1 = await startRunFar(tm, cards, seed, "off")
    expect(tm.getMode()).toBe("drill")
    await sleep(700)
    const front = state1.casualties.filter((c) => !c.behind && c.id !== state1.walkerId).map((c) => c.id)
    expect(await tagWithChecks(cards, front[0], CASUALTY_TABLE[front[0]].correctTag as "Red")).toBe(true)
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    // looking round after the first tag does not light anything
    cue.setViewerOverride(FAR_VIEWER, new vec3(0, 0, 1))
    await sleep(500)
    cue.setViewerOverride(FAR_VIEWER, ahead)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)

    const map = debrief.getMapObject() as SceneObject
    const ring = debrief.getRingObject() as SceneObject
    expect(map === null).toBe(false)
    expect(ring === null).toBe(false)
    const lit = litSegments(ring)
    expect(lit.length).toBe(12)
    // flat and in the map's orientation: segment 0 is ahead (towards -Z), segment 3 is to the right (+X)
    const p0 = (findChild(ring, "RingSeg_0") as SceneObject).getTransform().getLocalPosition()
    const p3 = (findChild(ring, "RingSeg_3") as SceneObject).getTransform().getLocalPosition()
    const p6 = (findChild(ring, "RingSeg_6") as SceneObject).getTransform().getLocalPosition()
    expect(p0.z).toBeLessThan(-5)
    expect(Math.abs(p0.x)).toBeLessThan(0.1)
    expect(p3.x).toBeGreaterThan(5)
    expect(p6.z).toBeGreaterThan(5)
    expect(Math.abs(p0.y)).toBeLessThan(0.01)
    expect(map.getTransform().getWorldRotation().w).toBeGreaterThan(0.999) // the map lies flat, unrotated
    // front lit, back unlit
    expect(lit[0]).toBe(true)
    expect(lit[5] || lit[6] || lit[7]).toBe(false)
    expect(lit.filter((x) => x).length).toBeLessThan(6)
    expect(JSON.stringify(lit)).toBe(JSON.stringify(tm.getLookRing().litFlags()))
    // unlit segments: light outline only, never dark; lit ones are light too
    for (let k = 0; k < 12; k++) {
      const seg = findChild(ring, "RingSeg_" + k) as SceneObject
      const names = lit[k] ? ["Fill"] : ["OutlineIn", "OutlineOut", "OutlineL", "OutlineR"]
      for (const n of names) {
        const bar = findChild(seg, n)
        expect(bar === null).toBe(false)
        const c = partColour(bar as SceneObject)
        expect(Math.min(c.r, c.g, c.b)).toBeGreaterThan(0.6)
      }
    }
    // the person behind: their marker sits by an unlit segment
    const g = debrief.getRingGeometry()
    const behindMarker = findChild(map, "Marker_" + state1.behindId) as SceneObject
    const bp = behindMarker.getTransform().getLocalPosition()
    const seg = LookRingTracker.segmentOf(yawDegOf(bp.x - g.x, bp.z - g.z))
    expect(lit[seg]).toBe(false)
    // no overlap: ring against every marker, the green zone and the label
    const ringPos = ring.getTransform().getLocalPosition()
    expect(Math.abs(ringPos.z - g.z)).toBeLessThan(0.01)
    expect(g.outer).toBeGreaterThan(7.9)
    expect(g.outer).toBeLessThan(10.1)
    for (const c of state1.casualties) {
      const mk = findChild(map, "Marker_" + c.id) as SceneObject
      const mp = mk.getTransform().getLocalPosition()
      expect(Math.hypot(mp.x - g.x, mp.z - g.z)).toBeGreaterThan(g.outer + 4.4)
    }
    const zone = findChild(map, "MapMinorZone") as SceneObject
    const zp = zone.getTransform().getLocalPosition()
    const zoneR = (state1.minorZone.diameterCm * 0.16) / 2
    expect(Math.hypot(zp.x - g.x, zp.z - g.z)).toBeGreaterThan(g.outer + zoneR)
    // the label
    expect(debrief.getRingLabelText()).toBe(RING_LABEL)
    expect(RING_LABEL).toBe("Lit: in view before you started")
    const labelPos = (findChild(map, "RingLabel") as SceneObject).getTransform().getLocalPosition()
    expect(labelPos.x).toBeGreaterThan(g.outer) // beside the ring, not on it
    for (const c of state1.casualties) {
      const mp = (findChild(map, "Marker_" + c.id) as SceneObject).getTransform().getLocalPosition()
      const insideX = mp.x > labelPos.x - 4.4 && mp.x < labelPos.x + 24 + 4.4
      const insideZ = Math.abs(mp.z - labelPos.z) < 4 + 4.4
      expect(insideX && insideZ).toBe(false)
    }
    const startLabelPos = (findChild(map, "StartLabel") as SceneObject).getTransform().getLocalPosition()
    expect(labelPos.x).toBeGreaterThan(startLabelPos.x) // to the side of the start label, not over it
    expect(startLabelPos.y).toBeGreaterThan(15) // the start label floats clear above the ring (seen from the standing viewpoint the ring does not run behind it)

    // ================= Restart: reset, then a full turn before the first tag =================
    cue.setViewerOverride(FAR_VIEWER, new vec3(0, 0, 1)) // looking backwards
    debrief.pressRestart()
    expect(await waitFor(() => clock.isRunning(), 4000)).toBe(true)
    await sleep(500)
    const ringTracker = tm.getLookRing()
    expect(ringTracker.isStopped()).toBe(false)
    expect(ringTracker.isLit(6)).toBe(true)
    expect(ringTracker.isLit(0)).toBe(false) // the front was in view in run 1, not since the Restart
    cards.setViewerOverride(FAR_VIEWER)
    cards.closeCard()
    for (let step = 0; step <= 24; step++) {
      const th = (step * 15 * Math.PI) / 180
      cue.setViewerOverride(FAR_VIEWER, new vec3(Math.sin(th), 0, Math.cos(th)))
      await sleep(160)
    }
    expect(ringTracker.litCount()).toBe(12)
    const state2 = tm.getRunState()
    const front2 = state2.casualties.filter((c) => !c.behind && c.id !== state2.walkerId).map((c) => c.id)
    expect(await tagWithChecks(cards, front2[0], CASUALTY_TABLE[front2[0]].correctTag as "Red")).toBe(true)
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    const ring2 = debrief.getRingObject() as SceneObject
    expect(ring2 === null).toBe(false)
    const lit2 = litSegments(ring2)
    expect(lit2.filter((x) => x).length).toBe(12)
    expect(debrief.getRingLabelText()).toBe(RING_LABEL)

    cue.setViewerOverride(null)
    S.setViewerOverride(null)
    cleanup3(tm, cards)
  }
}
