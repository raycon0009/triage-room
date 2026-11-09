/**
 * TriageLookRing.ts - which directions were in view before the player started? (pure: no scene or Lens Studio
 * dependencies, so plain Node can test it.)
 * Owns: the 12 segments of a circle around the start position (30 degrees each, segment k centred on k * 30 degrees),
 *       and which of them were in view at any sampled moment from Start until the first tag or call-out (or the end
 *       of the run, if the player never tags or calls out).
 * Direction: yaw in degrees, 0 = straight ahead (the room's front, the start view), positive = to the right.
 * "In view" is head direction: a segment counts as in view when its centre direction was inside the camera's
 * horizontal field of view. It is not eye tracking, so the wording is "in view", never "looked at".
 * Sampling stops at the first action (noteAction) or when the run ends (stop()); reset() starts a fresh run.
 */
export const RING_SEGMENTS = 12
export const SEGMENT_DEG = 360 / RING_SEGMENTS

/** Yaw (degrees, 0 = ahead = world -Z, positive = right = world +X) of a horizontal direction (x, z). */
export function yawDegOf(x: number, z: number): number {
  return (Math.atan2(x, -z) * 180) / Math.PI
}

/** Smallest absolute difference between two angles in degrees, 0..180, wrapping around 0/360. */
export function angleGap(a: number, b: number): number {
  let d = (a - b) % 360
  if (d < 0) d += 360
  return d > 180 ? 360 - d : d
}

export class LookRingTracker {
  private lit: boolean[] = []
  private stopped = false

  constructor() {
    this.reset()
  }

  /** A fresh run: nothing lit, sampling on. */
  reset(): void {
    this.lit = []
    for (let i = 0; i < RING_SEGMENTS; i++) this.lit.push(false)
    this.stopped = false
  }

  /** The first tag or call-out, or the end of the run: later samples are ignored. */
  stop(): void {
    this.stopped = true
  }

  /** Same as stop(): the first tag or call-out ends the sampling. */
  noteAction(): void {
    this.stopped = true
  }

  isStopped(): boolean {
    return this.stopped
  }

  /** One look at the view: the head points along yaw `yawDeg` and sees `halfFovDeg` either side of it. */
  sample(yawDeg: number, halfFovDeg: number): void {
    if (this.stopped) return
    for (let k = 0; k < RING_SEGMENTS; k++) {
      if (angleGap(k * SEGMENT_DEG, yawDeg) <= halfFovDeg) this.lit[k] = true
    }
  }

  isLit(k: number): boolean {
    return k >= 0 && k < RING_SEGMENTS && this.lit[k]
  }

  litFlags(): boolean[] {
    return this.lit.slice()
  }

  litCount(): number {
    let n = 0
    for (const v of this.lit) if (v) n++
    return n
  }

  /** The segment (0..11) that contains this yaw. */
  static segmentOf(yawDeg: number): number {
    let d = (yawDeg + SEGMENT_DEG / 2) % 360
    if (d < 0) d += 360
    return Math.floor(d / SEGMENT_DEG) % RING_SEGMENTS
  }
}

/** The label drawn beside the ring on the debrief map. */
export const RING_LABEL = "Lit: in view before you started"
