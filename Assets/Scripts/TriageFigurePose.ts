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
  /** capsule = (tapered) rounded limb or ball; torso / head = shaped lofts; ring = flat-capped elliptic cylinder */
  shape: "capsule" | "ring" | "torso" | "head" | "band"
  pos: number[]
  /** quaternion x, y, z, w */
  rot: number[]
  /** [width across X, length along the part's own Y axis, depth across Z] in cm (bounding box; width / depth at the top end for a tapered capsule) */
  size: number[]
  col: number[]
  /** capsule only: radius at the bottom end / radius at the top end (default 1) */
  taper?: number
  /** capsule only: [position 0..1 from the bottom, radius factor] of a gentle bulge (calf, forearm) */
  bulge?: number[]
  /** baked shading: constant brightness factor (joints are a touch darker) */
  tone?: number
  /** baked shading: darkening at the two ends of the part (where it meets a joint) */
  ends?: number
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
  /** 0 short, 1 long, 2 bun, 3 side-swept fringe, 4 buzz */
  hairStyle: number
}

// ------------------------------------------------------------------ dimensions (cm)

export const DIM = {
  pelvis: [34, 16, 22],
  torsoLen: 46,
  torso: [38, 46, 22],
  neck: [8.2, 11, 8.2],
  neckBase: 9.6,
  head: [20.5, 24, 22],
  hipX: 8.5,
  hipDrop: -2,
  thighLen: 38,
  shinLen: 36,
  thighD: 16.5,
  kneeD: 11.4,
  shinD: 11.6,
  ankleD: 7.4,
  foot: [9.4, 23, 8.6],
  upperArmLen: 26,
  foreArmLen: 23,
  upperArmD: 9.6,
  elbowD: 7.6,
  foreArmD: 7.4,
  wristD: 5.6,
  hand: [8, 11, 4.8],
  rimWidth: 0.4,
}

export const FACE_EYE = [0.5, 0.58, 0.74]
export const FACE_MOUTH = [0.92, 0.56, 0.58]
export const BANDAGE_COLOUR = [1, 1, 1]

function mixc(a: number[], b: number[], k: number): number[] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}
const WHITE = [1, 1, 1]

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
 *  ThighL/R, ShinL/R, FootL/R (+ Bandage when look.bandage). Extra blending parts (joint balls, sleeves, cuffs, ankles,
 *  face, hair pieces) have their own names and are never used by the card or the tests. */
export function partsFromPose(p: Pose, look: Look): Part[] {
  const parts: Part[] = []
  const push = (name: string, shape: "capsule" | "ring" | "torso" | "head", pos: number[], rot: number[], size: number[], col: number[], ex?: Partial<Part>): void => {
    parts.push({ name, shape, pos: [pos[0], pos[1], pos[2]], rot: [rot[0], rot[1], rot[2], rot[3]], size: size.slice(), col, ...(ex || {}) })
  }
  /** a tapered limb piece hanging down (-Y) from `base`: top (proximal) diameter dTop, bottom dBot */
  const limb = (name: string, base: number[], Q: number[], len: number, dTop: number, dBot: number, col: number[], ex?: Partial<Part>): void => {
    push(name, "capsule", add(base, qRot(Q, [0, -len / 2, 0])), Q, [dTop, len + (dTop + dBot) / 4, dTop], col, { taper: dBot / dTop, ends: 0.06, ...(ex || {}) })
  }
  const ball = (name: string, at: number[], d: number, col: number[]): void => {
    push(name, "capsule", at, QI, [d, d, d], col, { tone: 0.93 })
  }
  const cuffShirt = mixc(look.shirt, WHITE, 0.5)
  const cuffPants = mixc(look.pants, WHITE, 0.5)

  const Q0 = qMul(qMul(rz(p.orient[2]), ry(p.orient[1])), rx(p.orient[0]))
  const root = p.root
  push("Pelvis", "capsule", root, Q0, DIM.pelvis, look.pants)

  // spine, torso (shaped: waist, chest, shoulders)
  const Q1 = qMul(qMul(Q0, rx(p.spine)), rz(p.spineBend))
  const chestBase = add(root, qRot(Q0, [0, 6, 0]))
  push("Torso", "torso", add(chestBase, qRot(Q1, [0, DIM.torsoLen / 2, 0])), Q1, DIM.torso, look.shirt)
  const chestTop = add(chestBase, qRot(Q1, [0, DIM.torsoLen, 0]))

  // neck and head
  const Qn = qMul(Q1, rx(p.neck))
  const neckBase = add(chestTop, qRot(Q1, [0, -3, 0]))
  push("Neck", "capsule", add(neckBase, qRot(Qn, [0, 5, 0])), Qn, [DIM.neck[0], DIM.neck[1], DIM.neck[0]], look.skin, { taper: DIM.neckBase / DIM.neck[0] })
  const neckTop = add(neckBase, qRot(Qn, [0, 10, 0]))
  const Qh = qMul(qMul(qMul(Qn, ry(p.head[1])), rx(p.head[0])), rz(p.head[2]))
  const headC = add(neckTop, qRot(Qh, [0, 9, 1.5]))
  push("Head", "head", headC, Qh, DIM.head, look.skin)
  const hp = (v: number[]): number[] => add(headC, qRot(Qh, v))
  // hair: five styles, chosen by the seed (nothing to do with the casualty's condition)
  const hs = look.hairStyle
  const hairSize = hs === 4 ? [21.4, 15, 22.6] : hs === 0 ? [22, 16.5, 23.2] : [22.4, 16.5, 23.4]
  push("Hair", "capsule", hp([0, hs === 4 ? 4.6 : 5.3, -2.7]), Qh, hairSize, look.hair)
  if (hs === 1) push("HairBack", "capsule", hp([0, -3.5, -8.2]), Qh, [21.4, 22, 8.4], look.hair, { taper: 0.9 })
  if (hs === 2) push("HairBun", "capsule", hp([0, 14.5, -5.5]), Qh, [8.4, 8.4, 8.4], look.hair)
  if (hs === 3) push("HairFringe", "capsule", hp([1.5, 9.4, 7.6]), qMul(Qh, rz(76)), [5.8, 19.5, 6], look.hair)
  // a minimal, calm face: two small eyes and a small mouth, identical on everyone
  for (const sx of [-1, 1]) push("Eye" + (sx < 0 ? "L" : "R"), "capsule", hp([sx * 4.5, 1.8, 9.3]), Qh, [3, 4, 2.4], FACE_EYE)
  push("Mouth", "capsule", hp([0, -5.2, 9.0]), qMul(Qh, rz(90)), [1.3, 5.2, 1.5], FACE_MOUTH)

  // arms
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "L" : "R"
    const sh = side < 0 ? p.shL : p.shR
    const elbowFlex = side < 0 ? p.elL : p.elR
    const shoulder = add(chestTop, qRot(Q1, [side * p.shoulderX, -8, 0]))
    const Qs = qMul(qMul(Q1, rx(-sh[0])), rz(side * sh[1]))
    ball("ShoulderBall" + tag, shoulder, DIM.upperArmD + 1.2, look.shirt)
    limb("UpperArm" + tag, shoulder, Qs, DIM.upperArmLen, DIM.upperArmD, DIM.elbowD, look.shirt)
    const elbow = add(shoulder, qRot(Qs, [0, -DIM.upperArmLen, 0]))
    const Qe = qMul(Qs, rx(-elbowFlex))
    ball("ElbowBall" + tag, elbow, DIM.elbowD + 0.2, look.shirt)
    limb("ForeArm" + tag, elbow, Qe, DIM.foreArmLen, DIM.foreArmD, DIM.wristD, look.skin, { bulge: [0.8, 1.05] })
    // sleeve: the shirt carries on over the top of the forearm, with a lighter cuff
    const sl = DIM.foreArmLen * 0.38
    const dSleeveEnd = DIM.foreArmD + (DIM.wristD - DIM.foreArmD) * 0.38 + 1.0
    limb("Sleeve" + tag, elbow, Qe, sl - 1.0, DIM.foreArmD + 1.0, dSleeveEnd, look.shirt, { ends: 0 })
    push("SleeveCuff" + tag, "ring", add(elbow, qRot(Qe, [0, -sl, 0])), Qe, [dSleeveEnd + 1.3, 1.8, dSleeveEnd + 1.3], cuffShirt)
    const faCentre = add(elbow, qRot(Qe, [0, -DIM.foreArmLen / 2, 0]))
    if (look.bandage && side > 0) {
      push("Bandage", "capsule", add(faCentre, qRot(Qe, [0, -1, 0])), Qe, [DIM.foreArmD * 0.9 + 2.6, 12, DIM.foreArmD * 0.9 + 2.6], BANDAGE_COLOUR, { taper: 0.9 })
    }
    const wrist = add(elbow, qRot(Qe, [0, -DIM.foreArmLen, 0]))
    push("Hand" + tag, "capsule", add(wrist, qRot(Qe, [0, -DIM.hand[1] / 2 + 1, 0])), Qe, DIM.hand, look.skin, { taper: 0.9, ends: 0.04 })
  }

  // legs
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "L" : "R"
    const hpv = side < 0 ? p.hipL : p.hipR
    const kneeFlex = side < 0 ? p.knL : p.knR
    const ankleFlex = side < 0 ? p.ankL : p.ankR
    const hip = add(root, qRot(Q0, [side * DIM.hipX, DIM.hipDrop, 0]))
    const Qt = qMul(qMul(Q0, rx(-hpv[0])), rz(side * hpv[1]))
    ball("HipBall" + tag, hip, DIM.thighD - 0.6, look.pants)
    limb("Thigh" + tag, hip, Qt, DIM.thighLen, DIM.thighD, DIM.kneeD, look.pants)
    const knee = add(hip, qRot(Qt, [0, -DIM.thighLen, 0]))
    const Qk = qMul(Qt, rx(kneeFlex))
    ball("KneeBall" + tag, knee, DIM.kneeD + 1.4, look.pants)
    // trouser leg stops above the ankle with a lighter cuff; a bare ankle shows below it
    const legLen = DIM.shinLen - 6.5
    const dCuff = DIM.shinD + (DIM.ankleD - DIM.shinD) * (legLen / DIM.shinLen)
    limb("Shin" + tag, knee, Qk, legLen, DIM.shinD, dCuff, look.pants, { bulge: [0.62, 1.05], ends: 0.05 })
    push("TrouserCuff" + tag, "ring", add(knee, qRot(Qk, [0, -legLen - 1.5, 0])), Qk, [dCuff + 1.5, 2.6, dCuff + 1.5], cuffPants)
    const ankle = add(knee, qRot(Qk, [0, -DIM.shinLen, 0]))
    limb("Ankle" + tag, add(knee, qRot(Qk, [0, -legLen + 2, 0])), Qk, DIM.shinLen - legLen + 3, 5.8, 5.2, look.skin, { ends: 0 })
    const Qf = qMul(Qk, rx(ankleFlex))
    // shoe: capsule long axis along the foot's +Z, heel wider than the toe
    push("Foot" + tag, "capsule", add(ankle, qRot(Qf, [0, -3.4, 6.6])), qMul(Qf, rx(90)), [DIM.foot[0], DIM.foot[1], DIM.foot[2]], look.shoe, { taper: 1.12, ends: 0.04 })
  }
  return parts
}

export function findPart(parts: Part[], name: string): Part {
  for (const p of parts) if (p.name === name) return p
  throw new Error("no part " + name)
}

// ------------------------------------------------------------------ palettes chosen by seed

/** Clothing colours: more saturated than before but still light (nothing dark: the display is additive). */
export const SHIRT_PALETTE: number[][] = [
  [0.45, 0.92, 0.65], // mint
  [0.5, 0.78, 1.0], // sky
  [0.78, 0.66, 1.0], // lilac
  [1.0, 0.7, 0.42], // peach
  [1.0, 0.9, 0.36], // butter
  [1.0, 0.56, 0.72], // rose
  [0.4, 0.93, 0.9], // aqua
  [0.72, 0.95, 0.36], // lime
  [1.0, 0.56, 0.5], // coral
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
  [0.9, 0.78, 0.46],
  [0.76, 0.56, 0.4],
  [0.9, 0.9, 0.93],
  [0.9, 0.5, 0.34],
  [0.68, 0.54, 0.45],
]
/** Trousers: light but clearly coloured, so they do not wash out to white. */
export const PANTS_PALETTE: number[][] = [
  [0.45, 0.6, 0.93], // denim
  [0.86, 0.74, 0.46], // khaki
  [0.55, 0.78, 0.6], // sage
  [0.78, 0.6, 0.8], // mauve
  [0.42, 0.76, 0.78], // teal
]
/** Shoes: a different family from clothes and skin. */
export const SHOE_PALETTE: number[][] = [
  [0.97, 0.97, 1.0],
  [0.62, 0.8, 1.0],
  [1.0, 0.82, 0.34],
  [0.93, 0.6, 0.6],
  [0.72, 0.9, 0.78],
]

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

function colourDistance(a: number[], b: number[]): number {
  return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]))
}

/** First palette entry at or after `from` (cyclic) that is not used yet and passes `ok`; falls back to any unused one. */
function pickDistinct(n: number, order: number[], from: number, used: { [k: number]: boolean }, ok: (i: number) => boolean): number {
  for (let k = 0; k < n; k++) {
    const c = order[(from + k) % n]
    if (!used[c] && ok(c)) return c
  }
  for (let k = 0; k < n; k++) {
    const c = order[(from + k) % n]
    if (!used[c]) return c
  }
  return order[from % n]
}

const MIN_CLASH = 0.22

/** The look of the index-th casualty of a run: the same seed always gives the same looks; within a run the
 *  first 5 casualties get different clothing, skin tone, hair and shoes, and shirt, trousers, skin and shoes of one
 *  person are never near-identical colours. Nothing here depends on the casualty's condition. */
export function lookFor(seed: number, index: number, bandage: boolean): Look {
  const shirtOrder = seededOrder(SHIRT_PALETTE.length, seed, 1)
  const skinOrder = seededOrder(SKIN_PALETTE.length, seed, 2)
  const hairOrder = seededOrder(HAIR_PALETTE.length, seed, 3)
  const pantsOrder = seededOrder(PANTS_PALETTE.length, seed, 4)
  const shoeOrder = seededOrder(SHOE_PALETTE.length, seed, 5)
  const styleOrder = seededOrder(5, seed, 6)
  const usedShirt: { [k: number]: boolean } = {}
  const usedPants: { [k: number]: boolean } = {}
  const usedShoe: { [k: number]: boolean } = {}
  let shirt = 0, pants = 0, shoe = 0, skin = 0
  for (let j = 0; j <= index; j++) {
    skin = skinOrder[j % SKIN_PALETTE.length]
    shirt = pickDistinct(SHIRT_PALETTE.length, shirtOrder, j, usedShirt, (c) => colourDistance(SHIRT_PALETTE[c], SKIN_PALETTE[skin]) > MIN_CLASH)
    usedShirt[shirt] = true
    pants = pickDistinct(PANTS_PALETTE.length, pantsOrder, j, usedPants, (c) => colourDistance(PANTS_PALETTE[c], SHIRT_PALETTE[shirt]) > MIN_CLASH && colourDistance(PANTS_PALETTE[c], SKIN_PALETTE[skin]) > MIN_CLASH)
    usedPants[pants] = true
    shoe = pickDistinct(SHOE_PALETTE.length, shoeOrder, j, usedShoe, (c) => colourDistance(SHOE_PALETTE[c], PANTS_PALETTE[pants]) > MIN_CLASH && colourDistance(SHOE_PALETTE[c], SHIRT_PALETTE[shirt]) > MIN_CLASH)
    usedShoe[shoe] = true
  }
  return {
    shirt: SHIRT_PALETTE[shirt],
    pants: PANTS_PALETTE[pants],
    skin: SKIN_PALETTE[skin],
    hair: HAIR_PALETTE[hairOrder[index % HAIR_PALETTE.length]],
    shoe: SHOE_PALETTE[shoe],
    bandage: bandage,
    hairStyle: styleOrder[index % 5],
  }
}

// ------------------------------------------------------------------ geometry

export interface Geometry {
  pos: number[]
  nrm: number[]
  idx: number[]
  /** position along the part's own axis, 0 (bottom) to 1 (top), per vertex: used for baked shading */
  u: number[]
}

/** vertices round each ring of a body part; ring (band) cylinders use more so they look round */
const SEGMENTS = 20
const RING_SEGMENTS = 28
const CAP_STEPS = 4

export interface Station {
  y: number
  ra: number
  rb: number
}

/** Rings of a surface of revolution-like part, joined into a smooth mesh. Normals come from the ring tangents, so
 *  tapered and shaped parts shade smoothly. The first / last station may have zero radius (a pole). */
function loftGeometry(st: Station[], segs: number): Geometry {
  const g: Geometry = { pos: [], nrm: [], idx: [], u: [] }
  const y0 = st[0].y
  const span = st[st.length - 1].y - y0 || 1
  for (let i = 0; i < st.length; i++) {
    const prev = st[Math.max(0, i - 1)]
    const next = st[Math.min(st.length - 1, i + 1)]
    const dy = next.y - prev.y
    const dra = next.ra - prev.ra
    const drb = next.rb - prev.rb
    const s = st[i]
    for (let j = 0; j < segs; j++) {
      const th = (j / segs) * Math.PI * 2
      const c = Math.cos(th)
      const sn = Math.sin(th)
      g.pos.push(s.ra * c, s.y, s.rb * sn)
      let nx = s.rb * c * dy
      let ny = -(s.rb * dra * c * c + s.ra * drb * sn * sn)
      let nz = s.ra * sn * dy
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (l < 1e-6 || (s.ra < 0.05 && s.rb < 0.05)) {
        nx = 0
        nz = 0
        ny = i === 0 ? -1 : 1
      } else {
        nx /= l
        ny /= l
        nz /= l
      }
      g.nrm.push(nx, ny, nz)
      g.u.push((s.y - y0) / span)
    }
  }
  for (let i = 0; i < st.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % segs
      const v00 = i * segs + j
      const v01 = i * segs + j2
      const v10 = (i + 1) * segs + j
      const v11 = (i + 1) * segs + j2
      addTri(g, v00, v01, v11)
      addTri(g, v00, v11, v10)
    }
  }
  return g
}

/**
 * A rounded, optionally tapered capsule along its local Y axis. a / b = width / depth at the TOP end, L = total length
 * including the rounded ends, taper = bottom radius / top radius, bulge = [position 0..1 from the bottom, radius factor].
 * With L == a == b it is a sphere.
 */
function capsuleStations(a: number, L: number, b: number, taper: number, bulge?: number[]): Station[] {
  const H = L / 2
  const raT = a / 2
  const rbT = b / 2
  const raB = raT * taper
  const rbB = rbT * taper
  const cT = Math.max(0.01, Math.min(raT, rbT, H))
  const cB = Math.max(0.01, Math.min(raB, rbB, H))
  const yTop = H - cT
  const yBot = -H + cB
  const st: Station[] = []
  for (let k = 0; k <= CAP_STEPS; k++) {
    const phi = ((-90 + (90 * k) / CAP_STEPS) * Math.PI) / 180
    st.push({ y: yBot - cB + cB * (1 + Math.sin(phi)) - 0 + 0, ra: raB * Math.cos(phi), rb: rbB * Math.cos(phi) })
  }
  // y of the bottom cap rings: -H + cB (1 + sin phi)
  for (let k = 0; k <= CAP_STEPS; k++) {
    const phi = ((-90 + (90 * k) / CAP_STEPS) * Math.PI) / 180
    st[k].y = -H + cB * (1 + Math.sin(phi))
  }
  if (bulge && yTop - yBot > 1) {
    const f = bulge[0]
    const t = (f * (L - cT - cB) + cB) / L
    const yy = -H + t * L
    const k = (yy - yBot) / (yTop - yBot)
    const lin = taper + (1 - taper) * k
    st.push({ y: yy, ra: raT * lin * bulge[1], rb: rbT * lin * bulge[1] })
  }
  for (let k = yTop - yBot > 0.05 ? 0 : 1; k <= CAP_STEPS; k++) {
    const phi = ((90 * k) / CAP_STEPS * Math.PI) / 180
    st.push({ y: yTop + cT * Math.sin(phi), ra: raT * Math.cos(phi), rb: rbT * Math.cos(phi) })
  }
  return st
}

/** Smooth (Catmull-Rom) resampling of a hand-written profile [u, kx, kz] into stations of a given size [W, L, D]. */
function profileStations(prof: number[][], W: number, L: number, D: number, sub: number): Station[] {
  const out: Station[] = []
  const n = prof.length
  const at = (i: number): number[] => prof[Math.max(0, Math.min(n - 1, i))]
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < sub; k++) {
      const t = k / sub
      const u = cr(at(i - 1)[0], at(i)[0], at(i + 1)[0], at(i + 2)[0], t)
      const kx = Math.max(0, cr(at(i - 1)[1], at(i)[1], at(i + 1)[1], at(i + 2)[1], t))
      const kz = Math.max(0, cr(at(i - 1)[2], at(i)[2], at(i + 1)[2], at(i + 2)[2], t))
      out.push({ y: -L / 2 + u * L, ra: (kx * W) / 2, rb: (kz * D) / 2 })
    }
  }
  out.push({ y: L / 2, ra: 0, rb: 0 })
  return out
}

/** Torso profile along its length: [position 0..1 from the hips up, width fraction, depth fraction]. Waist, chest, shoulders. */
export const TORSO_PROFILE: number[][] = [
  [0.0, 0.0, 0.0],
  [0.03, 0.55, 0.6],
  [0.1, 0.8, 0.84],
  [0.26, 0.72, 0.8],
  [0.43, 0.8, 0.92],
  [0.6, 0.92, 1.0],
  [0.78, 1.0, 0.94],
  [0.9, 0.84, 0.76],
  [0.965, 0.46, 0.5],
  [1.0, 0.0, 0.0],
]
/** Head profile from the chin up: a gentle egg, narrower at the jaw. */
export const HEAD_PROFILE: number[][] = [
  [0.0, 0.0, 0.0],
  [0.03, 0.3, 0.34],
  [0.1, 0.58, 0.62],
  [0.22, 0.78, 0.8],
  [0.4, 0.95, 0.95],
  [0.58, 1.0, 1.0],
  [0.75, 0.95, 0.96],
  [0.88, 0.78, 0.82],
  [0.96, 0.46, 0.5],
  [1.0, 0.0, 0.0],
]

/** Section (width, depth) of the torso at position u (0..1 up the torso) for a torso of the given size. */
function torsoSection(size: number[], u: number): number[] {
  const st = profileStations(TORSO_PROFILE, size[0], size[1], size[2], 6)
  const y = -size[1] / 2 + u * size[1]
  let best = st[0]
  for (const s of st) if (Math.abs(s.y - y) < Math.abs(best.y - y)) best = s
  return [best.ra * 2, best.rb * 2]
}

/** Size of a tag band (width, depth) that clears the torso everywhere along `thick` cm centred on position uC. */
export function torsoBandFit(size: number[], uC: number, thick: number, clearance: number): number[] {
  const half = thick / 2 / size[1]
  let w = 0
  let d = 0
  for (let k = 0; k <= 8; k++) {
    const sec = torsoSection(size, Math.max(0, Math.min(1, uC - half + (2 * half * k) / 8)))
    w = Math.max(w, sec[0])
    d = Math.max(d, sec[1])
  }
  return [w + clearance, d + clearance]
}

/** Torso radii (ra across X, rb across Z) at height y (cm from the torso centre), linearly interpolated between stations. */
function torsoRadiiAt(st: Station[], y: number): number[] {
  for (let i = 0; i < st.length - 1; i++) {
    if (y >= st[i].y && y <= st[i + 1].y) {
      const k = (y - st[i].y) / (st[i + 1].y - st[i].y || 1)
      return [st[i].ra + (st[i + 1].ra - st[i].ra) * k, st[i].rb + (st[i + 1].rb - st[i].rb) * k]
    }
  }
  return [0, 0]
}

/**
 * Stations of a narrow tag band that hugs the torso: `thick` cm tall, centred on position uC (0..1) up a torso of the given
 * size, standing `off` cm proud of the surface at its middle and rounding off to just under the surface at both edges
 * (no sharp rim). Closed with a pole at each end (hidden inside the torso).
 */
export function bandStations(size: number[], uC: number, thick: number, off: number): Station[] {
  const torso = profileStations(TORSO_PROFILE, size[0], size[1], size[2], 6)
  const yc = -size[1] / 2 + uC * size[1]
  const N = 8
  const out: Station[] = [{ y: yc - thick / 2, ra: 0, rb: 0 }]
  for (let k = 0; k <= N; k++) {
    const t = (2 * k) / N - 1
    const y = yc + (t * thick) / 2
    const r = torsoRadiiAt(torso, y)
    const o = -0.8 + (off + 0.8) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 4)), 0.25)
    out.push({ y: y, ra: Math.max(0.1, r[0] + o), rb: Math.max(0.1, r[1] + o) })
  }
  out.push({ y: yc + thick / 2, ra: 0, rb: 0 })
  return out
}

/** Largest radius gap the band leaves over the torso surface, and its height; used by tests. */
export function bandExtent(size: number[], uC: number, thick: number, off: number): { minProud: number; maxProud: number; height: number } {
  const torso = profileStations(TORSO_PROFILE, size[0], size[1], size[2], 6)
  const st = bandStations(size, uC, thick, off).slice(1, -1)
  let mn = 1e9
  let mx = -1e9
  for (const s of st) {
    const r = torsoRadiiAt(torso, s.y)
    for (const d of [s.ra - r[0], s.rb - r[1]]) {
      mn = Math.min(mn, d)
      mx = Math.max(mx, d)
    }
  }
  return { minProud: mn, maxProud: mx, height: st[st.length - 1].y - st[0].y }
}

/** A solid elliptic cylinder along local Y (flat caps): used for tag bands and cuffs. */
function ringGeometry(a: number, L: number, b: number): Geometry {
  const ra = a / 2
  const rb = b / 2
  const H = L / 2
  const g: Geometry = { pos: [], nrm: [], idx: [], u: [] }
  for (const y of [-H, H]) {
    for (let j = 0; j < RING_SEGMENTS; j++) {
      const th = (j / RING_SEGMENTS) * Math.PI * 2
      const ct = Math.cos(th)
      const st = Math.sin(th)
      g.pos.push(ra * ct, y, rb * st)
      const nx = ct / ra
      const nz = st / rb
      const l = Math.sqrt(nx * nx + nz * nz) || 1
      g.nrm.push(nx / l, 0, nz / l)
      g.u.push(0.5)
    }
  }
  for (let j = 0; j < RING_SEGMENTS; j++) {
    const j2 = (j + 1) % RING_SEGMENTS
    addTri(g, j, j2, RING_SEGMENTS + j2)
    addTri(g, j, RING_SEGMENTS + j2, RING_SEGMENTS + j)
  }
  for (const sgn of [-1, 1]) {
    const centre = g.pos.length / 3
    g.pos.push(0, sgn * H, 0)
    g.nrm.push(0, sgn, 0)
    g.u.push(0.5)
    const base = g.pos.length / 3
    for (let j = 0; j < RING_SEGMENTS; j++) {
      const th = (j / RING_SEGMENTS) * Math.PI * 2
      g.pos.push(ra * Math.cos(th), sgn * H, rb * Math.sin(th))
      g.nrm.push(0, sgn, 0)
      g.u.push(0.5)
    }
    for (let j = 0; j < RING_SEGMENTS; j++) {
      addTri(g, centre, base + j, base + ((j + 1) % RING_SEGMENTS))
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
  if (nx * nx + ny * ny + nz * nz < 1e-9) return // degenerate (a pole)
  const sx = g.nrm[i0 * 3] + g.nrm[i1 * 3] + g.nrm[i2 * 3]
  const sy = g.nrm[i0 * 3 + 1] + g.nrm[i1 * 3 + 1] + g.nrm[i2 * 3 + 1]
  const sz = g.nrm[i0 * 3 + 2] + g.nrm[i1 * 3 + 2] + g.nrm[i2 * 3 + 2]
  if (nx * sx + ny * sy + nz * sz >= 0) g.idx.push(i0, i1, i2)
  else g.idx.push(i0, i2, i1)
}

const geomCache: { [k: string]: Geometry } = {}
export function partGeometry(p: Part): Geometry {
  const key = p.shape + ":" + p.size.map((v) => Math.round(v * 100)).join(",") + ":" + (p.taper === undefined ? 1 : p.taper) + ":" + (p.bulge ? p.bulge.join(",") : "")
  let g = geomCache[key]
  if (!g) {
    if (p.shape === "band") g = loftGeometry(bandStations(p.size, p.bulge![0], p.bulge![1], p.bulge![2]), RING_SEGMENTS)
    else if (p.shape === "ring") g = ringGeometry(p.size[0], p.size[1], p.size[2])
    else if (p.shape === "torso") g = loftGeometry(profileStations(TORSO_PROFILE, p.size[0], p.size[1], p.size[2], 3), SEGMENTS)
    else if (p.shape === "head") g = loftGeometry(profileStations(HEAD_PROFILE, p.size[0], p.size[1], p.size[2], 3), SEGMENTS)
    else g = loftGeometry(capsuleStations(p.size[0], p.size[1], p.size[2], p.taper === undefined ? 1 : p.taper, p.bulge), SEGMENTS)
    geomCache[key] = g
  }
  return g
}

export interface Baked {
  /** interleaved: position (3), normal (3), colour (4) */
  verts: number[]
  idx: number[]
}

/** Soft baked shading: a gentle top-to-bottom gradient (faces that point down are a bit darker), darker at the ends of
 *  limbs where they meet a joint. Never below about 0.8, so the darkest side stays clearly visible. */
function bakedShade(p: Part, ny: number, u: number, withNormal: boolean): number {
  let f = p.tone === undefined ? 1 : p.tone
  f *= withNormal ? 0.9 + 0.1 * Math.max(-1, Math.min(1, ny)) : 0.95
  if (p.ends) {
    const e = Math.abs(2 * u - 1)
    f *= 1 - p.ends * Math.pow(e, 4)
  }
  return f
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
      const rn = qRot(p.rot, ln)
      let wp: number[]
      let wn: number[]
      if (local) {
        wp = lp
        wn = ln
      } else {
        wp = add(p.pos, qRot(p.rot, lp))
        wn = rn
      }
      const f = inflate > 0 ? 1 : bakedShade(p, rn[1], g.u[i], !local)
      out.verts.push(wp[0], wp[1], wp[2], wn[0], wn[1], wn[2], p.col[0] * f, p.col[1] * f, p.col[2] * f, 1)
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
