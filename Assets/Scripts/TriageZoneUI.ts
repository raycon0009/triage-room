/**
 * TriageZoneUI.ts - passive view: the green zone drawn as a marked area on the floor, like a zone taped out on it.
 * Owns: a smooth light-green ring outline, a very faint fill, and a two-line label ("GREEN — MINOR" and, smaller,
 *       "Walking wounded") lying on the floor on the side nearest the start position, turned to face the player.
 * The authored object carrying this script is "MinorLabel" (child of "MinorZone", next to the old "MinorDisc", which
 * is switched off here). The walker is sent to the FAR side of the ring (TriageCallOut), so it never covers the label.
 * Public API: getLabel(), getSubLabel(), getRingDiameterCm().
 * Must not: touch figures or any other script.
 */
import { ROOM } from "./TriageLayout"

const RING_SEGMENTS = 96

@component
export class TriageZoneUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TriageZoneUI - green zone marking and label</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("First line on the green zone")
  zoneLine1: string = "GREEN — MINOR"

  @input
  @hint("Smaller second line")
  zoneLine2: string = "Walking wounded"

  @input
  @widget(new SliderWidget(100, 600, 10))
  @hint("First line size (em-square cm = size / 43.9)")
  line1Size: number = 270

  @input
  @widget(new SliderWidget(60, 400, 10))
  @hint("Second line size")
  line2Size: number = 150

  @input('vec4', '{0.85,1,0.9,1}')
  @widget(new ColorWidget())
  @hint("Label colour (light; never black)")
  zoneTextColor: vec4

  @input
  @widget(new SliderWidget(1, 6, 0.1))
  @hint("Width of the ring outline in cm")
  zoneRingWidthCm: number = 2.4
  @ui.group_end

  private text!: Text
  private subText!: Text

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  getLabel(): string {
    return this.zoneLine1
  }

  getSubLabel(): string {
    return this.zoneLine2
  }

  getRingDiameterCm(): number {
    return ROOM.minorZone.diameterCm
  }

  private build(): void {
    const zone = this.sceneObject.hasParent() ? this.sceneObject.getParent() : null
    if (!zone) return
    // the old flat disc: off. Keep its material for the ring and the fill.
    let baseMat: Material | null = null
    for (let i = 0; i < zone.getChildrenCount(); i++) {
      const c = zone.getChild(i)
      if (c.name === "MinorDisc") {
        const r = c.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
        if (r) baseMat = r.mainMaterial
        c.enabled = false
      }
    }
    const R = ROOM.minorZone.diameterCm / 2
    if (baseMat) {
      this.addArea(zone, "ZoneFill", 0, R - this.zoneRingWidthCm * 0.5, 0.15, baseMat, new vec4(0.1, 0.22, 0.14, 1))
      this.addArea(zone, "ZoneRing", R - this.zoneRingWidthCm, R, 0.45, baseMat, new vec4(0.62, 1, 0.74, 1))
    }

    // direction from the zone centre to the start position (the player), on the floor
    const lp = zone.getTransform().getLocalPosition()
    let ux = -lp.x
    let uz = -lp.z
    const ul = Math.sqrt(ux * ux + uz * uz) || 1
    ux /= ul
    uz /= ul
    // text lies flat (rotated -90 deg about X: its "up" points to -Z), then turned about the vertical so that its
    // "up" points away from the player and the lines read correctly from the start position
    const yaw = Math.atan2(ux, uz)
    const rot = quat.angleAxis(yaw, vec3.up()).multiply(quat.angleAxis(-Math.PI / 2, new vec3(1, 0, 0)))
    this.sceneObject.getTransform().setLocalRotation(rot)
    // first line farther from the player, second line nearer; the block sits on the player's side of the centre
    this.sceneObject.getTransform().setLocalPosition(new vec3(ux * 6, 1.5, uz * 6))
    this.text = this.makeText(this.sceneObject, this.zoneLine1, this.line1Size)

    const sub = global.scene.createSceneObject("MinorSubLabel")
    sub.setParent(zone)
    sub.getTransform().setLocalRotation(rot)
    sub.getTransform().setLocalPosition(new vec3(ux * 21, 1.5, uz * 21))
    this.subText = this.makeText(sub, this.zoneLine2, this.line2Size)
  }

  private makeText(so: SceneObject, str: string, size: number): Text {
    const t = so.createComponent("Component.Text") as Text
    t.text = str
    t.depthTest = true
    t.size = size
    t.textFill.color = this.zoneTextColor
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-45, 45, -12, 12)
    return t
  }

  /** A flat annulus (or disc when rInner is 0) lying on the floor at height y, smooth to the eye (96 segments). */
  private addArea(parent: SceneObject, name: string, rInner: number, rOuter: number, y: number, mat: Material, col: vec4): void {
    const mb = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ])
    mb.topology = MeshTopology.Triangles
    mb.indexType = MeshIndexType.UInt16
    const verts: number[] = []
    const idx: number[] = []
    const centre = rInner <= 0.01
    if (centre) verts.push(0, 0, 0, 0, 1, 0, 1, 1, 1, 1)
    const first = verts.length / 10
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      verts.push(c * rOuter, 0, s * rOuter, 0, 1, 0, 1, 1, 1, 1)
      if (!centre) verts.push(c * rInner, 0, s * rInner, 0, 1, 0, 1, 1, 1, 1)
    }
    // winding counter-clockwise seen from above (+Y): checked with the cross product's Y sign
    const tri = (a: number, b: number, c: number): void => {
      const ax = verts[a * 10], az = verts[a * 10 + 2]
      const bx = verts[b * 10], bz = verts[b * 10 + 2]
      const cx = verts[c * 10], cz = verts[c * 10 + 2]
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
      if (ny >= 0) idx.push(a, b, c)
      else idx.push(a, c, b)
    }
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const j = (i + 1) % RING_SEGMENTS
      if (centre) {
        tri(0, first + i, first + j)
      } else {
        const o0 = first + i * 2, i0 = o0 + 1
        const o1 = first + j * 2, i1 = o1 + 1
        tri(o0, o1, i1)
        tri(o0, i1, i0)
      }
    }
    mb.appendVerticesInterleaved(verts)
    mb.appendIndices(idx)
    const mesh = mb.getMesh()
    mb.updateMesh()
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, y, 0))
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    const m = mat.clone()
    m.mainPass.baseColor = col
    rmv.mainMaterial = m
  }
}
