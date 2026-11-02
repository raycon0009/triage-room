/**
 * TriageLayout.ts - pure, seedable casualty selection + layout (NO engine dependencies).
 * Owns: choosing which 4 casualties appear in a run and where they lie, from a seed.
 * Coordinates are floor-relative centimetres: x right, z toward the user's BACK (user starts at 0,0
 * facing -Z, so negative z is in front, positive z is behind).
 * Rules (design brief "Rules for choosing a run's casualties"):
 *  - exactly 1 walker (W1/W2) + 3 non-walkers from A-F and X
 *  - the casualty behind the start position is always a breathing non-walker A-E
 *  - X (Black) in about 1 run in 3 ("auto"), never behind; forceBlack on/off overrides when a fixed seed is set
 *  - same seed + same forceBlack => identical layout
 * Must not: touch the scene.
 */
import { CasualtyId, CASUALTY_TABLE } from "./TriageData"

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

export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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
  const walkerId: CasualtyId = rng() < 0.5 ? "W1" : "W2"
  const behindId = pick<CasualtyId>(rng, ["A", "B", "C", "D", "E"])
  const rest = (["A", "B", "C", "D", "E", "F"] as CasualtyId[]).filter((id) => id !== behindId)
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
      behind: a.slot === "behind",
      needsBackrest: a.id === "C" && a.slot !== "wall",
    }
  })

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
    if (d.walks || !d.breathing || ["F", "X"].indexOf(d.id) >= 0 || behind[0].z <= 0) errs.push("behind must be breathing non-walker A-E with z>0")
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
    if (!c.behind && c.z >= 0) errs.push(c.id + " in front slot but z>=0")
  }
  return errs
}
