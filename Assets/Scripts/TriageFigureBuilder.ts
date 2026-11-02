/**
 * TriageFigureBuilder.ts - builds stylised, light-coloured, non-gory casualty figures from primitives.
 * Owns: per-pose part lists and runtime creation of the figure SceneObject (runtime-only children).
 * Needs: box + sphere RenderMeshes, an Unlit material, and the measured size (cm) of one mesh unit.
 * Must not: contain text/UI or check logic. Nothing here is black (additive display).
 * Local figure frame (floor y=0): lying figures have the head at -Z; sitting figures face +Z.
 */
import { CasualtyId, PoseKind, CASUALTY_TABLE } from "./TriageData"

export interface FigureResources {
  box: RenderMesh
  sphere: RenderMesh
  material: Material
  /** world cm of a scale-1 box / sphere (measured; see TriageMain inputs) */
  boxUnitCm: number
  sphereUnitCm: number
}

export interface Part {
  name: string
  kind: "box" | "sphere"
  pos: number[]
  size: number[]
  rot?: number[]
  col: number[]
}

const SKIN = [0.98, 0.82, 0.7]
const PANTS = [0.62, 0.7, 0.86]
const BANDAGE = [1, 1, 1]
const PATCH = [1, 0.72, 0.75]
const WALL = [0.6, 0.68, 0.78]
const SHIRT: { [id: string]: number[] } = {
  W1: [0.6, 0.92, 0.7],
  W2: [0.96, 0.88, 0.55],
  A: [0.6, 0.8, 1.0],
  B: [0.96, 0.72, 0.82],
  C: [0.82, 0.76, 0.96],
  D: [1.0, 0.8, 0.6],
  E: [0.7, 0.96, 0.9],
  F: [0.92, 0.92, 0.72],
  X: [0.82, 0.85, 0.93],
}

function box(name: string, pos: number[], size: number[], col: number[], rot?: number[]): Part {
  return { name, kind: "box", pos, size, col, rot }
}
function ball(name: string, pos: number[], d: number, col: number[], rot?: number[]): Part {
  return { name, kind: "sphere", pos, size: [d, d, d], col, rot }
}

function lyingBack(shirt: number[], spread: number): Part[] {
  return [
    box("Torso", [0, 9, 0], [38, 18, 52], shirt),
    ball("Head", [0, 11, -39], 22, SKIN),
    box("LegL", [-9, 6, 61], [14, 12, 70], PANTS, [0, -spread * 0.5, 0]),
    box("LegR", [9, 6, 61], [14, 12, 70], PANTS, [0, spread * 0.5, 0]),
    box("ArmL", [-26, 5, -2], [10, 10, 48], SKIN, [0, spread, 0]),
    box("ArmR", [26, 5, -2], [10, 10, 48], SKIN, [0, -spread, 0]),
  ]
}

function lyingSide(shirt: number[], handToHead: boolean): Part[] {
  const p: Part[] = [
    box("Torso", [0, 15, 0], [22, 30, 52], shirt),
    ball("Head", [0, 17, -38], 22, SKIN),
    box("LegBottom", [0, 8, 52], [14, 14, 60], PANTS, [0, -8, 0]),
    box("LegTop", [0, 22, 50], [14, 14, 60], PANTS, [0, 8, 0]),
  ]
  if (handToHead) {
    p.push(box("ArmUp", [10, 26, -30], [9, 9, 36], SKIN, [0, -20, 0]))
  } else {
    p.push(box("ArmFront", [14, 24, -16], [9, 9, 40], SKIN, [0, 15, 0]))
  }
  return p
}

function sitting(shirt: number[]): Part[] {
  return [
    box("Pelvis", [0, 6, 0], [34, 12, 26], PANTS),
    box("LegL", [-10, 6, 40], [14, 12, 60], PANTS, [0, -6, 0]),
    box("LegR", [10, 6, 40], [14, 12, 60], PANTS, [0, 6, 0]),
    box("Torso", [0, 35, -1], [34, 46, 20], shirt),
    ball("Head", [0, 70, 0], 22, SKIN),
  ]
}

function poseParts(id: CasualtyId, pose: PoseKind): Part[] {
  const shirt = SHIRT[id]
  switch (pose) {
    case "sitting_arm_cut":
      return sitting(shirt).concat([
        box("ArmL", [-22, 34, 0], [9, 40, 9], SKIN),
        box("ArmR", [22, 34, 4], [9, 38, 9], SKIN),
        box("Bandage", [22, 28, 4], [11, 13, 11], BANDAGE),
        box("Patch", [22, 28, 10], [4, 5, 2], PATCH),
      ])
    case "sitting_holding_ankle":
      return sitting(shirt).concat([
        box("ArmL", [-22, 34, 0], [9, 40, 9], SKIN),
        box("ArmR", [20, 18, 30], [9, 9, 50], SKIN, [0, 10, 0]),
      ])
    case "sitting_dazed":
      return sitting(shirt)
        .filter((p) => p.name !== "Head")
        .concat([
          ball("Head", [6, 69, 2], 22, SKIN),
          box("ArmL", [-20, 28, 22], [9, 9, 40], SKIN),
          box("ArmR", [20, 28, 22], [9, 9, 40], SKIN),
        ])
    case "slumped_against_wall":
      return [
        box("Pelvis", [0, 6, 0], [34, 12, 26], PANTS),
        box("LegL", [-14, 6, 40], [14, 12, 60], PANTS, [0, -14, 0]),
        box("LegR", [14, 6, 40], [14, 12, 60], PANTS, [0, 14, 0]),
        box("Torso", [0, 33, -3], [34, 46, 20], shirt, [-12, 0, 0]),
        ball("Head", [10, 62, -10], 22, SKIN),
        box("ArmL", [-24, 22, 8], [9, 36, 9], SKIN, [20, 0, 0]),
        box("ArmR", [24, 22, 8], [9, 36, 9], SKIN, [20, 0, 0]),
      ]
    case "lying_side":
      return lyingSide(shirt, false)
    case "lying_groaning":
      return lyingSide(shirt, true)
    case "lying_face_up_still":
      return [
        box("Torso", [0, 9, 0], [38, 18, 52], shirt),
        ball("Head", [0, 11, -39], 22, SKIN),
        box("LegL", [-8, 6, 61], [14, 12, 70], PANTS),
        box("LegR", [8, 6, 61], [14, 12, 70], PANTS),
        box("ArmL", [-25, 5, 0], [10, 10, 50], SKIN),
        box("ArmR", [25, 5, 0], [10, 10, 50], SKIN),
      ]
    case "lying_back":
    default:
      return lyingBack(shirt, 18)
  }
}

/** The part list a casualty starts with (used by the walker's stand-up animation). */
export function startingParts(id: CasualtyId): Part[] {
  return poseParts(id, CASUALTY_TABLE[id].pose)
}

/** The walker standing upright (floor y=0): same part names as the sitting poses so the figure can blend into it. */
export function standingParts(id: CasualtyId): Part[] {
  const shirt = SHIRT[id]
  const p: Part[] = [
    box("Pelvis", [0, 82, 0], [34, 12, 20], PANTS),
    box("LegL", [-9, 40, 0], [14, 80, 14], PANTS),
    box("LegR", [9, 40, 0], [14, 80, 14], PANTS),
    box("Torso", [0, 110, 0], [34, 50, 20], shirt),
    ball("Head", [0, 152, 0], 22, SKIN),
    box("ArmL", [-23, 108, 0], [9, 44, 9], SKIN),
    box("ArmR", [23, 108, 0], [9, 44, 9], SKIN),
  ]
  if (id === "W1") {
    p.push(box("Bandage", [23, 100, 0], [11, 13, 11], BANDAGE))
    p.push(box("Patch", [23, 100, 6], [4, 5, 2], PATCH))
  }
  return p
}

export const STANDING_HIP_Y = 80
export const STANDING_SHOULDER_Y = 130

/** Tag band colours (light; Expectant is dark grey and gets a white outline, never black). */
export const TAG_BAND_COLOUR: { [tag: string]: number[] } = {
  Red: [1, 0.3, 0.3],
  Yellow: [1, 0.88, 0.25],
  Green: [0.3, 0.95, 0.45],
  Black: [0.3, 0.3, 0.32],
}

export class TriageFigureBuilder {
  private matCache: { [key: string]: Material } = {}

  constructor(private res: FigureResources) {}

  private material(col: number[]): Material {
    const key = col.join(",")
    let m = this.matCache[key]
    if (!m) {
      m = this.res.material.clone()
      m.mainPass.baseColor = new vec4(col[0], col[1], col[2], 1)
      this.matCache[key] = m
    }
    return m
  }

  /** Create one primitive part under parent (also used for the room shell and markers). */
  createPart(parent: SceneObject, name: string, kind: "box" | "sphere", pos: number[], size: number[], col: number[], rot?: number[]): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.getTransform()
    t.setLocalPosition(new vec3(pos[0], pos[1], pos[2]))
    if (rot) {
      const d = Math.PI / 180
      t.setLocalRotation(quat.fromEulerVec(new vec3(rot[0] * d, rot[1] * d, rot[2] * d)))
    }
    const unit = kind === "box" ? this.res.boxUnitCm : this.res.sphereUnitCm
    t.setLocalScale(new vec3(size[0] / unit, size[1] / unit, size[2] / unit))
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = kind === "box" ? this.res.box : this.res.sphere
    rmv.mainMaterial = this.material(col)
    return so
  }

  /**
   * Wraps a coloured band round the casualty's torso (a slab slightly larger than the torso, across its
   * long axis). Expectant ("Black") is dark grey with a white outline (white slab slightly thicker behind it).
   * Returns the band root ("TagBand_<id>").
   */
  addTagBand(casualty: SceneObject, id: CasualtyId, tag: string, standing: boolean = false): SceneObject {
    const def = CASUALTY_TABLE[id]
    const torso = (standing ? standingParts(id) : poseParts(id, def.pose)).filter((p) => p.name === "Torso")[0]
    const parent = casualty.getChild(0) // "Body"
    const root = global.scene.createSceneObject("TagBand_" + id)
    root.setParent(parent)
    const s = torso.size
    const upright = s[1] > s[2]
    const T = 14 // slab thickness along the torso long axis
    const dim = (w: number, thick: number): number[] => (upright ? [s[0] + w, thick, s[2] + w] : [s[0] + w, s[1] + w, thick])
    const col = TAG_BAND_COLOUR[tag] || TAG_BAND_COLOUR.Red
    if (tag === "Black") {
      this.createPart(root, "Outline", "box", torso.pos, dim(2, T + 7), [1, 1, 1], torso.rot)
      this.createPart(root, "Band", "box", torso.pos, dim(7, T), col, torso.rot)
    } else {
      this.createPart(root, "Band", "box", torso.pos, dim(7, T), col, torso.rot)
    }
    return root
  }

  /** Builds Casualty_<id> under parent at floor-relative (x, 0, z) rotated yawDeg. */
  buildCasualty(parent: SceneObject, id: CasualtyId, x: number, z: number, yawDeg: number, needsBackrest: boolean, dotColour: number[]): SceneObject {
    const root = global.scene.createSceneObject("Casualty_" + id)
    root.setParent(parent)
    const t = root.getTransform()
    t.setLocalPosition(new vec3(x, 0, z))
    t.setLocalRotation(quat.fromEulerVec(new vec3(0, (yawDeg * Math.PI) / 180, 0)))
    const body = global.scene.createSceneObject("Body")
    body.setParent(root)
    const def = CASUALTY_TABLE[id]
    for (const p of poseParts(id, def.pose)) {
      this.createPart(body, p.name, p.kind, p.pos, p.size, p.col, p.rot)
    }
    if (needsBackrest) {
      this.createPart(body, "Backrest", "box", [0, 30, -22], [80, 60, 6], WALL)
    }
    // placeholder marker dot (step 3 will turn this into the real dot / check-card opener)
    this.createPart(root, "Dot_" + id, "sphere", [0, 105, 0], [7, 7, 7], dotColour)
    return root
  }
}
