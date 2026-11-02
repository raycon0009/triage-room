/**
 * Scenario 10 - done criterion 4 examples, in the running Lens through the real card buttons:
 *  a) breathing rate 34 -> tag buttons appear straight after "Breathing rate" -> Red, 0 extra checks.
 *  b) an extra check after the deciding step counts +1 (pulse after rate 34).
 *  c) not breathing, then still not breathing after "Open airway" -> EXPECTANT (dark grey, white outline, not black).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, findSeedWith, startRunFar, pressButton, cleanup} from "./TriageLeafHelpers"

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

function colourOf(so: SceneObject): vec4 {
  const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  return rmv.mainMaterial.mainPass.baseColor
}

@component
export class TriageStartRulesScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()

    // a) rate 34 -> Red, no more checks needed
    await startRunFar(tm, cards, findSeedWith("A", "off"), "off")
    await pressButton("OpenButton_A")
    await pressButton("CardBtn_breathing")
    expect(cards.isTagPanelVisible()).toBe(false)
    await pressButton("CardBtn_second")
    expect(cards.getCardLabels().second).toBe("Rate: 34/min")
    expect(cards.isTagPanelVisible()).toBe(true)
    await pressButton("TagBtn_Red")
    await sleep(300)
    let rec = cards.getRecord("A")
    expect(rec.tag).toBe("Red")
    expect(rec.correctTag).toBe("Red")
    expect(rec.extraChecks).toBe(0)
    expect(cards.getTagWordText("A")).toBe("RED")
    expect(cards.isCardVisible()).toBe(false)

    // b) extra check after the deciding step counts +1
    await startRunFar(tm, cards, findSeedWith("A", "off"), "off")
    await pressButton("OpenButton_A")
    await pressButton("CardBtn_breathing")
    await pressButton("CardBtn_second")
    expect(cards.isTagPanelVisible()).toBe(true)
    await pressButton("CardBtn_pulse") // not needed: rate 34 already decided
    expect(cards.getCardLabels().pulse).toBe("Pulse / refill: —")
    expect(cards.isTagPanelVisible()).toBe(true)
    await pressButton("TagBtn_Red")
    await sleep(300)
    rec = cards.getRecord("A")
    expect(rec.tag).toBe("Red")
    expect(rec.extraChecks).toBe(1)

    // c) not breathing -> Open airway -> still not breathing -> EXPECTANT
    await startRunFar(tm, cards, findSeedWith("X", "on"), "on")
    await pressButton("OpenButton_X")
    await pressButton("CardBtn_breathing")
    expect(cards.getCardLabels().breathing).toBe("Breathing: No")
    expect(cards.getCardLabels().second).toBe("Open airway")
    expect(cards.isTagPanelVisible()).toBe(false)
    await pressButton("CardBtn_second")
    expect(cards.getCardLabels().second).toBe("After airway: not breathing")
    expect(cards.isTagPanelVisible()).toBe(true)
    await pressButton("TagBtn_Expectant")
    await sleep(300)
    rec = cards.getRecord("X")
    expect(rec.tag).toBe("Black")
    expect(rec.tagWord).toBe("EXPECTANT")
    expect(rec.extraChecks).toBe(0)
    expect(cards.getTagWordText("X")).toBe("EXPECTANT")
    const x = tm.getCasualtyObject("X") as SceneObject
    const band = findByName(x, "Band") as SceneObject
    const outline = findByName(x, "Outline") as SceneObject
    const bc = colourOf(band)
    const oc = colourOf(outline)
    // dark grey (not black, not light); outline is white
    expect(bc.r).toBeGreaterThan(0.2)
    expect(bc.r).toBeLessThan(0.5)
    expect(oc.r).toBeGreaterThan(0.95)
    expect(oc.g).toBeGreaterThan(0.95)
    expect(oc.b).toBeGreaterThan(0.95)

    cleanup(tm, cards)
  }
}
