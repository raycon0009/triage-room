/**
 * Scenario 7 - done criterion 3, first half + the card placement rules:
 *  - the card opens within about 1.5 m of a casualty (proximity) and, from further away, by pinching "Open";
 *  - it opens in the viewer's current view direction about 0.7 m away, slightly below the centre of view,
 *    looking straight ahead AND looking steeply down at a casualty (all buttons inside the view);
 *  - it is about 25 cm wide with buttons at least 4 cm tall;
 *  - it never hides the casualty's head or torso (checked independently with rays from the eye);
 *  - a line joins the card to its casualty's dot;
 *  - lazy follow: a small head turn leaves it where it is, a big turn brings it back into view.
 * The viewer position and look direction are test stand-ins (setViewerOverride): LEAF cannot move the preview camera.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getTriageMain, getCards, findSeedWith, startRunFar, pressButton, standNear, casualtyWorldPos, cleanup, FAR_VIEWER} from "./TriageLeafHelpers"

const HALF_W = 12.5 // card is 25 cm wide
const TOP = 13.25 // from the check panel's centre
const BOTTOM = 21.05 // down to the bottom of the tag panel

function angleDeg(a: vec3, b: vec3): number {
  return (Math.acos(Math.max(-1, Math.min(1, a.normalize().dot(b.normalize())))) * 180) / Math.PI
}

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

/** Is world point q hidden behind the card rectangle (whole card incl. tag panel) from the eye? Zero margin. */
function hidesPoint(card: SceneObject, eye: vec3, q: vec3): boolean {
  const t = card.getTransform()
  const c = t.getWorldPosition()
  const rot = t.getWorldRotation()
  const xr = rot.multiplyVec3(new vec3(1, 0, 0))
  const yr = rot.multiplyVec3(new vec3(0, 1, 0))
  const n = rot.multiplyVec3(new vec3(0, 0, 1)) // faces the eye
  const r = q.sub(eye)
  const dn = r.dot(n)
  if (dn >= 0) {
    return false
  }
  const k = c.sub(eye).dot(n) / dn
  if (k <= 0 || k >= 1) {
    return false
  }
  const hit = eye.add(r.uniformScale(k)).sub(c)
  const x = hit.dot(xr)
  const y = hit.dot(yr)
  return Math.abs(x) < HALF_W && y < TOP && y > -BOTTOM
}

@component
export class TriageCardOpenScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const tm = getTriageMain()
    const cards = getCards()
    await startRunFar(tm, cards, findSeedWith("A", "off"), "off")

    // ---- size: about 25 cm wide, buttons at least 4 cm tall
    const size = cards.getCardSizeCm()
    expect(size.width).toBeGreaterThan(24)
    expect(size.width).toBeLessThan(26)
    expect(size.buttonHeight).toBeGreaterThan(4)

    // ---- far away, looking straight ahead: no card; "Open" opens it in front of the eyes
    const ahead = new vec3(0, 0, -1)
    cards.setViewerOverride(FAR_VIEWER, ahead)
    await sleep(300)
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getOpenCasualtyId() === null).toBe(true)

    await pressButton("OpenButton_A")
    expect(cards.getOpenCasualtyId()).toBe("A")
    expect(cards.getOpenReason()).toBe("button")
    expect(cards.isCardVisible()).toBe(true)
    expect(cards.isTagPanelVisible()).toBe(false)
    await sleep(200)
    const cardObj = cards.getSceneObject().getChild(0)
    let p = cardObj.getTransform().getWorldPosition()
    let off = p.sub(FAR_VIEWER)
    // about 0.7 m along the view direction (it may slide a little sideways to keep clear of the casualty)
    expect(off.dot(ahead)).toBeGreaterThan(62)
    expect(off.dot(ahead)).toBeLessThan(78)
    expect(angleDeg(off, ahead)).toBeLessThan(20)
    expect(p.y).toBeLessThan(FAR_VIEWER.y) // slightly below the centre of view

    // ---- "Close" closes it and it stays shut while the viewer is far away
    await pressButton("OpenButton_A")
    expect(cards.getOpenCasualtyId() === null).toBe(true)
    await sleep(400)
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getConnector().visible).toBe(false)

    // ---- walk up to A (90 cm away) and look steeply down at them: proximity opens the card in view
    const viewer = standNear(tm, "A")
    const target = casualtyWorldPos(tm, "A")
    const down = target.sub(viewer)
    expect(down.y).toBeLessThan(-100) // really looking down
    cards.setViewerOverride(viewer, down)
    await sleep(900)
    expect(cards.getOpenCasualtyId()).toBe("A")
    expect(cards.getOpenReason()).toBe("proximity")
    expect(cards.isCardVisible()).toBe(true)

    p = cardObj.getTransform().getWorldPosition()
    off = p.sub(viewer)
    expect(off.length).toBeGreaterThan(55)
    expect(off.length).toBeLessThan(95)
    // in view: centre near the view centre, and all four corners (incl. the tag buttons) inside a 35 degree cone
    expect(angleDeg(off, down)).toBeLessThan(22)
    const rot = cardObj.getTransform().getWorldRotation()
    const xr = rot.multiplyVec3(new vec3(1, 0, 0))
    const yr = rot.multiplyVec3(new vec3(0, 1, 0))
    for (const sx of [-1, 1]) {
      for (const y of [TOP, -BOTTOM]) {
        const corner = p.add(xr.uniformScale(sx * HALF_W)).add(yr.uniformScale(y))
        expect(angleDeg(corner.sub(viewer), down)).toBeLessThan(35)
      }
    }
    // faces the viewer: parallel to the view plane (its front points back at the eyes), upright (no roll)
    const fwd = rot.multiplyVec3(new vec3(0, 0, 1))
    expect(fwd.dot(down.normalize().uniformScale(-1))).toBeGreaterThan(0.98)
    expect(Math.abs(xr.y)).toBeLessThan(0.05)

    // never covers the casualty's head or torso (rays from the eye, independent of the Lens's own check)
    const cas = tm.getCasualtyObject("A") as SceneObject
    const head = findByName(cas, "Head") as SceneObject
    const torso = findByName(cas, "Torso") as SceneObject
    const hw = head.getTransform().getWorldPosition()
    const tw = torso.getTransform().getWorldPosition()
    expect(hidesPoint(cardObj, viewer, hw)).toBe(false)
    expect(hidesPoint(cardObj, viewer, tw)).toBe(false)
    expect(hidesPoint(cardObj, viewer, hw.add(tw).uniformScale(0.5))).toBe(false)
    expect(cards.isCasualtyCovered("A")).toBe(false)

    // a line joins the card to the casualty's dot
    const dot = findByName(cas, "Dot_A") as SceneObject
    const conn = cards.getConnector()
    expect(conn.visible).toBe(true)
    expect(conn.to.sub(dot.getTransform().getWorldPosition()).length).toBeLessThan(3)
    expect(conn.from.sub(p).length).toBeGreaterThan(HALF_W - 2)
    expect(conn.from.sub(p).length).toBeLessThan(HALF_W + 2)

    // ---- lazy follow: a small turn (10 degrees) leaves the card where it is ...
    const before = cardObj.getTransform().getWorldPosition()
    const small = quat.angleAxis((10 * Math.PI) / 180, new vec3(0, 1, 0)).multiplyVec3(down)
    cards.setViewerOverride(viewer, small)
    await sleep(700)
    expect(cardObj.getTransform().getWorldPosition().sub(before).length).toBeLessThan(1)

    // ... a big turn (140 degrees) takes it out of view, and it glides back in
    const big = quat.angleAxis((140 * Math.PI) / 180, new vec3(0, 1, 0)).multiplyVec3(new vec3(down.x, -20, down.z))
    cards.setViewerOverride(viewer, big)
    await sleep(2500)
    const after = cardObj.getTransform().getWorldPosition()
    expect(after.sub(before).length).toBeGreaterThan(40) // it moved
    expect(angleDeg(after.sub(viewer), big)).toBeLessThan(25) // and is back in view
    expect(after.sub(viewer).length).toBeLessThan(95)

    // ---- walk away (beyond 2.2 m): a card that opened by proximity closes, and the line goes
    cards.setViewerOverride(FAR_VIEWER, ahead)
    await sleep(600)
    expect(cards.isCardVisible()).toBe(false)
    expect(cards.getConnector().visible).toBe(false)

    cleanup(tm, cards)
  }
}
