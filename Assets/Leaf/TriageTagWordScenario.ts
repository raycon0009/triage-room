/**
 * Scenario 24 - a tagged casualty's colour and word stay in view of the viewer.
 * For several seeds (so lying, side-lying and seated poses all come up) every non-walker is tagged with its correct tag.
 * Then, from the start position and from 90 cm beside each casualty: the band and the word exist, the word shows the tag word
 * in the tag colour, is upright and faces the viewer, is not hidden inside the figure, and is large enough to read
 * (EXPECTANT is measured to fit completely inside a 90 cm wide window).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CASUALTY_TABLE, POSE_INFO} from "../Scripts/TriageData"
import {DEMO_SEED} from "../Scripts/TriageLayout"
import {getTriageMain, getCards, startRunFar, tagWithChecks, standNear, casualtyWorldPos, cleanup} from "./TriageLeafHelpers"
import {StartTag} from "../Scripts/TriageStartEngine"

const EYE = 0 // the camera is at the origin; the floor is 150 cm below it
const PROBE = false

@component
export class TriageTagWordScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const seen: {[group: string]: boolean} = {}
    for (const seed of [DEMO_SEED, 3, 7, 12, 21]) {
      const state = await startRunFar(tm, cards, seed, "on")
      for (const c of state.casualties) {
        if (CASUALTY_TABLE[c.id].walks) {
          continue
        }
        expect(await tagWithChecks(cards, c.id, CASUALTY_TABLE[c.id].correctTag as StartTag)).toBe(true)
        await sleep(450) // the band has grown into place
        seen[POSE_INFO[c.pose].group] = true
        const expectedWord = cards.getTagWordText(c.id)
        const tag = CASUALTY_TABLE[c.id].correctTag
        expect(cards.hasTagBand(c.id)).toBe(true) // the band carries the colour
        expect(expectedWord).toBe(tag === "Black" ? "EXPECTANT" : tag.toUpperCase()) // and the word is there
        const viewers = [new vec3(0, EYE, 0)]
        const beside = standNear(tm, c.id)
        viewers.push(new vec3(beside.x, EYE, beside.z))
        for (const v of viewers) {
          cards.setViewerOverride(v)
          await sleep(150) // the word turns to the viewer on the next frame
          const info = cards.getTagWordInfo(c.id)
          expect(info === null).toBe(false)
          if (!info) {
            continue
          }
          const body = casualtyWorldPos(tm, c.id)
          const toV = new vec3(v.x - info.centre.x, 0, v.z - info.centre.z).normalize()
          const distV = Math.sqrt((v.x - info.centre.x) ** 2 + (v.y - info.centre.y) ** 2 + (v.z - info.centre.z) ** 2)
          // angular height of the word's text as seen by the viewer
          const angH = (2 * Math.atan2(info.height / 2, distV) * 180) / Math.PI
          if (PROBE) {
            print("TAGWORD " + seed + " " + c.id + " " + c.pose + " " + expectedWord + " centre " + info.centre.x.toFixed(0) + "," + info.centre.y.toFixed(0) + "," + info.centre.z.toFixed(0) + " cas " + body.x.toFixed(0) + "," + body.z.toFixed(0) + " w " + info.width.toFixed(1) + " h " + info.height.toFixed(1) + " dist " + distV.toFixed(0) + " angH " + angH.toFixed(2) + " facing " + info.forward.dot(toV).toFixed(3) + " up " + info.up.y.toFixed(3))
          }
          expect(info.enabled).toBe(true)
          const k = info.colour // the word is in the tag colour (EXPECTANT in white, never black)
          expect(Math.max(k.r, k.g, k.b)).toBeGreaterThan(0.8)
          if (tag === "Black") {
            expect(Math.min(k.r, k.g, k.b)).toBeGreaterThan(0.95)
          }
          expect(info.forward.dot(toV)).toBeGreaterThan(0.99) // faces the viewer
          expect(info.up.y).toBeGreaterThan(0.99) // upright
          expect(info.centre.y - body.y).toBeGreaterThan(132) // clear of the figure (nothing is over 130 cm)
          expect(info.centre.y - body.y).toBeLessThan(215)
          expect(info.width).toBeGreaterThan(5)
          expect(info.width).toBeLessThan(90) // EXPECTANT fits completely
          expect(angH).toBeGreaterThan(1.2) // big enough to read
        }
        cards.setViewerOverride(new vec3(0, 0, 0))
      }
      cleanup(tm, cards)
    }
    expect(!!seen["lying"] && !!seen["sitting"]).toBe(true)
  }
}
