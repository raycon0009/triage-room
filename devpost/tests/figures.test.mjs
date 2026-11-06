// Run with: node devpost/tests/figures.test.mjs  (Node 22.18+, strips TS types)
import * as F from "../../Assets/Scripts/TriageFigurePose.ts"

let pass = 0, fail = 0
const check = (name, ok, extra = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); ok ? pass++ : fail++ }
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
const required = ["Pelvis","Torso","Neck","Head","Hair","UpperArmL","UpperArmR","ForeArmL","ForeArmR","HandL","HandR","ThighL","ThighR","ShinL","ShinR","FootL","FootR"]

// every pose: named parts, on the floor, human size, sitting figures not tall, nothing dark
for (const name of Object.keys(F.POSES)) {
  const look = F.lookFor(1, 0, name === "sitting_arm_cut")
  const parts = F.partsFromPose(F.POSES[name], look)
  const names = parts.map((p) => p.name)
  check(name + ": has all named parts", required.every((n) => names.indexOf(n) >= 0))
  const b = F.boundsOf(parts, F.DIM.rimWidth)
  const ext = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
  check(name + ": lowest point -3..8 cm (with outline)", b.min[1] >= -3 && b.min[1] <= 8, "min y " + b.min[1].toFixed(1))
  check(name + ": largest extent 70-220 cm", ext >= 70 && ext <= 220, ext.toFixed(0) + " cm")
  check(name + ": nothing above 130 cm", b.max[1] <= 130, "max y " + b.max[1].toFixed(1))
  check(name + ": no part darker than luminance 0.5", parts.every((p) => lum(p.col) >= 0.5))
}

// standing (the walker)
const st = F.boundsOf(F.partsFromPose(F.STANDING_POSE, F.lookFor(1, 0, false)))
check("standing: 150-185 cm tall, feet on the floor", st.max[1] >= 150 && st.max[1] <= 185 && Math.abs(st.min[1]) < 1.5, st.max[1].toFixed(0) + " cm")

// colours: light enough, different within a run, repeatable by seed
check("all clothing colours light (luminance >= 0.6)", F.SHIRT_PALETTE.every((c) => lum(c) >= 0.6))
check("all skin tones visible (luminance >= 0.55)", F.SKIN_PALETTE.every((c) => lum(c) >= 0.55))
check("all hair colours visible (luminance >= 0.5)", F.HAIR_PALETTE.every((c) => lum(c) >= 0.5))
check("all trousers and shoes light enough (luminance >= 0.55) but not white", F.PANTS_PALETTE.concat(F.SHOE_PALETTE).every((c) => lum(c) >= 0.55) && F.PANTS_PALETTE.every((c) => Math.min(...c) < 0.7))
{ // clothing must never be mistaken for a tag (red, yellow, green, EXPECTANT dark grey)
  const d = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2])
  const tags = Object.values(F.TAG_BAND_RGB).concat(Object.values(F.TAG_WORD_RGB))
  let worst = 9, who = ""
  for (const [n, P] of [["shirt", F.SHIRT_PALETTE], ["pants", F.PANTS_PALETTE]]) P.forEach((c, i) => tags.forEach((t) => { const x = d(c, t); if (x < worst) { worst = x; who = n + " " + i } }))
  check("every shirt and trouser colour is clearly different from every tag colour (RGB distance >= 0.4)", worst >= 0.4, "closest " + who + " " + worst.toFixed(2))
}
check("clothing, skin and shoes are different colours on every casualty", [1,2,3,4,5,6,7,8].every((s) => [0,1,2,3].every((i) => { const l = F.lookFor(s, i, false); const d = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]); return d(l.shirt, l.pants) > 0.2 && d(l.shirt, l.skin) > 0.2 && d(l.pants, l.skin) > 0.2 && d(l.shoe, l.pants) > 0.2 })))
check("hair styles differ within a run (5 styles)", [1,2,3,4,5].every((s) => new Set([0,1,2,3].map((i) => F.lookFor(s, i, false).hairStyle)).size === 4))
const fig = F.partsFromPose(F.POSES.lying_back, F.lookFor(1, 0, false))
check("sleeve cuffs, trouser cuffs, shoes and a face exist", ["SleeveCuffL","TrouserCuffR","FootL","EyeL","Mouth"].every((n) => fig.some((p) => p.name === n)))
check("outline is thin (<= 0.5 cm)", F.DIM.rimWidth <= 0.5)
{ const fit = F.torsoBandFit(F.DIM.torso, 0.5, 14, 3); check("tag band clears the shaped torso", fit[0] >= 30 && fit[0] <= F.DIM.torso[0] + 4 && fit[1] >= 18, fit.map((v) => v.toFixed(1)).join(" x ")) }
{ // tag band: a narrow ring that follows the shaped torso and sits close to it
  const e = F.bandExtent(F.DIM.torso, 0.5, 7, 1.4)
  check("tag band is narrow (<= 8 cm tall)", e.height <= 8, e.height.toFixed(1) + " cm")
  check("tag band sits close to the torso (never more than 2 cm proud, never inside it by more than 1 cm)", e.maxProud <= 2 && e.minProud >= -1, e.minProud.toFixed(2) + " .. " + e.maxProud.toFixed(2))
  const b = F.bakeParts([{ name: "Band", shape: "band", pos: [0, 0, 0], rot: [0, 0, 0, 1], size: F.DIM.torso.slice(), bulge: [0.5, 7, 1.4], col: [1, 1, 1] }], 0, true)
  let ok = b.idx.length > 0 && b.verts.length / 10 < 65000
  for (let i = 0; i < b.verts.length; i += 10) if (![0, 1, 2, 3, 4, 5].every((k) => Number.isFinite(b.verts[i + k]))) ok = false
  check("tag band mesh is valid and small", ok, (b.verts.length / 10) + " verts")
  // rounded edges: the band's normals at its top and bottom edge lean up / down, not all sideways
  let up = 0, down = 0
  for (let i = 0; i < b.verts.length; i += 10) { if (b.verts[i + 4] > 0.3) up++; if (b.verts[i + 4] < -0.3) down++ }
  check("tag band edges are rounded (normals lean up and down)", up > 20 && down > 20, up + " / " + down)
}
{ const v = F.bakeParts(fig).verts; let mn = 9; for (let i = 0; i < v.length; i += 10) mn = Math.min(mn, lum([v[i+6], v[i+7], v[i+8]])); check("darkest baked vertex stays clearly visible (luminance > 0.4)", mn > 0.4, mn.toFixed(2)) }
let distinct = true, repeat = true
for (let seed = 1; seed <= 500; seed++) {
  const looks = [0, 1, 2, 3].map((i) => F.lookFor(seed, i, false))
  for (const key of ["shirt", "skin", "hair", "pants"]) {
    if (new Set(looks.map((l) => l[key].join(","))).size !== 4) distinct = false
  }
  if (JSON.stringify(F.lookFor(seed, 2, false)) !== JSON.stringify(looks[2])) repeat = false
}
check("4 casualties of a run all differ in clothing, skin, hair, trousers (500 seeds)", distinct)
check("same seed gives the same looks", repeat)
check("different seeds give different clothing orders", new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => F.lookFor(s, 0, false).shirt.join(","))).size > 3)

// geometry sanity: every triangle faces outwards, indices in range, fits UInt16
const parts = F.partsFromPose(F.POSES.lying_back, F.lookFor(1, 0, true))
const baked = F.bakeParts(parts)
const nv = baked.verts.length / 10
let outward = true
for (let i = 0; i < baked.idx.length; i += 3) {
  const v = (k) => baked.verts.slice(baked.idx[i + k] * 10, baked.idx[i + k] * 10 + 10)
  const a = v(0), b = v(1), c = v(2)
  const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], wx = c[0]-a[0], wy = c[1]-a[1], wz = c[2]-a[2]
  const n = [uy*wz-uz*wy, uz*wx-ux*wz, ux*wy-uy*wx]
  if (n[0]*(a[3]+b[3]+c[3]) + n[1]*(a[4]+b[4]+c[4]) + n[2]*(a[5]+b[5]+c[5]) < 0) outward = false
}
check("all triangles wound outward (CCW from outside)", outward)
check("vertex count fits 16-bit indices", nv < 65000, nv + " vertices")

// walk cycle and stand-up blend stay on the floor
let ok = true
for (let k = 0; k <= 1; k += 0.1) {
  const b2 = F.boundsOf(F.partsFromPose(F.grounded(F.lerpPose(F.POSES.sitting_arm_cut, F.STANDING_POSE, k), F.lookFor(1, 0, true)), F.lookFor(1, 0, true)))
  if (b2.min[1] < -1.5) ok = false
}
for (let a = 0; a < 6.3; a += 0.3) {
  const b3 = F.boundsOf(F.partsFromPose(F.walkPose(Math.sin(a)), F.lookFor(1, 0, false)))
  if (b3.min[1] < -6 || b3.max[1] > 185) ok = false
}
check("stand-up blend and walk cycle stay above the floor", ok)

console.log("\n" + pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
