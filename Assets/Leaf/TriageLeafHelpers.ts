/**
 * TriageLeafHelpers.ts - shared helpers for the Triage Room LEAF scenarios (build step 1).
 * Owns: locating TriageMain, resetting/starting runs deterministically, measuring casualty figures.
 * Must not: contain test assertions (scenarios do that) or change the Lens's own scripts.
 */
import {findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {TriageMain, RunState} from "../Scripts/TriageMain"
import {TriageCheckCards} from "../Scripts/TriageCheckCards"
import {TriageRunClock} from "../Scripts/TriageRunClock"
import {TriageCallOut} from "../Scripts/TriageCallOut"
import {TriageBehindCue} from "../Scripts/TriageBehindCue"
import {TriageDebrief} from "../Scripts/TriageDebrief"
import type {CheckId, StartTag} from "../Scripts/TriageStartEngine"
import {generateRun} from "../Scripts/TriageLayout"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

export function getTriageMain(): TriageMain {
  const room = findSceneObjectByName("TriageRoom")
  if (!room) {
    throw new Error('Scene object "TriageRoom" not found')
  }
  const tm = room.getComponent(TriageMain.getTypeName()) as TriageMain
  if (!tm) {
    throw new Error("TriageMain component not found on TriageRoom")
  }
  return tm
}

/** Fresh, not-started run with a random seed and the Start panel showing again. */
export function resetToFreshStart(tm: TriageMain): RunState {
  tm.setMode("drill")
  const state = tm.regenerate(0, "auto")
  tm.startUI.show()
  return state
}

/** Fixed-seed run that has been started (casualties visible). */
export function startFixedRun(tm: TriageMain, seed: number, forceBlack: string, mode: string = "drill"): RunState {
  tm.regenerate(seed, forceBlack)
  tm.startRun(mode)
  return tm.getRunState()
}

/** The runtime-built Casualty_* objects under the casualties root. */
export function casualtyObjects(tm: TriageMain): SceneObject[] {
  const out: SceneObject[] = []
  const root = tm.casualtiesRoot
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const child = root.getChild(i)
    if (child.name.indexOf("Casualty_") === 0) {
      out.push(child)
    }
  }
  return out
}

export interface FigureBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

/** World-space bounds of a casualty's body parts (the floating marker dot is excluded). */
export function measureFigure(casualty: SceneObject): FigureBounds {
  const b: FigureBounds = {minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9}
  const visit = (so: SceneObject): void => {
    if (so.name.indexOf("Dot_") === 0) {
      return
    }
    const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    if (rmv && rmv.mesh) {
      const lo = rmv.mesh.aabbMin
      const hi = rmv.mesh.aabbMax
      const m = so.getTransform().getWorldTransform()
      for (let i = 0; i < 8; i++) {
        const corner = new vec3(i & 1 ? hi.x : lo.x, i & 2 ? hi.y : lo.y, i & 4 ? hi.z : lo.z)
        const p = m.multiplyPoint(corner)
        b.minX = Math.min(b.minX, p.x)
        b.maxX = Math.max(b.maxX, p.x)
        b.minY = Math.min(b.minY, p.y)
        b.maxY = Math.max(b.maxY, p.y)
        b.minZ = Math.min(b.minZ, p.z)
        b.maxZ = Math.max(b.maxZ, p.z)
      }
    }
    for (let i = 0; i < so.getChildrenCount(); i++) {
      visit(so.getChild(i))
    }
  }
  visit(casualty)
  return b
}

/** Compact comparable description of a run's layout. */
export function layoutKey(state: RunState): string {
  return JSON.stringify(
    state.casualties.map((c) => [c.id, c.slot, c.position.x, c.position.y, c.position.z]),
  )
}

// ---- build step 2 helpers (check cards) ----

export function getCards(): TriageCheckCards {
  const o = findSceneObjectByName("TriageCards")
  if (!o) {
    throw new Error('Scene object "TriageCards" not found')
  }
  const c = o.getComponent(TriageCheckCards.getTypeName()) as TriageCheckCards
  if (!c) {
    throw new Error("TriageCheckCards component not found on TriageCards")
  }
  return c
}

/** First seed (1..400) whose layout contains casualty `id` as a non-behind casualty, with Black forced on/off. */
export function findSeedWith(id: string, forceBlack: "on" | "off"): number {
  for (let seed = 1; seed <= 400; seed++) {
    const run = generateRun(seed, forceBlack)
    if (run.casualties.some((c) => c.id === id && !c.behind)) {
      return seed
    }
  }
  throw new Error("No seed found containing " + id)
}

/** Viewer at the start position, far from everybody (nobody within 150 cm). */
export const FAR_VIEWER = new vec3(0, 0, 0)

/** Fixed-seed started run with the viewer standing far away (no proximity opening). */
export async function startRunFar(tm: TriageMain, cards: TriageCheckCards, seed: number, forceBlack: string, mode: string = "drill"): Promise<RunState> {
  cards.setViewerOverride(FAR_VIEWER)
  cards.closeCard()
  const state = startFixedRun(tm, seed, forceBlack, mode)
  await sleep(400)
  return state
}

/** Pinch a UI Kit button by its scene-object name with LEAF's scripted interactor. */
export async function pressButton(name: string): Promise<void> {
  const target = findInteractableByName(name)
  if (!target) {
    throw new Error('Interactable "' + name + '" not found')
  }
  const interactor = new DefaultLeafInteractor()
  await interactor.trigger(target)
  await sleep(250)
}

/** World position of a casualty. */
export function casualtyWorldPos(tm: TriageMain, id: string): vec3 {
  const o = tm.getCasualtyObject(id)
  if (!o) {
    throw new Error("Casualty " + id + " not in this run")
  }
  return o.getTransform().getWorldPosition()
}

/** A spot 90 cm from casualty `id`, towards the start position, at eye height. */
export function standNear(tm: TriageMain, id: string): vec3 {
  const p = casualtyWorldPos(tm, id)
  const len = Math.sqrt(p.x * p.x + p.z * p.z) || 1
  return new vec3(p.x - (p.x / len) * 90, 0, p.z - (p.z / len) * 90)
}

export function cleanup(tm: TriageMain, cards: TriageCheckCards): void {
  cards.setViewerOverride(null)
  cards.closeCard()
  resetToFreshStart(tm)
}

// ---- build step 3 helpers (clock, call-out, groan, arrow) ----

function sceneObjectOrThrow(objectName: string): SceneObject {
  const o = findSceneObjectByName(objectName)
  if (!o) {
    throw new Error('Scene object "' + objectName + '" not found')
  }
  return o
}

export function getClock(): TriageRunClock {
  const c = sceneObjectOrThrow("TriageClock").getComponent(TriageRunClock.getTypeName()) as TriageRunClock
  if (!c) {
    throw new Error("TriageRunClock not found on TriageClock")
  }
  return c
}

export function getCallOut(): TriageCallOut {
  const c = sceneObjectOrThrow("TriageCallOut").getComponent(TriageCallOut.getTypeName()) as TriageCallOut
  if (!c) {
    throw new Error("TriageCallOut not found on TriageCallOut")
  }
  return c
}

export function getCue(): TriageBehindCue {
  const c = sceneObjectOrThrow("TriageCue").getComponent(TriageBehindCue.getTypeName()) as TriageBehindCue
  if (!c) {
    throw new Error("TriageBehindCue not found on TriageCue")
  }
  return c
}

export function getDebrief(): TriageDebrief {
  const c = sceneObjectOrThrow("TriageDebrief").getComponent(TriageDebrief.getTypeName()) as TriageDebrief
  if (!c) {
    throw new Error("TriageDebrief not found on TriageDebrief")
  }
  return c
}

/**
 * Open casualty `id`'s card (viewer far away), press the START checks in order until a step decides, optionally press
 * one more (extra) check after that, then tag. Returns whether the tag was accepted.
 */
export async function tagWithChecks(cards: TriageCheckCards, id: string, tag: StartTag, extraCheck?: CheckId): Promise<boolean> {
  cards.openCard(id, "button")
  await sleep(300) // the card is open for a moment: the time spent is recorded
  const order: CheckId[] = ["breathing", "rate", "pulse", "commands"]
  for (const check of order) {
    if (cards.isTagPanelVisible()) {
      break
    }
    cards.pressCheck(check)
  }
  if (extraCheck) {
    cards.pressCheck(extraCheck)
  }
  return cards.chooseTag(tag)
}

/** Put every step 3 test stand-in back (viewer overrides) and return to a fresh, not-started run. */
export function cleanup3(tm: TriageMain, cards: TriageCheckCards): void {
  getCue().setViewerOverride(null)
  const deb = getDebrief()
  deb.setViewerOverride(null)
  const sceneClear = deb.getSceneClear()
  if (sceneClear) {
    sceneClear.setViewerOverride(null)
  }
  deb.endGraceSeconds = 1.2
  deb.timesUpSeconds = 2
  deb.flashHz = 1.8
  getClock().configure(180, 30)
  cleanup(tm, cards)
}
