/**
 * TriageLayout.ts - pure, seedable casualty selection + layout (NO engine dependencies).
 * Owns: choosing which 4 casualties appear in a run and where they lie, from a seed.
 * Coordinates are floor-relative centimetres: x right, z toward the user's BACK (user starts at 0,0
 * facing -Z, so negative z is in front, positive z is behind).
 * Rules (design brief "Rules for choosing a run's casualties"):
 *  - exactly 1 walker (W1/W2/W3) + 3 non-walkers from A-H, J and X
 *  - the casualty behind the start position is always a breathing non-walker (A-E, G, H or J), never F or X
 *  - X (Black) in about 1 run in 3 ("auto"), never behind; forceBlack on/off overrides when a fixed seed is set
 *  - same seed + same forceBlack => identical layout
 * Must not: touch the scene.
 */
import {
  CasualtyId,
  CASUALTY_TABLE,
  PoseKind,
  POSE_CHOICES,
  POSE_INFO,
  WALKER_IDS,
  BEHIND_IDS,
  NON_WALKER_IDS,
  LEGACY_WALKER_IDS,
  LEGACY_BEHIND_IDS,
  LEGACY_NON_WALKER_IDS,
} from "./TriageData"

export type ForceBlack = "auto" | "on" | "off"
export type SlotName = "behind" | "wall" | "frontLeft" | "frontRight"

export interface PlacedCasualty {
  id: CasualtyId
  slot: SlotName
  /** floor-relative centimetres */
  x: number
  z: number
  /** rotation about Y in degrees (0 = lying head points away from the start position / sitting faces the user) */
  yawDeg: number
  /** the pose this case takes in this run (one of POSE_CHOICES[id]) */
  pose: PoseKind
  behind: boolean
  /** slumped casualty away from the wall needs a small backrest */
  needsBackrest: boolean
}

export interface RunLayout {
  seed: number
  forceBlack: ForceBlack
  blackIncluded: boolean
  walkerId: CasualtyId
  behindId: CasualtyId
  casualties: PlacedCasualty[]
}

/** Slot ranges in cm (floor-relative). Chosen so every pair is >= ~1.5 m apart. */
export const ROOM = {
  frontWallZ: -410,
  wallCasualtyZ: -380,
  halfWidth: 250,
  backZ: 260,
  slots: {
    frontLeft: { xMin: -110, xMax: -85, zMin: -250, zMax: -225 },
    frontRight: { xMin: 85, xMax: 110, zMin: -250, zMax: -225 },
    wall: { xMin: -5, xMax: 5, zMin: -380, zMax: -380 },
    behind: { xMin: -60, xMax: 60, zMin: 190, zMax: 220 },
  },
  /** green MINOR zone: 1.5 m front-left of the start position, always in front */
  minorZone: { x: -106, z: -106, diameterCm: 100 },
}

/**
 * The named demo seed for the video recording (use it with Black = "on"; TriageMain "Use demo seed" does both).
 * Layout (floor-relative cm, x right, z toward the user's back): D (lying, groaning, breathing) BEHIND, to the right
 * at about (46, 213); C slumped at the WALL (0, -380); X (Expectant) front-left at about (-95, -238);
 * W1 (the walker, arm cut) front-right at about (96, -249).
 */
export const DEMO_SEED = 77

/** Which cases lie where (ignores the small position jitter): used to make a restart change the layout. */
export function layoutSignature(run: RunLayout): string {
  return run.casualties.map((c) => c.id + ":" + c.slot).join(",")
}

export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function CASUALTY_DEFAULT_POSE(id: CasualtyId): PoseKind {
  return CASUALTY_TABLE[id].pose
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

function range(rng: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * rng()
}

/** seed > 0 is used as-is (fixed); 0 or negative picks a random seed from nowMs. */
export function resolveSeed(seed: number, nowMs: number): { seed: number; fixed: boolean } {
  if (seed > 0) {
    return { seed: Math.floor(seed), fixed: true }
  }
  return { seed: (Math.floor(nowMs) % 2147483646) + 1, fixed: false }
}

export function generateRun(seed: number, forceBlack: ForceBlack): RunLayout {
  const rng = mulberry32(seed)
  const blackRoll = rng()
  const black = forceBlack === "on" ? true : forceBlack === "off" ? false : blackRoll < 1 / 3
  // The demo seed keeps drawing from the original pool (W1/W2, A-F), so its documented layout never changes. Every other
  // seed draws from the bigger pool. The random draws are the same in number either way, so positions do not shift.
  const legacy = seed === DEMO_SEED
  const walkerId: CasualtyId = pick<CasualtyId>(rng, legacy ? LEGACY_WALKER_IDS : WALKER_IDS)
  const behindId = pick<CasualtyId>(rng, legacy ? LEGACY_BEHIND_IDS : BEHIND_IDS)
  const rest = (legacy ? LEGACY_NON_WALKER_IDS : NON_WALKER_IDS).filter((id) => id !== behindId)
  let others: CasualtyId[]
  if (black) {
    others = ["X", pick(rng, rest)]
  } else {
    const first = pick(rng, rest)
    const second = pick(rng, rest.filter((id) => id !== first))
    others = [first, second]
  }
  const front = shuffle<CasualtyId>(rng, [walkerId, others[0], others[1]])

  // wall slot: prefer slumped C, else any upright casualty, else the first
  let wallId: CasualtyId = front[0]
  if (front.indexOf("C") >= 0) {
    wallId = "C"
  } else {
    for (let i = 0; i < front.length; i++) {
      if (CASUALTY_TABLE[front[i]].upright) {
        wallId = front[i]
        break
      }
    }
  }
  const sides = front.filter((id) => id !== wallId)
  const assignments: { id: CasualtyId; slot: SlotName }[] = [
    { id: behindId, slot: "behind" },
    { id: wallId, slot: "wall" },
    { id: sides[0], slot: "frontLeft" },
    { id: sides[1], slot: "frontRight" },
  ]

  const casualties: PlacedCasualty[] = assignments.map((a) => {
    const r = ROOM.slots[a.slot]
    const x = range(rng, r.xMin, r.xMax)
    const z = range(rng, r.zMin, r.zMax)
    const yaw = a.slot === "wall" ? 0 : a.slot === "behind" || a.slot === "frontLeft" ? 180 + range(rng, -50, 50) : range(rng, -60, 60)
    return {
      id: a.id,
      slot: a.slot,
      x: Math.round(x * 10) / 10,
      z: Math.round(z * 10) / 10,
      yawDeg: Math.round(yaw * 10) / 10,
      pose: CASUALTY_DEFAULT_POSE(a.id),
      behind: a.slot === "behind",
      needsBackrest: false,
    }
  })

  // Pose variation (a separate random stream, so the layout above is the same as before for every seed).
  // The demo seed keeps its documented poses and positions.
  if (seed !== DEMO_SEED) {
    const prng = mulberry32(Math.imul(seed | 0, 2246822519) ^ 0x2545f491)
    for (const c of casualties) {
      let choices = POSE_CHOICES[c.id]
      if (c.slot === "wall") {
        // against the wall: only a seated or slumped pose, back to the wall
        choices = choices.filter((k) => POSE_INFO[k].group !== "lying")
      }
      c.pose = pick(prng, choices)
      if (c.slot === "wall") {
        c.yawDeg = Math.round(range(prng, -8, 8) * 10) / 10
      } else {
        // a random turn of the whole body and a small shift, kept inside the slot and the play area
        c.yawDeg = Math.round(range(prng, 0, 360) * 10) / 10
        const r = ROOM.slots[c.slot]
        c.x = Math.round(Math.max(r.xMin, Math.min(r.xMax, c.x + range(prng, -10, 10))) * 10) / 10
        c.z = Math.round(Math.max(r.zMin, Math.min(r.zMax, c.z + range(prng, -10, 10))) * 10) / 10
      }
    }
  }
  for (const c of casualties) {
    // a slumped person away from the wall leans on a small backrest
    c.needsBackrest = POSE_INFO[c.pose].group === "slumped" && c.slot !== "wall"
  }

  return { seed, forceBlack, blackIncluded: black, walkerId, behindId, casualties }
}

/** Returns a list of rule violations (empty = valid). Unit-check helper. */
export function validateRun(run: RunLayout): string[] {
  const errs: string[] = []
  const ids = run.casualties.map((c) => c.id)
  if (run.casualties.length !== 4) errs.push("need 4 casualties")
  if (new Set(ids).size !== ids.length) errs.push("duplicate casualty")
  const walkers = ids.filter((id) => CASUALTY_TABLE[id].walks)
  if (walkers.length !== 1) errs.push("need exactly 1 walker, got " + walkers.length)
  const behind = run.casualties.filter((c) => c.behind)
  if (behind.length !== 1) errs.push("need exactly 1 behind")
  else {
    const d = CASUALTY_TABLE[behind[0].id]
    if (d.walks || !d.breathing || ["F", "X"].indexOf(d.id) >= 0 || behind[0].z <= 0) errs.push("behind must be a breathing non-walker (not F or X) with z>0")
  }
  const xs = run.casualties.filter((c) => c.id === "X")
  if (xs.length > 0 && xs[0].behind) errs.push("X must not be behind")
  for (let i = 0; i < run.casualties.length; i++) {
    for (let j = i + 1; j < run.casualties.length; j++) {
      const a = run.casualties[i]
      const b = run.casualties[j]
      const d = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z))
      if (d < 150) errs.push("casualties too close: " + a.id + "/" + b.id + " " + Math.round(d))
    }
  }
  for (const c of run.casualties) {
    const d = CASUALTY_TABLE[c.id]
    if (POSE_CHOICES[c.id].indexOf(c.pose) < 0) errs.push(c.id + " has a pose it may not take: " + c.pose)
    const group = POSE_INFO[c.pose] ? POSE_INFO[c.pose].group : "?"
    if (d.walks && group !== "sitting") errs.push(c.id + " walker must be seated")
    if ((c.id === "F" || c.id === "X") && group !== "lying") errs.push(c.id + " must lie still")
    if (c.slot === "wall" && group === "lying") errs.push(c.id + " at the wall must be seated or slumped")
    if (Math.abs(c.x) > ROOM.halfWidth || c.z < ROOM.frontWallZ || c.z > ROOM.backZ) errs.push(c.id + " outside the play area")
    if (!c.behind && c.z >= 0) errs.push(c.id + " in front slot but z>=0")
  }
  return errs
}
