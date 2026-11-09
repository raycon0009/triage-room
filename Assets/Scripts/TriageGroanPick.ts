/**
 * TriageGroanPick.ts - pure (no Lens API): which of the groan sounds plays.
 * Decided by the run's seed, so the same seed gives the same sounds in the same order.
 * pickGroan(seed, n, prev): the groan for play number n (0 = first) of a run; never the same as prev (the one before; -1 = none).
 */
export const GROAN_COUNT = 3

/** small integer hash (mulberry32 finaliser) of seed and play number */
function hash(seed: number, n: number): number {
  let a = ((seed | 0) + Math.imul(n + 1, 0x9e3779b9)) >>> 0
  a = (a + 0x6d2b79f5) >>> 0
  let t = Math.imul(a ^ (a >>> 15), a | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0)
}

export function pickGroan(seed: number, n: number, prev: number, count: number = GROAN_COUNT): number {
  const h = hash(seed, n)
  if (prev < 0 || prev >= count) return h % count
  // one of the other (count - 1) groans
  const k = h % (count - 1)
  return k >= prev ? k + 1 : k
}

/** the first `plays` groans of a run with this seed */
export function groanSequence(seed: number, plays: number, count: number = GROAN_COUNT): number[] {
  const out: number[] = []
  let prev = -1
  for (let i = 0; i < plays; i++) {
    prev = pickGroan(seed, i, prev, count)
    out.push(prev)
  }
  return out
}
