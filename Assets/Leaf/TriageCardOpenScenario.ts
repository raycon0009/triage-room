/**
 * Scenario 7 - done criterion 3, first half: the check card opens when the viewer is within about 1.5 m of a
 * casualty, and from further away by pinching "Open" on the casualty's dot. The card sits about 0.8 m from the
 * eyes, a little below eye level, facing the viewer.
 * The viewer position is a test stand-in (setViewerOverride): LEAF cannot walk the preview camera.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, findSeedWith, startRunFar, pressButton, standNear, cleanup, FAR_VIEWER} from "./TriageLeafHelpers"

@component
export class TriageCardOpenScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    const seed = findSeedWith("A", "off")
    await startRunFar(tm, cards, seed, "off")

    // Far away: no card.
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getOpenCasualtyId() === null).toBe(true)

    // Pinch "Open" on A's dot from far away -> A's card opens (reason: button).
    await pressButton("OpenButton_A")
    expect(cards.getOpenCasualtyId()).toBe("A")
    expect(cards.getOpenReason()).toBe("button")
    expect(cards.isCardVisible()).toBe(true)
    expect(cards.isTagPanelVisible()).toBe(false)

    // Pinch "Close" on the same dot -> closed, and it stays closed while the viewer is far away.
    await pressButton("OpenButton_A")
    expect(cards.getOpenCasualtyId() === null).toBe(true)
    await sleep(400)
    expect(cards.isCardVisible()).toBe(false)

    // Walk up (stand 90 cm away): the card opens by itself (reason: proximity).
    const viewer = standNear(tm, "A")
    cards.setViewerOverride(viewer)
    await sleep(700)
    expect(cards.getOpenCasualtyId()).toBe("A")
    expect(cards.getOpenReason()).toBe("proximity")
    expect(cards.isCardVisible()).toBe(true)

    // Card placement: about 0.8 m from the eyes, below eye level, facing the viewer.
    const cardObj = cards.getSceneObject().getChild(0)
    const p = cardObj.getTransform().getWorldPosition()
    const dx = p.x - viewer.x
    const dz = p.z - viewer.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    expect(dist).toBeGreaterThan(70)
    expect(dist).toBeLessThan(90)
    expect(p.y).toBeLessThan(viewer.y) // centre below eye level
    const fwd = cardObj.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, 1))
    const toViewer = new vec3(-dx / dist, 0, -dz / dist)
    const facing = fwd.x * toViewer.x + fwd.z * toViewer.z
    expect(facing).toBeGreaterThan(0.95)

    // Walk away again (beyond 2.2 m): a card that opened by proximity closes.
    cards.setViewerOverride(FAR_VIEWER)
    await sleep(600)
    expect(cards.isCardVisible()).toBe(false)

    cleanup(tm, cards)
  }
}
