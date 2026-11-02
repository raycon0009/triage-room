/**
 * TriageLeafHelpers.ts - shared helpers for the Triage Room LEAF scenarios (build step 1).
 * Owns: locating TriageMain, resetting/starting runs deterministically, measuring casualty figures.
 * Must not: contain test assertions (scenarios do that) or change the Lens's own scripts.
 */
import {findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {TriageMain, RunState} from "../Scripts/TriageMain"

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
  const state = tm.regenerate(0, "auto")
  tm.startUI.show()
  return state
}

/** Fixed-seed run that has been started (casualties visible). */
export function startFixedRun(tm: TriageMain, seed: number, forceBlack: string): RunState {
  tm.regenerate(seed, forceBlack)
  tm.startRun()
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
