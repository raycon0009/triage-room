/**
 * Scenario - "Mode choice": after a run the debrief offers "Again: Learn" and "Again: Drill", with a tip for the next run.
 *  Run 1 (Drill, a fixed seed): one casualty tagged, nobody brought into view, then Scene clear with three untagged.
 *   - both buttons exist, are pinchable, sit at waist height within reach, and (looking down at them) are inside the
 *     view limits; the tip is above them, inside the view limits, and overlaps neither the buttons, the panel nor the map;
 *   - the tip is rule 1: "Next run: look all the way round before your first check".
 *  Pinch "Again: Learn": the mode is Learn, the layout is new, the card shows the START chips.
 *  Run 2 (Learn): everyone is brought into view first, then everyone is tagged correctly with no extra check.
 *   - the comparison reads "Last run (Drill): ..." / "This run (Learn): ...";
 *   - the tip is rule 7: "Ready for Drill: no arrow, and one groan".
 *  Pinch "Again: Drill": the mode is Drill.
 * The viewer's position and look direction are test stand-ins (setViewerOverride); the start position is (0, 0, 0).
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
  casualtyWorldPos,
  FAR_VIEWER,
} from "./TriageLeafHelpers"
import {VIEW_HALF_H_DEG, VIEW_HALF_V_DEG, assertPanelReadableAndInView} from "./TriageLeafDebriefChecks"
import {CASUALTY_TABLE} from "../Scripts/TriageData"
import {TIP_LOOK_ROUND, TIP_READY_FOR_DRILL, ALL_TIPS, MAX_TIP_CHARS} from "../Scripts/TriageNextTip"

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

/** Angles (degrees) of a point seen from the eye, relative to the look direction: h to the right, v upwards. */
function viewAngles(eye: vec3, look: vec3, p: vec3): {h: number; v: number} {
  const d = p.sub(eye)
  const right = look.cross(new vec3(0, 1, 0)).normalize()
  const up = right.cross(look).normalize()
  const z = d.dot(look)
  return {h: deg(Math.atan2(d.dot(right), z)), v: deg(Math.atan2(d.dot(up), z))}
}

/** Absolute yaw and pitch (degrees) of a point seen from the eye. */
function yawPitch(eye: vec3, p: vec3): {yaw: number; pitch: number} {
  const d = p.sub(eye)
  return {yaw: deg(Math.atan2(d.x, -d.z)), pitch: deg(Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z)))}
}

interface Box {
  yawMin: number
  yawMax: number
  pitchMin: number
  pitchMax: number
}

function boxOf(eye: vec3, points: vec3[]): Box {
  const b: Box = {yawMin: 1e9, yawMax: -1e9, pitchMin: 1e9, pitchMax: -1e9}
  for (const p of points) {
    const a = yawPitch(eye, p)
    b.yawMin = Math.min(b.yawMin, a.yaw)
    b.yawMax = Math.max(b.yawMax, a.yaw)
    b.pitchMin = Math.min(b.pitchMin, a.pitch)
    b.pitchMax = Math.max(b.pitchMax, a.pitch)
  }
  return b
}

function overlaps(a: Box, b: Box, margin: number): boolean {
  return a.yawMin < b.yawMax + margin && b.yawMin < a.yawMax + margin && a.pitchMin < b.pitchMax + margin && b.pitchMin < a.pitchMax + margin
}

function layoutKey(state: {casualties: {id: string; slot: string; pose: string}[]}): string {
  return state.casualties.map((c) => c.id + "@" + c.slot + ":" + c.pose).join("|")
}

@component
export class TriageModeChoiceScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const cue = getCue()
    const clock = getClock()
    const callOut = getCallOut()
    const debrief = getDebrief()
    const S = debrief.getSceneClear()!
    const eye = new vec3(0, 0, 0)
    const up = new vec3(0, 1, 0) // looking at the ceiling: nobody is in view
    const lookAt = (id: string): vec3 => casualtyWorldPos(tm, id).sub(FAR_VIEWER)
    debrief.setViewerOverride(FAR_VIEWER)
    debrief.timesUpSeconds = 1
    debrief.endGraceSeconds = 0.3
    S.setViewerOverride(FAR_VIEWER, up)
    cue.setViewerOverride(FAR_VIEWER, up)

    // ================= Run 1: Drill, one tagged, nobody in view, Scene clear =================
    const seed = findSeedWith("A", "off")
    const state1 = await startRunFar(tm, cards, seed, "off")
    expect(tm.getMode()).toBe("drill")
    const nonWalkers1 = state1.casualties.map((c) => c.id).filter((id) => id !== state1.walkerId)
    expect(await tagWithChecks(cards, nonWalkers1[0], CASUALTY_TABLE[nonWalkers1[0]].correctTag as "Red")).toBe(true)
    expect(await waitFor(() => S.isButtonVisible(), 1500)).toBe(true)
    expect(S.pressSceneClear()).toBe(true)
    expect(await waitFor(() => S.isQuestionOpen(), 1000)).toBe(true)
    expect(S.answerYes()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 3000)).toBe(true)
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    expect(await waitFor(() => !!findInteractableByName("AgainLearnButton") && !!findInteractableByName("AgainDrillButton"), 4000)).toBe(true)
    await sleep(300)
    expect(debrief.getSummary()!.correct).toBe(1)
    assertPanelReadableAndInView(debrief, tm, true)

    // ---- both buttons exist, at waist height, within reach, inside the view limits when looking down at them
    const root = debrief.getRestartButtonObject() as SceneObject
    expect(root === null).toBe(false)
    const floorY = tm.sceneObject.getTransform().getWorldPosition().y
    const learnBtn = debrief.getAgainButtonObject("learn") as SceneObject
    const drillBtn = debrief.getAgainButtonObject("drill") as SceneObject
    expect(learnBtn === null).toBe(false)
    expect(drillBtn === null).toBe(false)
    const lp = learnBtn.getTransform().getWorldPosition()
    const dp = drillBtn.getTransform().getWorldPosition()
    for (const p of [lp, dp]) {
      expect(p.y - floorY).toBeGreaterThan(90) // waist height
      expect(p.y - floorY).toBeLessThan(110)
      expect(p.sub(eye).length).toBeLessThan(105) // within reach while standing
    }
    expect(lp.x).toBeLessThan(dp.x - 20) // side by side, Learn on the left
    expect(Math.abs(lp.y - dp.y)).toBeLessThan(0.5)
    // upright and facing the viewer
    const fwd = root.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, 1))
    expect(Math.abs(fwd.y)).toBeLessThan(0.01)
    const rp = root.getTransform().getWorldPosition()
    expect(fwd.dot(new vec3(-rp.x, 0, -rp.z).normalize())).toBeGreaterThan(0.99)
    // the button faces (25 x 8.5 cm) as world points
    const rootM = root.getTransform().getWorldTransform()
    const faceCorners: vec3[] = []
    for (const cx of [-13.5, 13.5]) {
      for (const sx of [-12.5, 12.5]) {
        for (const sy of [-4.25, 4.25]) {
          faceCorners.push(rootM.multiplyPoint(new vec3(cx + sx, sy, 0)))
        }
      }
    }
    // the tip's box as world points
    const tipObj = debrief.getTipObject() as SceneObject
    expect(tipObj === null).toBe(false)
    const tipText = tipObj.getComponent("Component.Text") as Text
    const tb = tipText.getBoundingBox()
    const tipM = tipObj.getTransform().getWorldTransform()
    const tipCorners: vec3[] = []
    for (const x of [tb.left, tb.right]) {
      for (const y of [tb.top, tb.bottom]) {
        tipCorners.push(tipM.multiplyPoint(new vec3(x, y, 0)))
      }
    }
    // look down at the pair (a little above its centre, towards the tip): everything stays inside the view limits
    const centre = rp.add(new vec3(0, 3, 0))
    const look = centre.sub(eye).normalize()
    let worstH = 0
    let worstV = 0
    for (const p of faceCorners.concat(tipCorners)) {
      const a = viewAngles(eye, look, p)
      worstH = Math.max(worstH, Math.abs(a.h))
      worstV = Math.max(worstV, Math.abs(a.v))
    }
    print("MODE_CHOICE view worst h " + worstH.toFixed(2) + " v " + worstV.toFixed(2) + " tip width " + (tb.right - tb.left).toFixed(1) + " cm")
    expect(worstH).toBeLessThan(VIEW_HALF_H_DEG)
    expect(worstV).toBeLessThan(VIEW_HALF_V_DEG)

    // ---- the tip: rule 1, light text, above the buttons, on one line
    expect(debrief.getTipText()).toBe(TIP_LOOK_ROUND)
    expect(debrief.getViewLines().indexOf("You started before seeing everyone") >= 0 || debrief.getViewLines()[0] === "4 people never came into view").toBe(true)
    const tc = tipText.textFill.color
    expect(Math.min(tc.r, tc.g, tc.b)).toBeGreaterThan(0.6) // light: the display is additive
    expect(tc.a).toBeGreaterThan(0.95)
    expect(tipText.text.indexOf("\n") < 0).toBe(true)
    expect(/looked at/i.test(tipText.text)).toBe(false)
    let tipBottom = 1e9
    for (const p of tipCorners) {
      tipBottom = Math.min(tipBottom, p.y)
    }
    let faceTop = -1e9
    for (const p of faceCorners) {
      faceTop = Math.max(faceTop, p.y)
    }
    expect(tipBottom).toBeGreaterThan(faceTop) // the tip is above the buttons, not on them

    // ---- nothing overlaps: the tip and the buttons against the panel and the map, as seen from the start position
    const pairBox = boxOf(eye, faceCorners)
    const tipBox = boxOf(eye, tipCorners)
    const panelBox = boxOf(eye, debrief.getPanelCornersWorld())
    expect(overlaps(pairBox, tipBox, 0)).toBe(false)
    expect(overlaps(pairBox, panelBox, 1)).toBe(false)
    expect(overlaps(tipBox, panelBox, 1)).toBe(false)
    const mapPoints: vec3[] = []
    const visit = (so: SceneObject): void => {
      if (!so || isNull(so)) {
        return
      }
      mapPoints.push(so.getTransform().getWorldPosition())
      for (let i = 0; i < so.getChildrenCount(); i++) {
        visit(so.getChild(i))
      }
    }
    visit(debrief.getMapObject() as SceneObject)
    const mapBox = boxOf(eye, mapPoints)
    print("MODE_CHOICE map pitch " + mapBox.pitchMin.toFixed(1) + " .. " + mapBox.pitchMax.toFixed(1) + ", pair " + pairBox.pitchMin.toFixed(1) + " .. " + pairBox.pitchMax.toFixed(1))
    expect(pairBox.pitchMin).toBeGreaterThan(mapBox.pitchMax + 1) // the pair sits above the top of the map in the view
    expect(tipBox.pitchMin).toBeGreaterThan(mapBox.pitchMax + 1)

    // ---- pinch "Again: Learn": Learn, a new layout, the START chips on the card
    const key1 = layoutKey(state1)
    const seed1 = state1.seed
    await pressButton("AgainLearnButton")
    expect(await waitFor(() => clock.isRunning(), 4000)).toBe(true)
    await sleep(700)
    expect(tm.getMode()).toBe("learn")
    cards.setViewerOverride(FAR_VIEWER)
    cards.closeCard()
    cue.setViewerOverride(FAR_VIEWER, up)
    S.setViewerOverride(FAR_VIEWER, up)
    const state2 = tm.getRunState()
    expect(state2.casualties.length).toBe(4)
    expect(state2.seed === seed1).toBe(false)
    expect(layoutKey(state2) === key1).toBe(false)
    const firstId = state2.casualties[0].id
    cards.openCard(firstId, "button")
    await sleep(300)
    expect(cards.getLearnChips().visible).toBe(true)
    cards.closeCard()

    // ================= Run 2: Learn, everyone in view first, everyone right with no extra check =================
    const walker2 = state2.walkerId
    const non2 = state2.casualties.map((c) => c.id).filter((id) => id !== walker2)
    for (const id of state2.casualties.map((c) => c.id)) {
      cue.setViewerOverride(FAR_VIEWER, lookAt(id))
      await sleep(450)
    }
    cue.setViewerOverride(FAR_VIEWER, up)
    const tracker = tm.getFirstSeen()
    expect(tracker.neverSeenCount()).toBe(0)
    for (const id of non2) {
      expect(await tagWithChecks(cards, id, CASUALTY_TABLE[id].correctTag as "Red")).toBe(true)
    }
    expect(callOut.pressCallOut()).toBe(true)
    expect(await waitFor(() => debrief.isOpen(), 20000)).toBe(true)
    expect(clock.getEndReason()).toBe("all-tagged")
    expect(await waitFor(() => debrief.isRevealDone(), 8000)).toBe(true)
    await sleep(300)
    expect(debrief.getSummary()!.correct).toBe(4)
    expect(debrief.getSummary()!.totalExtraChecks).toBe(0)
    expect(debrief.getViewLines().length).toBe(1) // everyone was in view before the first tag
    const lines = debrief.getCompareLines()
    expect(lines.length).toBe(2)
    expect(lines[0].indexOf("Last run (Drill): 1 of 4") === 0).toBe(true)
    expect(lines[1].indexOf("This run (Learn): 4 of 4") === 0).toBe(true)
    expect(debrief.getTipText()).toBe(TIP_READY_FOR_DRILL)
    assertPanelReadableAndInView(debrief, tm, false)

    // ---- pinch "Again: Drill": the mode is Drill
    expect(await waitFor(() => !!findInteractableByName("AgainDrillButton"), 3000)).toBe(true)
    await pressButton("AgainDrillButton")
    expect(await waitFor(() => clock.isRunning(), 4000)).toBe(true)
    await sleep(700)
    expect(tm.getMode()).toBe("drill")
    expect(tm.getRunState().seed === state2.seed).toBe(false) // a new layout again

    // ---- every tip fits the line the layout is sized for
    for (const t of ALL_TIPS) {
      expect(t.length <= MAX_TIP_CHARS).toBe(true)
    }

    cue.setViewerOverride(FAR_VIEWER, up)
    S.setViewerOverride(null)
    cleanup3(tm, cards)
  }
}
