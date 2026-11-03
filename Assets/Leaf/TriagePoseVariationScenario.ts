/**
 * Scenario 18 - pose variation: appearance must not predict the tag.
 * Part 1 (pure, many seeds): every pose a case can take is a believable one (lying / seated / slumped, on the floor, real size);
 *   no case is tied to one pose; the same pose shows up for cases with different tags; walkers are always seated;
 *   F and X are never upright; the layout rules still hold; same seed = same poses; the demo seed is unchanged.
 * Part 2 (built scene, several seeds): each figure is built in the pose the run says, sits on the floor at real size, and the
 *   card title and the run state's pose label match the pose shown.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {generateRun, validateRun, ForceBlack, DEMO_SEED} from "../Scripts/TriageLayout"
import {CASUALTY_TABLE, POSE_CHOICES, POSE_INFO, poseLabelOf} from "../Scripts/TriageData"
import {POSES, partsFromPose, boundsOf, lookFor, DIM} from "../Scripts/TriageFigurePose"
import {getTriageMain, startFixedRun, casualtyObjects, measureFigure, getCards, cleanup, resetToFreshStart, FAR_VIEWER} from "./TriageLeafHelpers"

@component
export class TriagePoseVariationScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)

    // every pose offered is a real pose that sits on the floor at human size
    for (const id of Object.keys(POSE_CHOICES)) {
      for (const kind of POSE_CHOICES[id]) {
        if (!POSES[kind] || !POSE_INFO[kind]) {
          throw new Error(id + ": pose " + kind + " is not defined")
        }
        const b = boundsOf(partsFromPose(POSES[kind], lookFor(1, 0, id === "W1")), DIM.rimWidth)
        const ext = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
        if (!(b.min[1] >= -3 && b.min[1] <= 8) || !(ext >= 70 && ext <= 220) || !(b.max[1] <= 130)) {
          throw new Error(kind + " is not on the floor at real size (lowest " + b.min[1] + ", largest " + ext + ", top " + b.max[1] + ")")
        }
      }
    }

    // many seeds
    const posesSeen: {[id: string]: {[kind: string]: boolean}} = {}
    const tagsPerPose: {[kind: string]: {[tag: string]: boolean}} = {}
    const settings: ForceBlack[] = ["auto", "on", "off"]
    for (let seed = 1; seed <= 400; seed++) {
      for (const fb of settings) {
        const run = generateRun(seed, fb)
        const errs = validateRun(run)
        if (errs.length > 0) {
          throw new Error("Seed " + seed + " (" + fb + ") broke a rule: " + errs.join("; "))
        }
        const again = generateRun(seed, fb)
        if (JSON.stringify(again.casualties) !== JSON.stringify(run.casualties)) {
          throw new Error("Seed " + seed + " (" + fb + ") is not repeatable")
        }
        for (const c of run.casualties) {
          const def = CASUALTY_TABLE[c.id]
          const group = POSE_INFO[c.pose].group
          if (def.walks && group !== "sitting") {
            throw new Error("Seed " + seed + ": walker " + c.id + " is " + c.pose)
          }
          if ((c.id === "F" || c.id === "X") && group !== "lying") {
            throw new Error("Seed " + seed + ": " + c.id + " is upright (" + c.pose + ")")
          }
          if (!posesSeen[c.id]) {
            posesSeen[c.id] = {}
          }
          posesSeen[c.id][c.pose] = true
          if (!tagsPerPose[c.pose]) {
            tagsPerPose[c.pose] = {}
          }
          tagsPerPose[c.pose][def.correctTag] = true
        }
      }
    }
    // no case is tied to one pose: every case shows every pose it may take
    for (const id of Object.keys(POSE_CHOICES)) {
      const seen = Object.keys(posesSeen[id] || {})
      expect(seen.length).toBeGreaterThan(1)
      if (seen.length !== POSE_CHOICES[id].length) {
        throw new Error(id + " only showed " + seen.join(",") + " of " + POSE_CHOICES[id].join(","))
      }
    }
    // the same pose appears for cases with different tags
    for (const kind of ["lying_back", "lying_side", "sitting_dazed", "sitting_knees_up", "sitting_leaning_back", "lying_back_arm_up"]) {
      expect(Object.keys(tagsPerPose[kind] || {}).length).toBeGreaterThan(1)
    }

    // the demo seed keeps its documented poses and layout
    const demo = generateRun(DEMO_SEED, "on")
    const byId: {[id: string]: {pose: string; x: number; z: number; slot: string}} = {}
    for (const c of demo.casualties) {
      byId[c.id] = {pose: c.pose, x: c.x, z: c.z, slot: c.slot}
    }
    expect(byId.D.pose).toBe("lying_groaning")
    expect(byId.D.slot).toBe("behind")
    expect(byId.C.pose).toBe("slumped_against_wall")
    expect(byId.C.slot).toBe("wall")
    expect(byId.X.pose).toBe("lying_face_up_still")
    expect(byId.W1.pose).toBe("sitting_arm_cut")
    expect(Math.abs(byId.D.x - 46) < 2 && Math.abs(byId.D.z - 213) < 2).toBe(true)
    expect(Math.abs(byId.X.x + 95) < 2 && Math.abs(byId.X.z + 238) < 2).toBe(true)
    expect(Math.abs(byId.W1.x - 96) < 2 && Math.abs(byId.W1.z + 249) < 2).toBe(true)

    // Part 2: the built scene
    const tm = getTriageMain()
    const cards = getCards()
    cards.setViewerOverride(FAR_VIEWER) // proximity must not swap the open card while titles are read
    const floorY = tm.sceneObject.getTransform().getWorldPosition().y
    const builder = tm.getFigureBuilder()
    for (let seed = 5; seed <= 45; seed += 8) {
      const state = startFixedRun(tm, seed, seed % 2 === 1 ? "on" : "off")
      expect(state.violations.length).toBe(0)
      for (const c of state.casualties) {
        const label = poseLabelOf(c.pose)
        expect(c.poseLabel).toBe(label)
        expect(tm.getCasualtyPose(c.id).label).toBe(label)
        // the figure is built in exactly that pose
        expect(JSON.stringify(builder.getPose(c.id))).toBe(JSON.stringify(POSES[c.pose]))
        const obj = casualtyObjects(tm).find((o) => o.name === c.sceneObjectName)
        if (!obj) {
          throw new Error("Seed " + seed + ": " + c.sceneObjectName + " missing")
        }
        const b = measureFigure(obj)
        const largest = Math.max(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ)
        const tag = "Seed " + seed + " " + c.id + " " + c.pose
        if (!(largest >= 70 && largest <= 220)) {
          throw new Error(tag + ": not human-sized (" + Math.round(largest) + " cm)")
        }
        if (!(b.minY - floorY >= -3 && b.minY - floorY <= 8)) {
          throw new Error(tag + ": not on the floor (lowest " + Math.round(b.minY - floorY) + " cm)")
        }
        if (!(b.maxY - floorY <= 130)) {
          throw new Error(tag + ": too high")
        }
        // the card shows the same description as the pose
        cards.openCard(c.id, "button")
        await sleep(120)
        expect(cards.getCardLabels().title).toBe(label)
        cards.closeCard()
      }
    }
    cards.setViewerOverride(null)
    cleanup(tm, cards)
    resetToFreshStart(tm)
  }
}
