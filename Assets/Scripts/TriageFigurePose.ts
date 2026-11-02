/**
 * TriageFigurePose.ts - PURE module (no Lens Studio API, testable in plain Node): the casualty body.
 * Owns: the body dimensions, the named body parts, forward kinematics from JOINT ANGLES to part transforms,
 *       the pose library, light clothing / skin / hair palettes chosen by seed, and the rounded part geometry
 *       (capsules and elliptic rings) baked into vertex arrays.
 * Must not: touch the scene or any Lens Studio class.
 *
 * HOW TO ADD A POSE: write one entry in POSES (or a function returning a Pose) using joint angles in degrees:
 *   orient   [pitch, yaw, roll] of the whole body (standing = [0,0,0]; lying on the back = [-90,0,0]; on the side adds roll 90)
 *   root     pelvis centre (x, y, z) in cm; y = height above the floor
 *   spine    lean of the chest, + forward / - back;  spineBend sideways
 *   neck     neck pitch;  head = [pitch, yaw, roll] relative to the neck
 *   shL/shR  [flex (+ forward), abduct (+ away from the body)];  elL/elR elbow flex (+ bends forward)
 *   hipL/hipR [flex (+ forward), abduct];  knL/knR knee flex (+ bends the shin back);  ankL/ankR toes down (+)
 *   shoulderX distance of the shoulder joints from the spine
 * Body frame: +Y up the body (head), +Z the way the face looks, left side = -X. Local figure frame is floor y=0;
 * lying figures have the head at -Z (orient pitch -90), sitting figures face +Z.
 */

export type V3 = [number, number, number]
export type Q4 = [number, number, number, number]

export interface Part {
  name: string
  shape: "capsule" | "ring"
  pos: number[]
  /** quaternion x, y, z, w */
  rot: number[]
  /** [width across X, length along the part's own Y axis, depth across Z] in cm (bounding box) */
  size: number[]
  col: number[]
}

export interface Pose {
  root: V3
  orient: V3
  spine: number
  spineBend: number
  neck: number
  head: V3
  shL: [number, number]
  shR: [number, number]
  elL: number
  elR: number
  hipL: [number, number]
  hipR: [number, number]
  knL: number
  knR: number
  ankL: number
  ankR: number
  shoulderX: number
}

export interface Look {
  shirt: number[]
  pants: number[]
  skin: number[]
  hair: number[]
  shoe: number[]
  bandage: boolean
}

// ------------------------------------------------------------------ dimensions (cm)

export const DIM = {
  pelvis: [32, 15, 21],
  torsoLen: 46,
  torso: [36, 46, 21],
  neck: [9.5, 11, 9.5],
  head: [21, 24, 22],
  hair: [22.5, 17, 23.5],
  hipX: 8.5,
  hipDrop: -2,
  thighLen: 38,
  shinLen: 36,
  thighD: 15,
  shinD: 11,
  foot: [9, 22, 8],
  upperArmLen: 26,
  foreArmLen: 23,
  upperArmD: 9,
  foreArmD: 7.5,
  hand: [8, 11, 5],
  rimWidth: 1.1,
}

export const RIM_COLOUR = [0.82, 0.96, 1.0]
export const FLOOR_RING_COLOUR = [0.4, 0.52, 0.72]
export const BANDAGE_COLOUR = [1, 1, 1]

// ------------------------------------------------------------------ tiny quaternion / vector maths

const D2R = Math.PI / 180
const QI: Q4 = [0, 0, 0, 1]

function qAxis(ax: V3, deg: number): Q4 {
  const h = (deg * D2R) / 2
  const s = Math.sin(h)
  return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(h)]
}
const AX: V3 = [1, 0, 0]
const AY: V3 = [0, 1, 0]
const AZ: V3 = [0, 0, 1]
export function qMul(a: number[], b: number[]): Q4 {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}
export function qRot(q: number[], v: number[]): V3 {
  const x = q[0], y = q[1], z = q[2], w = q[3]
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]
}
function add(a: number[], b: number[]): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
const rx = (d: number): Q4 => qAxis(AX, d)
const ry = (d: number): Q4 => qAxis(AY, d)
const rz = (d: number): Q4 => qAxis(AZ, d)

// ------------------------------------------------------------------ poses

export function makePose(o: Partial<Pose>): Pose {
  return {
    root: o.root || [0, 85, 0],
    orient: o.orient || [0, 0, 0],
    spine: o.spine || 0,
    spineBend: o.spineBend || 0,
    neck: o.neck || 0,
    head: o.head || [0, 0, 0],
    shL: o.shL || [0, 6],
    shR: o.shR || [0, 6],
    elL: o.elL === undefined ? 8 : o.elL,
    elR: o.elR === undefined ? 8 : o.elR,
    hipL: o.hipL || [0, 3],
    hipR: o.hipR || [0, 3],
    knL: o.knL || 0,
    knR: o.knR || 0,
    ankL: o.ankL || 0,
    ankR: o.ankR || 0,
    shoulderX: o.shoulderX === undefined ? 21 : o.shoulderX,
  }
}

export const STANDING_POSE: Pose = makePose({ root: [0, 83, 0], shL: [3, 7], shR: [3, 7] })

export type PoseName =
  | "sitting_arm_cut"
  | "sitting_holding_ankle"
  | "lying_back"
  | "lying_side"
  | "slumped_against_wall"
  | "lying_groaning"
  | "sitting_dazed"
  | "lying_face_up_still"
  | "sitting_knees_up"
  | "sitting_leaning_back"
  | "lying_back_knee_up"
  | "lying_back_arm_up"

export const POSES: { [k: string]: Pose } = {
  // sitting on the floor, legs forward, right forearm bandaged (arm held across the lap)
  sitting_arm_cut: makePose({
    root: [0, 9, 0],
    spine: 4,
    neck: 6,
    head: [4, 8, 0],
    shL: [40, 8],
    elL: 20,
    shR: [30, 10],
    elR: 50,
    hipL: [90, 9],
    hipR: [90, 9],
    ankL: 12,
    ankR: 12,
  }),
  // sitting, one knee up, right hand on the right ankle
  sitting_holding_ankle: makePose({
    root: [0, 9, 0],
    spine: 45,
    neck: 0,
    head: [-18, -12, 0],
    shL: [90, 8],
    elL: 10,
    shR: [80, 0],
    elR: 45,
    hipL: [90, 8],
    hipR: [115, 14],
    knR: 40,
    ankL: 12,
    ankR: 5,
  }),
  // lying on the back, arms and legs a little apart
  lying_back: makePose({
    root: [0, 12.3, 0],
    orient: [-90, 0, 0],
    head: [0, 14, 0],
    shL: [0, 18],
    shR: [0, 18],
    hipL: [0, 8],
    hipR: [0, 8],
    ankL: 8,
    ankR: 8,
  }),
  // lying on the left side, top knee bent, top arm in front
  lying_side: makePose({
    root: [0, 18, 0],
    orient: [-90, 0, 90],
    shoulderX: 14.5,
    head: [0, 0, 0],
    neck: -4,
    shL: [40, 0],
    elL: 40,
    shR: [38, 8],
    elR: 50,
    hipL: [14, 0],
    knL: 25,
    hipR: [45, 0],
    knR: 60,
    ankL: 20,
    ankR: 20,
  }),
  // sitting against the wall, leaning back, head dropped to one side
  slumped_against_wall: makePose({
    root: [0, 9, 0],
    spine: -7,
    neck: 10,
    head: [14, 0, 16],
    shL: [4, 16],
    elL: 20,
    shR: [8, 18],
    elR: 25,
    hipL: [90, 15],
    hipR: [90, 15],
    ankL: 12,
    ankR: 12,
  }),
  // lying on the side, hand to the head
  lying_groaning: makePose({
    root: [0, 18, 0],
    orient: [-90, 0, 90],
    shoulderX: 14.5,
    neck: -4,
    shL: [40, 0],
    elL: 40,
    shR: [125, 0],
    elR: 110,
    hipL: [14, 0],
    knL: 25,
    hipR: [45, 0],
    knR: 60,
    ankL: 20,
    ankR: 20,
  }),
  // sitting, dazed, head forward, hands in the lap
  sitting_dazed: makePose({
    root: [0, 9, 0],
    spine: 10,
    neck: 14,
    head: [10, 14, 10],
    shL: [42, 8],
    elL: 18,
    shR: [42, 8],
    elR: 18,
    hipL: [90, 11],
    hipR: [90, 11],
    ankL: 12,
    ankR: 12,
  }),
  // lying face up, still, arms by the sides
  lying_face_up_still: makePose({
    root: [0, 12.3, 0],
    orient: [-90, 0, 0],
    shL: [0, 8],
    shR: [0, 8],
    hipL: [0, 4],
    hipR: [0, 4],
    ankL: 8,
    ankR: 8,
  }),
  // sitting, both knees up, arms resting across the knees
  sitting_knees_up: makePose({
    root: [0, 11, 0],
    spine: 25,
    neck: 8,
    head: [8, 0, 0],
    shL: [46, 6],
    elL: 75,
    shR: [46, 6],
    elR: 75,
    hipL: [150, 8],
    hipR: [150, 8],
    knL: 150,
    knR: 150,
    ankL: 0,
    ankR: 0,
  }),
  // sitting, legs out, leaning back on both hands
  sitting_leaning_back: makePose({
    root: [0, 9, 0],
    spine: -12,
    neck: 12,
    head: [6, 0, 0],
    shL: [8, 16],
    elL: 4,
    shR: [8, 16],
    elR: 4,
    hipL: [88, 10],
    hipR: [88, 10],
    ankL: 12,
    ankR: 12,
  }),
  // lying on the back, one knee drawn up, arms a little apart
  lying_back_knee_up: makePose({
    root: [0, 12.3, 0],
    orient: [-90, 0, 0],
    head: [0, -12, 0],
    shL: [0, 18],
    shR: [0, 20],
    elR: 20,
    hipL: [0, 8],
    hipR: [62, 6],
    knR: 125,
    ankL: 8,
    ankR: 20,
  }),
  // lying on the back, right arm raised above the head, left hand on the chest
  lying_back_arm_up: makePose({
    root: [0, 12.3, 0],
    orient: [-90, 0, 0],
    head: [0, 16, 0],
    shL: [40, 22],
    elL: 90,
    shR: [170, 25],
    elR: 12,
    hipL: [0, 8],
    hipR: [0, 12],
    ankL: 8,
    ankR: 8,
  }),
}

export function poseForKind(kind: string): Pose {
  return POSES[kind] || POSES.lying_back
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k
}
function lerpArr(a: number[], b: number[], k: number): number[] {
  return a.map((v, i) => lerp(v, b[i], k))
}

/** Blend two poses joint by joint (k from 0 to 1). */
export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    root: lerpArr(a.root, b.root, k) as V3,
    orient: lerpArr(a.orient, b.orient, k) as V3,
    spine: lerp(a.spine, b.spine, k),
    spineBend: lerp(a.spineBend, b.spineBend, k),
    neck: lerp(a.neck, b.neck, k),
    head: lerpArr(a.head, b.head, k) as V3,
    shL: lerpArr(a.shL, b.shL, k) as [number, number],
    shR: lerpArr(a.shR, b.shR, k) as [number, number],
    elL: lerp(a.elL, b.elL, k),
    elR: lerp(a.elR, b.elR, k),
    hipL: lerpArr(a.hipL, b.hipL, k) as [number, number],
    hipR: lerpArr(a.hipR, b.hipR, k) as [number, number],
    knL: lerp(a.knL, b.knL, k),
    knR: lerp(a.knR, b.knR, k),
    ankL: lerp(a.ankL, b.ankL, k),
    ankR: lerp(a.ankR, b.ankR, k),
    shoulderX: lerp(a.shoulderX, b.shoulderX, k),
  }
}

/** Lift a pose so no part dips below the floor (used while the walker stands up: the hips rise while the legs swing). */
export function grounded(p: Pose, look: Look): Pose {
  const min = boundsOf(partsFromPose(p, look)).min[1]
  if (min >= 0) return p
  return { ...p, root: [p.root[0], p.root[1] - min, p.root[2]] }
}

/** Standing walk cycle: s is sin(gait phase) in -1..1. */
export function walkPose(s: number): Pose {
  const up = (v: number): number => Math.max(0, v)
  return makePose({
    root: [0, 83, 0],
    shL: [-18 * s, 7],
    shR: [18 * s, 7],
    elL: 14 + up(-s) * 14,
    elR: 14 + up(s) * 14,
    hipL: [24 * s, 3],
    hipR: [-24 * s, 3],
    knL: up(-s) * 34,
    knR: up(s) * 34,
    ankL: 8 * s,
    ankR: -8 * s,
  })
}

// ------------------------------------------------------------------ forward kinematics

/** Named body parts for a pose. Names are stable: Pelvis, Torso, Neck, Head, Hair, UpperArmL/R, ForeArmL/R, HandL/R,
 *  ThighL/R, ShinL/R, FootL/R (+ Bandage when look.bandage). */
export function partsFromPose(p: Pose, look: Look): Part[] {
  const parts: Part[] = []
  const push = (name: string, shape: "capsule" | "ring", pos: number[], rot: number[], size: number[], col: number[]): void => {
    parts.push({ name, shape, pos: [pos[0], pos[1], pos[2]], rot: [rot[0], rot[1], rot[2], rot[3]], size: size.slice(), col })
  }
  const Q0 = qMul(qMul(rz(p.orient[2]), ry(p.orient[1])), rx(p.orient[0]))
  const root = p.root
  push("Pelvis", "capsule", root, Q0, DIM.pelvis, look.pants)

  // spine, torso
  const Q1 = qMul(qMul(Q0, rx(p.spine)), rz(p.spineBend))
  const chestBase = add(root, qRot(Q0, [0, 6, 0]))
  push("Torso", "capsule", add(chestBase, qRot(Q1, [0, DIM.torsoLen / 2, 0])), Q1, DIM.torso, look.shirt)
  const chestTop = add(chestBase, qRot(Q1, [0, DIM.torsoLen, 0]))

  // neck and head
  const Qn = qMul(Q1, rx(p.neck))
  const neckBase = add(chestTop, qRot(Q1, [0, -3, 0]))
  push("Neck", "capsule", add(neckBase, qRot(Qn, [0, 5, 0])), Qn, DIM.neck, look.skin)
  const neckTop = add(neckBase, qRot(Qn, [0, 10, 0]))
  const Qh = qMul(qMul(qMul(Qn, ry(p.head[1])), rx(p.head[0])), rz(p.head[2]))
  push("Head", "capsule", add(neckTop, qRot(Qh, [0, 9, 1.5])), Qh, DIM.head, look.skin)
  push("Hair", "capsule", add(neckTop, qRot(Qh, [0, 14.5, -1.5])), Qh, DIM.hair, look.hair)

  // arms
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "L" : "R"
    const sh = side < 0 ? p.shL : p.shR
    const elbowFlex = side < 0 ? p.elL : p.elR
    const shoulder = add(chestTop, qRot(Q1, [side * p.shoulderX, -8, 0]))
    const Qs = qMul(qMul(Q1, rx(-sh[0])), rz(side * sh[1]))
    push("UpperArm" + tag, "capsule", add(shoulder, qRot(Qs, [0, -DIM.upperArmLen / 2, 0])), Qs, [DIM.upperArmD, DIM.upperArmLen + DIM.upperArmD * 0.5, DIM.upperArmD], look.shirt)
    const elbow = add(shoulder, qRot(Qs, [0, -DIM.upperArmLen, 0]))
    const Qe = qMul(Qs, rx(-elbowFlex))
    const faCentre = add(elbow, qRot(Qe, [0, -DIM.foreArmLen / 2, 0]))
    push("ForeArm" + tag, "capsule", faCentre, Qe, [DIM.foreArmD, DIM.foreArmLen + DIM.foreArmD * 0.5, DIM.foreArmD], look.skin)
    if (look.bandage && side > 0) {
      push("Bandage", "capsule", add(faCentre, qRot(Qe, [0, 2, 0])), Qe, [DIM.foreArmD + 2.6, 13, DIM.foreArmD + 2.6], BANDAGE_COLOUR)
    }
    const wrist = add(elbow, qRot(Qe, [0, -DIM.foreArmLen, 0]))
    push("Hand" + tag, "capsule", add(wrist, qRot(Qe, [0, -DIM.hand[1] / 2 + 1, 0])), Qe, DIM.hand, look.skin)
  }

  // legs
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "L" : "R"
    const hp = side < 0 ? p.hipL : p.hipR
    const kneeFlex = side < 0 ? p.knL : p.knR
    const ankleFlex = side < 0 ? p.ankL : p.ankR
    const hip = add(root, qRot(Q0, [side * DIM.hipX, DIM.hipDrop, 0]))
    const Qt = qMul(qMul(Q0, rx(-hp[0])), rz(side * hp[1]))
    push("Thigh" + tag, "capsule", add(hip, qRot(Qt, [0, -DIM.thighLen / 2, 0])), Qt, [DIM.thighD, DIM.thighLen + DIM.thighD * 0.4, DIM.thighD], look.pants)
    const knee = add(hip, qRot(Qt, [0, -DIM.thighLen, 0]))
    const Qk = qMul(Qt, rx(kneeFlex))
    push("Shin" + tag, "capsule", add(knee, qRot(Qk, [0, -DIM.shinLen / 2, 0])), Qk, [DIM.shinD, DIM.shinLen + DIM.shinD * 0.4, DIM.shinD], look.pants)
    const ankle = add(knee, qRot(Qk, [0, -DIM.shinLen, 0]))
    const Qf = qMul(Qk, rx(ankleFlex))
    // foot: capsule long axis along the foot's +Z
    push("Foot" + tag, "capsule", add(ankle, qRot(Qf, [0, -3.5, 7])), qMul(Qf, rx(90)), [DIM.foot[0], DIM.foot[1], DIM.foot[2]], look.shoe)
  }
  return parts
}

export function findPart(parts: Part[], name: string): Part {
  for (const p of parts) if (p.name === name) return p
  throw new Error("no part " + name)
}

// ------------------------------------------------------------------ palettes chosen by seed

/** Light clothing colours (nothing dark: the display is additive). */
export const SHIRT_PALETTE: number[][] = [
  [0.6, 0.93, 0.72], // mint
  [0.6, 0.8, 1.0], // sky
  [0.83, 0.76, 0.98], // lilac
  [1.0, 0.78, 0.6], // peach
  [0.98, 0.91, 0.52], // butter
  [1.0, 0.7, 0.8], // rose
  [0.62, 0.96, 0.92], // aqua
  [0.8, 0.96, 0.52], // lime
  [1.0, 0.68, 0.62], // coral
]
/** Skin tones, all light enough to stay visible (darkest still has a luminance above 0.55). */
export const SKIN_PALETTE: number[][] = [
  [1.0, 0.87, 0.77],
  [0.97, 0.79, 0.65],
  [0.9, 0.71, 0.55],
  [0.82, 0.62, 0.47],
  [0.75, 0.56, 0.43],
]
export const HAIR_PALETTE: number[][] = [
  [0.88, 0.76, 0.5],
  [0.76, 0.56, 0.4],
  [0.9, 0.9, 0.93],
  [0.88, 0.52, 0.36],
  [0.68, 0.54, 0.45],
]
export const PANTS_PALETTE: number[][] = [
  [0.72, 0.78, 0.93],
  [0.89, 0.85, 0.71],
  [0.82, 0.82, 0.88],
  [0.7, 0.87, 0.83],
]
const SHOE = [0.95, 0.95, 0.99]

function seededOrder(n: number, seed: number, salt: number): number[] {
  let s = (Math.imul(seed | 0, 2654435761) ^ Math.imul(salt, 40503)) >>> 0 || 1
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const a: number[] = []
  for (let i = 0; i < n; i++) a.push(i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

/** The look of the index-th casualty of a run: the same seed always gives the same looks; within a run the
 *  first 5 casualties get different clothing, skin tone and hair (a run has 4). */
export function lookFor(seed: number, index: number, bandage: boolean): Look {
  const shirt = seededOrder(SHIRT_PALETTE.length, seed, 1)[index % SHIRT_PALETTE.length]
  const skin = seededOrder(SKIN_PALETTE.length, seed, 2)[index % SKIN_PALETTE.length]
  const hair = seededOrder(HAIR_PALETTE.length, seed, 3)[index % HAIR_PALETTE.length]
  const pants = seededOrder(PANTS_PALETTE.length, seed, 4)[index % PANTS_PALETTE.length]
  return {
    shirt: SHIRT_PALETTE[shirt],
    pants: PANTS_PALETTE[pants],
    skin: SKIN_PALETTE[skin],
    hair: HAIR_PALETTE[hair],
    shoe: SHOE,
    bandage: bandage,
  }
}

// ------------------------------------------------------------------ geometry

export interface Geometry {
  pos: number[]
  nrm: number[]
  idx: number[]
}

const SEGMENTS = 14
const CAP_STEPS = 4

/**
 * A rounded capsule along its local Y axis: elliptic cross-section (radii a/2 across X, b/2 across Z), total
 * length L including the rounded ends. With L == a == b it is a sphere; wide and flat ones are rounded slabs.
 */
function capsuleGeometry(a: number, L: number, b: number): Geometry {
  const ra = a / 2
  const rb = b / 2
  const H = L / 2
  const c = Math.max(0.01, Math.min(ra, rb, H))
  const h = Math.max(0, H - c)
  const rings: { y: number; s: number; ny: number }[] = []
  for (let k = 0; k <= CAP_STEPS; k++) {
    const phi = ((-90 + (90 * k) / CAP_STEPS) * Math.PI) / 180
    rings.push({ y: -h + c * Math.sin(phi), s: Math.cos(phi), ny: Math.sin(phi) / c })
  }
  for (let k = h > 0.05 ? 0 : 1; k <= CAP_STEPS; k++) {
    const phi = ((90 * k) / CAP_STEPS * Math.PI) / 180
    rings.push({ y: h + c * Math.sin(phi), s: Math.cos(phi), ny: Math.sin(phi) / c })
  }
  const g: Geometry = { pos: [], nrm: [], idx: [] }
  for (const r of rings) {
    for (let j = 0; j < SEGMENTS; j++) {
      const th = (j / SEGMENTS) * Math.PI * 2
      const ct = Math.cos(th)
      const st = Math.sin(th)
      g.pos.push(ra * r.s * ct, r.y, rb * r.s * st)
      let nx = (r.s * ct) / ra
      let ny = r.ny
      let nz = (r.s * st) / rb
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx /= l
      ny /= l
      nz /= l
      g.nrm.push(nx, ny, nz)
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const j2 = (j + 1) % SEGMENTS
      const v00 = i * SEGMENTS + j
      const v01 = i * SEGMENTS + j2
      const v10 = (i + 1) * SEGMENTS + j
      const v11 = (i + 1) * SEGMENTS + j2
      addTri(g, v00, v01, v11)
      addTri(g, v00, v11, v10)
    }
  }
  return g
}

/** A solid elliptic cylinder along local Y (flat caps): used for tag bands and the floor ring. */
function ringGeometry(a: number, L: number, b: number): Geometry {
  const ra = a / 2
  const rb = b / 2
  const H = L / 2
  const g: Geometry = { pos: [], nrm: [], idx: [] }
  for (const y of [-H, H]) {
    for (let j = 0; j < SEGMENTS; j++) {
      const th = (j / SEGMENTS) * Math.PI * 2
      const ct = Math.cos(th)
      const st = Math.sin(th)
      g.pos.push(ra * ct, y, rb * st)
      const nx = ct / ra
      const nz = st / rb
      const l = Math.sqrt(nx * nx + nz * nz) || 1
      g.nrm.push(nx / l, 0, nz / l)
    }
  }
  for (let j = 0; j < SEGMENTS; j++) {
    const j2 = (j + 1) % SEGMENTS
    addTri(g, j, j2, SEGMENTS + j2)
    addTri(g, j, SEGMENTS + j2, SEGMENTS + j)
  }
  for (const sgn of [-1, 1]) {
    const centre = g.pos.length / 3
    g.pos.push(0, sgn * H, 0)
    g.nrm.push(0, sgn, 0)
    const base = g.pos.length / 3
    for (let j = 0; j < SEGMENTS; j++) {
      const th = (j / SEGMENTS) * Math.PI * 2
      g.pos.push(ra * Math.cos(th), sgn * H, rb * Math.sin(th))
      g.nrm.push(0, sgn, 0)
    }
    for (let j = 0; j < SEGMENTS; j++) {
      addTri(g, centre, base + j, base + ((j + 1) % SEGMENTS))
    }
  }
  return g
}

/** Add a triangle, flipped if needed so its front face looks the way the vertex normals point (CCW from outside). */
function addTri(g: Geometry, i0: number, i1: number, i2: number): void {
  const p = (i: number): number[] => [g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]]
  const a = p(i0), b = p(i1), c = p(i2)
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  if (nx * nx + ny * ny + nz * nz < 1e-12) return // degenerate (a pole)
  const sx = g.nrm[i0 * 3] + g.nrm[i1 * 3] + g.nrm[i2 * 3]
  const sy = g.nrm[i0 * 3 + 1] + g.nrm[i1 * 3 + 1] + g.nrm[i2 * 3 + 1]
  const sz = g.nrm[i0 * 3 + 2] + g.nrm[i1 * 3 + 2] + g.nrm[i2 * 3 + 2]
  if (nx * sx + ny * sy + nz * sz >= 0) g.idx.push(i0, i1, i2)
  else g.idx.push(i0, i2, i1)
}

const geomCache: { [k: string]: Geometry } = {}
export function partGeometry(p: Part): Geometry {
  const key = p.shape + ":" + p.size.map((v) => Math.round(v * 100)).join(",")
  let g = geomCache[key]
  if (!g) {
    g = p.shape === "ring" ? ringGeometry(p.size[0], p.size[1], p.size[2]) : capsuleGeometry(p.size[0], p.size[1], p.size[2])
    geomCache[key] = g
  }
  return g
}

export interface Baked {
  /** interleaved: position (3), normal (3), colour (4) */
  verts: number[]
  idx: number[]
}

/**
 * Bake parts into one vertex array. `inflate` pushes every vertex out along its normal (used for the outline hull).
 * `local` = true leaves each part at the origin (for a part that is moved by its own scene object).
 */
export function bakeParts(parts: Part[], inflate: number = 0, local: boolean = false): Baked {
  const out: Baked = { verts: [], idx: [] }
  for (const p of parts) {
    const g = partGeometry(p)
    const base = out.verts.length / 10
    const n = g.pos.length / 3
    for (let i = 0; i < n; i++) {
      const lp: number[] = [g.pos[i * 3] + g.nrm[i * 3] * inflate, g.pos[i * 3 + 1] + g.nrm[i * 3 + 1] * inflate, g.pos[i * 3 + 2] + g.nrm[i * 3 + 2] * inflate]
      const ln = [g.nrm[i * 3], g.nrm[i * 3 + 1], g.nrm[i * 3 + 2]]
      let wp: number[]
      let wn: number[]
      if (local) {
        wp = lp
        wn = ln
      } else {
        wp = add(p.pos, qRot(p.rot, lp))
        wn = qRot(p.rot, ln)
      }
      out.verts.push(wp[0], wp[1], wp[2], wn[0], wn[1], wn[2], p.col[0], p.col[1], p.col[2], 1)
    }
    for (const k of g.idx) out.idx.push(base + k)
  }
  return out
}

/** Bounding box (cm) of the baked parts, in the figure frame. */
export function boundsOf(parts: Part[], inflate: number = 0): { min: V3; max: V3 } {
  const b = bakeParts(parts, inflate)
  const min: V3 = [1e9, 1e9, 1e9]
  const max: V3 = [-1e9, -1e9, -1e9]
  for (let i = 0; i < b.verts.length; i += 10) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], b.verts[i + k])
      max[k] = Math.max(max[k], b.verts[i + k])
    }
  }
  return { min, max }
}

export const IDENTITY_Q: Q4 = QI
