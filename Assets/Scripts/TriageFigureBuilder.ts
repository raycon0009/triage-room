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
 * Draw calls: a resting figure is Skin + Rim = 2. Only a walker that has been called out is split into
 * one object per body part (so the legs and arms can move) until it arrives, then it is merged again.
 * Named scene objects under Casualty_<id>/Body: Skin, Rim, Torso, Head, LegL and LegR (empty anchors that carry the
 * part's box size in their scale, used by the check card and tests), Dot_<id>, TagBand_<id>.
 */
import { easeOutCubic, tween } from "./TriageUi"
import { CasualtyId, CASUALTY_TABLE } from "./TriageData"
import {
  Baked,
  DIM,
  Look,
  Part,
  Pose,
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

const WALL = [0.45, 0.52, 0.66]

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
  private looks: { [id: string]: Look } = {}
  private poses: { [id: string]: Pose } = {}
  private rigs: { [id: string]: { [name: string]: SceneObject } } = {}
  private rigMeshes: { [key: string]: RenderMesh } = {}

  constructor(private res: FigureResources) {}

  material(col: number[]): Material {
    const key = col.join(",")
    let m = this.matCache[key]
    if (!m) {
      m = this.res.material.clone()
      m.mainPass.baseColor = new vec4(col[0], col[1], col[2], 1)
      this.matCache[key] = m
    }
    return m
  }

  /** Thin outline material, tinted to match the figure (its shirt colour, a little lighter): unlit, front faces culled. */
  private rim(id: string): Material {
    const look = this.looks[id]
    const c = look ? [look.shirt[0] + (1 - look.shirt[0]) * 0.15, look.shirt[1] + (1 - look.shirt[1]) * 0.15, look.shirt[2] + (1 - look.shirt[2]) * 0.15] : [0.85, 0.92, 1]
    const key = "rim:" + c.join(",")
    let m = this.matCache[key]
    if (!m) {
      m = this.res.material.clone()
      m.mainPass.baseColor = new vec4(c[0], c[1], c[2], 1)
      m.mainPass.cullMode = CullMode.Front
      this.matCache[key] = m
    }
    return m
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
      this.addMesh(body, "Rim", rimMesh, this.rim(id))
    }
    // no floor oval: the figure's own outline and baked underside shading keep it on the floor
    const oldRing = this.child(body, "FloorRing")
    if (oldRing) oldRing.destroy()
    this.placeAnchors(body, parts)
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
      const local: Part = { ...p, pos: [0, 0, 0], rot: [0, 0, 0, 1] }
      const key = id + ":" + p.name + ":" + p.size.join(",")
      let mesh = this.rigMeshes[key]
      if (!mesh) {
        mesh = this.meshFrom(bakeParts([local], 0, true))
        this.rigMeshes[key] = mesh
      }
      const so = this.addMesh(body, "P_" + p.name, mesh, this.lit())
      const hull = this.meshFrom(bakeParts([local], DIM.rimWidth, true))
      this.addMesh(so, "PRim", hull, this.rim(id))
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
   * Wraps a narrow coloured band round the casualty's torso: a thin shell that follows the torso's shape (about 1.4 cm proud of it, rounded edges),
   * centred on the torso and turned with it. Expectant ("Black") is dark grey with a white outline
   * (a thicker, slightly narrower white ring behind it, so a white edge shows above and below the band).
   * Returns the band root ("TagBand_<id>"). The `standing` argument is kept for old callers; the pose decides.
   */
  addTagBand(casualty: SceneObject, id: CasualtyId, tag: string, standing: boolean = false): SceneObject {
    const torso = findPart(partsFromPose(this.poses[id], this.looks[id]), "Torso")
    const body = this.bodyOf(casualty)
    const root = global.scene.createSceneObject("TagBand_" + id)
    root.setParent(body)
    const T = 7 // band thickness along the torso's long axis (a narrow ring)
    const col = TAG_BAND_COLOUR[tag] || TAG_BAND_COLOUR.Red
    const rings: SceneObject[] = []
    // a thin shell that follows the shaped torso and stands only ~1.4 cm proud of it, with rounded edges
    const ring = (name: string, thick: number, off: number, c: number[]): void => {
      const part: Part = { name: name, shape: "band", pos: [0, 0, 0], rot: [0, 0, 0, 1], size: torso.size.slice(), bulge: [0.5, thick, off], col: c, tone: 1 / 0.95 }
      const so = this.addMesh(root, name, this.meshFrom(bakeParts([part], 0, true)), this.material(c))
      const t = so.getTransform()
      t.setLocalPosition(new vec3(torso.pos[0], torso.pos[1], torso.pos[2]))
      t.setLocalRotation(toQuat(torso.rot))
      rings.push(so)
    }
    if (tag === "Black") {
      ring("Outline", T + 3, 2.4, [1, 1, 1])
      ring("Band", T, 1.4, col)
    } else {
      ring("Band", T, 1.4, col)
    }
    // the ring grows into place round the casualty (0.3 s, wider to its fitted size, thickness unchanged)
    const GROW_FROM = 1.25
    tween(
      "band:" + id,
      0.3,
      (k) => {
        const g = GROW_FROM + (1 - GROW_FROM) * easeOutCubic(k)
        for (const r of rings) if (!isNull(r)) r.getTransform().setLocalScale(new vec3(g, 1, g))
      },
      null,
      0,
      root,
    )
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
      this.createPart(body, "Backrest", "box", [0, 25, -18.5], [76, 50, 3.5], WALL)
    }
    // marker dot (the check-card opener)
    this.createPart(root, "Dot_" + id, "sphere", [0, 105, 0], [7, 7, 7], dotColour)
    return root
  }
}

export { STANDING_POSE }
