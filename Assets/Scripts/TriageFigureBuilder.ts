/**
 * TriageFigureBuilder.ts - builds the stylised, rounded, light-coloured, non-gory casualty figures at runtime.
 * Owns: turning the pure body model (TriageFigurePose.ts: named parts driven by joint angles) into meshes built with
 *       MeshBuilder; the lit "Skin" mesh and the light "Rim" outline per figure; the walker's temporary rig; tag bands;
 *       plus the small box / sphere primitives used by the room shell, markers and the debrief map.
 * Needs: box + sphere RenderMeshes and an Unlit material (primitives, outline, bands), optionally a lit vertex-colour
 *        material (figures), and the measured size (cm) of one mesh unit.
 * Must not: contain text/UI or check logic. Nothing here is black (additive display). No breathing or idle motion.
 * Local figure frame (floor y=0): lying figures have the head at -Z; sitting figures face +Z.
 *
 * Draw calls: a resting figure is Skin + Rim + FloorRing = 3. Only a walker that has been called out is split into
 * one object per body part (so the legs and arms can move) until it arrives, then it is merged again.
 * Named scene objects under Casualty_<id>/Body: Skin, Rim, FloorRing, Torso, Head, LegL and LegR (empty anchors that carry the
 * part's box size in their scale, used by the check card and tests), Dot_<id>, TagBand_<id>.
 */
import { CasualtyId, CASUALTY_TABLE } from "./TriageData"
import {
  Baked,
  DIM,
  FLOOR_RING_COLOUR,
  Look,
  Part,
  Pose,
  RIM_COLOUR,
  STANDING_POSE,
  bakeParts,
  boundsOf,
  findPart,
  grounded,
  partsFromPose,
  poseForKind,
} from "./TriageFigurePose"

export interface FigureResources {
  box: RenderMesh
  sphere: RenderMesh
  material: Material
  /** lit material that shows vertex colours (Uber PBR, Vertex Color = Base Color); figures need it */
  litMaterial?: Material
  /** world cm of a scale-1 box / sphere (measured; see TriageMain inputs) */
  boxUnitCm: number
  sphereUnitCm: number
}

const WALL = [0.6, 0.68, 0.78]

/** Tag band colours (light; Expectant is dark grey and gets a white outline, never black). */
export const TAG_BAND_COLOUR: { [tag: string]: number[] } = {
  Red: [1, 0.3, 0.3],
  Yellow: [1, 0.88, 0.25],
  Green: [0.3, 0.95, 0.45],
  Black: [0.3, 0.3, 0.32],
}

function toQuat(r: number[]): quat {
  return new quat(r[3], r[0], r[1], r[2])
}

export class TriageFigureBuilder {
  private matCache: { [key: string]: Material } = {}
  private rimMaterial: Material | null = null
  private looks: { [id: string]: Look } = {}
  private poses: { [id: string]: Pose } = {}
  private rigs: { [id: string]: { [name: string]: SceneObject } } = {}
  private rigMeshes: { [key: string]: RenderMesh } = {}

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

  /** Light outline material: unlit, front faces culled, so only a thin halo of the inflated hull shows. */
  private rim(): Material {
    if (!this.rimMaterial) {
      const m = this.res.material.clone()
      m.mainPass.baseColor = new vec4(RIM_COLOUR[0], RIM_COLOUR[1], RIM_COLOUR[2], 1)
      m.mainPass.cullMode = CullMode.Front
      this.rimMaterial = m
    }
    return this.rimMaterial
  }

  private lit(): Material {
    return this.res.litMaterial ? this.res.litMaterial : this.material([1, 1, 1])
  }

  // ------------------------------------------------------------------ primitives (room shell, markers, map)

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

  // ------------------------------------------------------------------ meshes from the pure body model

  private meshFrom(b: Baked): RenderMesh {
    const mb = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ])
    mb.topology = MeshTopology.Triangles
    mb.indexType = MeshIndexType.UInt16
    mb.appendVerticesInterleaved(b.verts)
    mb.appendIndices(b.idx)
    const mesh = mb.getMesh()
    mb.updateMesh()
    return mesh
  }

  private addMesh(parent: SceneObject, name: string, mesh: RenderMesh, mat: Material): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    rmv.mainMaterial = mat
    return so
  }

  private child(parent: SceneObject, name: string): SceneObject | null {
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      if (parent.getChild(i).name === name) return parent.getChild(i)
    }
    return null
  }

  private bodyOf(casualty: SceneObject): SceneObject {
    return casualty.getChild(0)
  }

  /** (Re)build the merged lit mesh, the outline hull, the floor ring and the Torso / Head anchors from the figure's pose. */
  private rebuildStatic(casualty: SceneObject, id: string): void {
    const body = this.bodyOf(casualty)
    const parts = partsFromPose(this.poses[id], this.looks[id])
    const skinMesh = this.meshFrom(bakeParts(parts, 0))
    const rimMesh = this.meshFrom(bakeParts(parts, DIM.rimWidth))
    const skin = this.child(body, "Skin")
    if (skin) {
      const r = skin.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      r.mesh = skinMesh
      skin.enabled = true
    } else {
      this.addMesh(body, "Skin", skinMesh, this.lit())
    }
    const rim = this.child(body, "Rim")
    if (rim) {
      const r = rim.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      r.mesh = rimMesh
      rim.enabled = true
    } else {
      this.addMesh(body, "Rim", rimMesh, this.rim())
    }
    this.placeFloorRing(body, parts)
    this.placeAnchors(body, parts)
  }

  /** A soft, light oval on the floor under the figure so it sits on the floor (no dark shadow). */
  private placeFloorRing(body: SceneObject, parts: Part[]): void {
    const b = boundsOf(parts)
    const w = b.max[0] - b.min[0] + 16
    const d = b.max[2] - b.min[2] + 16
    const ringPart: Part = { name: "FloorRing", shape: "ring", pos: [0, 0, 0], rot: [0, 0, 0, 1], size: [w, 0.5, d], col: FLOOR_RING_COLOUR }
    const mesh = this.meshFrom(bakeParts([ringPart], 0))
    let ring = this.child(body, "FloorRing")
    if (ring) {
      ;(ring.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh = mesh
    } else {
      ring = this.addMesh(body, "FloorRing", mesh, this.material(FLOOR_RING_COLOUR))
    }
    ring.getTransform().setLocalPosition(new vec3((b.min[0] + b.max[0]) / 2, 0.4, (b.min[2] + b.max[2]) / 2))
  }

  /** Empty "Torso" and "Head" objects: world position / rotation of the part, scale = its box size / one box unit. */
  private placeAnchors(body: SceneObject, parts: Part[]): void {
    // "LegL" / "LegR" mark the lower legs (used to tell where the card may overlap the casualty)
    const anchorParts: { [anchor: string]: string } = { Torso: "Torso", Head: "Head", LegL: "ShinL", LegR: "ShinR" }
    for (const name in anchorParts) {
      const p = findPart(parts, anchorParts[name])
      let so = this.child(body, name)
      if (!so) {
        so = global.scene.createSceneObject(name)
        so.setParent(body)
      }
      const t = so.getTransform()
      t.setLocalPosition(new vec3(p.pos[0], p.pos[1], p.pos[2]))
      t.setLocalRotation(toQuat(p.rot))
      const u = this.res.boxUnitCm
      t.setLocalScale(new vec3(p.size[0] / u, p.size[1] / u, p.size[2] / u))
    }
  }

  // ------------------------------------------------------------------ the walker's rig (stand up + walk)

  getPose(id: string): Pose {
    return this.poses[id]
  }

  /** Split the (resting) figure into one object per body part so it can move. Hides the merged Skin / Rim. */
  startRig(casualty: SceneObject, id: string): void {
    const body = this.bodyOf(casualty)
    const skin = this.child(body, "Skin")
    const rim = this.child(body, "Rim")
    if (skin) skin.enabled = false
    if (rim) rim.enabled = false
    const objs: { [name: string]: SceneObject } = {}
    const parts = partsFromPose(this.poses[id], this.looks[id])
    for (const p of parts) {
      const local: Part = { name: p.name, shape: p.shape, pos: [0, 0, 0], rot: [0, 0, 0, 1], size: p.size, col: p.col }
      const key = id + ":" + p.name + ":" + p.size.join(",")
      let mesh = this.rigMeshes[key]
      if (!mesh) {
        mesh = this.meshFrom(bakeParts([local], 0, true))
        this.rigMeshes[key] = mesh
      }
      const so = this.addMesh(body, "P_" + p.name, mesh, this.lit())
      const hull = this.meshFrom(bakeParts([local], DIM.rimWidth, true))
      this.addMesh(so, "PRim", hull, this.rim())
      objs[p.name] = so
    }
    this.rigs[id] = objs
    this.applyPose(casualty, id, this.poses[id])
  }

  /** The pose with the whole body lifted so nothing dips below the floor. */
  groundedPose(id: string, pose: Pose): Pose {
    return grounded(pose, this.looks[id])
  }

  /** Move the rig's parts (and the Torso / Head anchors) to a pose. */
  applyPose(casualty: SceneObject, id: string, pose: Pose): void {
    this.poses[id] = pose
    const parts = partsFromPose(pose, this.looks[id])
    const objs = this.rigs[id]
    if (objs) {
      for (const p of parts) {
        const so = objs[p.name]
        if (!so || isNull(so)) continue
        const t = so.getTransform()
        t.setLocalPosition(new vec3(p.pos[0], p.pos[1], p.pos[2]))
        t.setLocalRotation(toQuat(p.rot))
      }
    }
    this.placeAnchors(this.bodyOf(casualty), parts)
  }

  /** The walker has arrived: drop the rig and merge the figure again in its final pose. */
  finishRig(casualty: SceneObject, id: string, pose: Pose): void {
    const objs = this.rigs[id]
    if (objs) {
      for (const n in objs) {
        if (objs[n] && !isNull(objs[n])) objs[n].destroy()
      }
    }
    delete this.rigs[id]
    this.poses[id] = pose
    this.rebuildStatic(casualty, id)
  }

  // ------------------------------------------------------------------ tag band

  /**
   * Wraps a coloured band round the casualty's torso: a short elliptic ring slightly larger than the torso's
   * cross-section, centred on the torso and turned with it. Expectant ("Black") is dark grey with a white outline
   * (a thicker, slightly narrower white ring behind it, so a white edge shows above and below the band).
   * Returns the band root ("TagBand_<id>"). The `standing` argument is kept for old callers; the pose decides.
   */
  addTagBand(casualty: SceneObject, id: CasualtyId, tag: string, standing: boolean = false): SceneObject {
    const torso = findPart(partsFromPose(this.poses[id], this.looks[id]), "Torso")
    const body = this.bodyOf(casualty)
    const root = global.scene.createSceneObject("TagBand_" + id)
    root.setParent(body)
    const T = 14 // band thickness along the torso's long axis
    const col = TAG_BAND_COLOUR[tag] || TAG_BAND_COLOUR.Red
    const ring = (name: string, w: number, thick: number, c: number[]): void => {
      const part: Part = { name: name, shape: "ring", pos: [0, 0, 0], rot: [0, 0, 0, 1], size: [torso.size[0] + w, thick, torso.size[2] + w], col: c }
      const so = this.addMesh(root, name, this.meshFrom(bakeParts([part], 0, true)), this.material(c))
      const t = so.getTransform()
      t.setLocalPosition(new vec3(torso.pos[0], torso.pos[1], torso.pos[2]))
      t.setLocalRotation(toQuat(torso.rot))
    }
    if (tag === "Black") {
      ring("Outline", 2, T + 7, [1, 1, 1])
      ring("Band", 7, T, col)
    } else {
      ring("Band", 7, T, col)
    }
    return root
  }

  // ------------------------------------------------------------------ whole casualty

  /** Builds Casualty_<id> under parent at floor-relative (x, 0, z) rotated yawDeg. */
  buildCasualty(parent: SceneObject, id: CasualtyId, x: number, z: number, yawDeg: number, needsBackrest: boolean, dotColour: number[], look: Look, pose: string = ""): SceneObject {
    const root = global.scene.createSceneObject("Casualty_" + id)
    root.setParent(parent)
    const t = root.getTransform()
    t.setLocalPosition(new vec3(x, 0, z))
    t.setLocalRotation(quat.fromEulerVec(new vec3(0, (yawDeg * Math.PI) / 180, 0)))
    const body = global.scene.createSceneObject("Body")
    body.setParent(root)
    const def = CASUALTY_TABLE[id]
    this.looks[id] = look
    this.poses[id] = poseForKind(pose || def.pose)
    delete this.rigs[id]
    this.rebuildStatic(root, id)
    if (needsBackrest) {
      this.createPart(body, "Backrest", "box", [0, 30, -18.5], [80, 60, 6], WALL)
    }
    // marker dot (the check-card opener)
    this.createPart(root, "Dot_" + id, "sphere", [0, 105, 0], [7, 7, 7], dotColour)
    return root
  }
}

export { STANDING_POSE }
