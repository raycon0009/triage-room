/**
 * TriageLeafDebriefChecks.ts - shared assertions for the debrief scenarios (build step 5): the ONE panel is readable
 * and sits fully in view from the start position, the map markers carry the same numbers as the panel rows, the
 * floor map has no leader lines, and the Restart button is at waist height above the map.
 */
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {TriageMain} from "../Scripts/TriageMain"
import {TriageDebrief} from "../Scripts/TriageDebrief"

/** The preview's field of view seen from the start position, with a little margin (measured: about 16 deg to each side, 18 up / down). */
export const VIEW_HALF_H_DEG = 16
export const VIEW_HALF_V_DEG = 17
/** Step 4's explanation lines were size 58; the smallest text now must be at least twice that. */
export const MIN_TEXT_SIZE = 116

function deg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function countNamed(prefix: string): number {
  let n = 0
  const visit = (so: SceneObject): void => {
    if (!so || isNull(so)) {
      return // destroyed this frame
    }
    if (so.name.indexOf(prefix) === 0) {
      n++
    }
    for (let i = 0; i < so.getChildrenCount(); i++) {
      visit(so.getChild(i))
    }
  }
  const scene = global.scene
  for (let i = 0; i < scene.getRootObjectsCount(); i++) {
    visit(scene.getRootObject(i))
  }
  return n
}

/** The debrief panel: one panel, in front, slightly below eye level, fully inside the view, readable text, no leader lines. */
export function assertPanelReadableAndInView(debrief: TriageDebrief, tm: TriageMain, hasMissed: boolean): void {
  const panel = debrief.getPanelObject() as SceneObject
  expect(panel === null).toBe(false)
  expect(countNamed("DebriefPanel")).toBe(1) // ONE panel
  expect(countNamed("DebriefLabel_")).toBe(0) // the four scattered labels are gone
  expect(countNamed("Leader_")).toBe(0) // and so are the leader lines

  const size = debrief.getPanelSizeCm()
  const pc = panel.getTransform().getWorldPosition()
  // about 1.2 m in front of the start position (0, 0, 0), centred slightly below eye level
  expect(Math.abs(pc.x)).toBeLessThan(2)
  expect(pc.z).toBeLessThan(-115)
  expect(pc.z).toBeGreaterThan(-125)
  expect(pc.y).toBeLessThan(0)
  expect(pc.y).toBeGreaterThan(-10)

  // fully within the view limits from the start position, looking straight ahead
  for (const c of debrief.getPanelCornersWorld()) {
    expect(c.z).toBeLessThan(-50)
    expect(deg(Math.atan2(Math.abs(c.x), -c.z))).toBeLessThan(VIEW_HALF_H_DEG)
    expect(deg(Math.atan2(Math.abs(c.y), -c.z))).toBeLessThan(VIEW_HALF_V_DEG)
  }
  // upright and facing the viewer
  const fwd = panel.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, 1))
  expect(Math.abs(fwd.y)).toBeLessThan(0.01)
  expect(fwd.dot(new vec3(-pc.x, 0, -pc.z).normalize())).toBeGreaterThan(0.99)

  // text: the smallest is at least twice step 4's explanation size; the summary is the largest normal text
  expect(debrief.getMinTextSize()).toBeGreaterThan(MIN_TEXT_SIZE - 0.5)
  const entries = debrief.getEntries()
  const summaryLines = debrief.getSummaryLines()
  expect(summaryLines.length).toBe(2)
  expect(summaryLines.join(" · ")).toBe((debrief.getSummary() as {text: string}).text)
  let maxRow = 0
  for (const e of entries) {
    for (const name of ["name", "stats", "youLabel", "youWord", "correctLabel", "correctWord", "explanation"]) {
      maxRow = Math.max(maxRow, debrief.getRowTextSize(e.id, name))
    }
  }
  expect(maxRow).toBeGreaterThan(0)
  const ext = debrief.getTextExtents()
  let summaryMax = 0
  for (const x of ext) {
    if (x.id === "summary") {
      summaryMax = Math.max(summaryMax, x.size)
    }
  }
  expect(summaryMax).toBeGreaterThan(maxRow) // the summary is the largest of the ordinary text
  if (hasMissed) {
    expect(debrief.getMaxTextSize()).toBeGreaterThan(summaryMax) // NOT REACHED is the biggest text on the panel
  }

  // every text lies inside the panel (measured with the text's own bounding box)
  expect(ext.length > 0).toBe(true)
  for (const x of ext) {
    expect(x.right - x.left).toBeGreaterThan(0.5) // really laid out
    expect(x.left).toBeGreaterThan(-size.width / 2 - 0.3)
    expect(x.right).toBeLessThan(size.width / 2 + 0.3)
    expect(x.top).toBeLessThan(size.height / 2 + 0.3)
    expect(x.bottom).toBeGreaterThan(-size.height / 2 - 0.3)
  }

  // rows are numbered 1..n in order; anyone missed first; the map markers carry the same numbers
  let seenNotMissed = false
  entries.forEach((e, i) => {
    expect(e.row).toBe(i + 1)
    expect(debrief.getRowTexts(e.id).number).toBe(String(i + 1))
    expect(debrief.getMarkerNumber(e.id)).toBe(String(i + 1))
    if (e.status !== "missed") {
      seenNotMissed = true
    } else {
      expect(seenNotMissed).toBe(false) // a missed casualty is never below one who was reached
    }
  })

  // Restart: waist height, just above the near part of the map, within reach of the start position
  const rb = debrief.getRestartButtonObject() as SceneObject
  expect(rb === null).toBe(false)
  const rp = rb.getTransform().getWorldPosition()
  const floorY = tm.sceneObject.getTransform().getWorldPosition().y
  const mp = (debrief.getMapObject() as SceneObject).getTransform().getWorldPosition()
  expect(rp.y - floorY).toBeGreaterThan(90)
  expect(rp.y - floorY).toBeLessThan(110)
  expect(Math.abs(rp.x - mp.x)).toBeLessThan(30)
  expect(Math.abs(rp.z - mp.z)).toBeLessThan(55) // above the map's footprint
  expect(Math.sqrt(rp.x * rp.x + rp.y * rp.y + rp.z * rp.z)).toBeLessThan(105) // within reach while standing
}
