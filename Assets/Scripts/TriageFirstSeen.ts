/**
 * TriageFirstSeen.ts - when did each casualty first come into view? (pure: no scene or Lens Studio dependencies, so plain
 * Node can test it.)
 * Owns: the run time at which each casualty first came into view, and when the first tag or call-out happened, plus the
 *       one or two debrief lines worked out from them.
 * "In view" is decided by the caller (TriageBehindCue uses the head-or-torso-inside-the-field-of-view rule); this module
 * only records it. It is head direction, not eye tracking, so the wording is "in view", never "looked at".
 * Sampling stops when the run ends (stop()); reset() starts a fresh run.
 */
export class FirstSeenTracker {
  private ids: string[] = []
  private seen: { [id: string]: number | null } = {}
  private action: number | null = null
  private ended = false

  /** Start a fresh run for these casualties (Restart calls this too). */
  reset(ids: string[]): void {
    this.ids = ids.slice()
    this.seen = {}
    for (const id of ids) this.seen[id] = null
    this.action = null
    this.ended = false
  }

  /** The run is over: later samples and actions are ignored. */
  stop(): void {
    this.ended = true
  }

  isStopped(): boolean {
    return this.ended
  }

  /** One look at the view at run time `t` seconds: which casualties are in view right now. Only the first time counts. */
  sample(t: number, inView: { [id: string]: boolean }): void {
    if (this.ended) return
    for (const id of this.ids) {
      if (inView[id] && this.seen[id] === null) this.seen[id] = t
    }
  }

  /** The first tag or call-out, at run time `t`. Later ones are ignored. */
  noteAction(t: number): void {
    if (this.ended || this.action !== null) return
    this.action = t
  }

  firstSeenAt(id: string): number | null {
    const v = this.seen[id]
    return v === undefined ? null : v
  }

  firstActionAt(): number | null {
    return this.action
  }

  neverSeenCount(): number {
    let n = 0
    for (const id of this.ids) if (this.seen[id] === null) n++
    return n
  }

  /** The time the last casualty first came into view; null if someone never did. */
  allSeenAt(): number | null {
    if (this.ids.length === 0 || this.neverSeenCount() > 0) return null
    let m = 0
    for (const id of this.ids) m = Math.max(m, this.seen[id] as number)
    return m
  }

  /** True when the first tag or call-out came before every casualty had been in view. */
  startedBeforeEveryone(): boolean {
    if (this.action === null) return false
    for (const id of this.ids) {
      const s = this.seen[id]
      if (s === null || s > this.action) return true
    }
    return false
  }

  /**
   * The debrief lines: "Everyone in view by 0:48", or "1 person never came into view" / "2 people never came into view";
   * then "You started before seeing everyone" when it applies.
   */
  lines(): string[] {
    if (this.ids.length === 0) return []
    const out: string[] = []
    const never = this.neverSeenCount()
    if (never === 0) out.push("Everyone in view by " + clock(this.allSeenAt() as number))
    else out.push(never === 1 ? "1 person never came into view" : never + " people never came into view")
    if (this.startedBeforeEveryone()) out.push("You started before seeing everyone")
    return out
  }
}

/** "m:ss", rounded to the nearest second (the same rounding as the debrief's time used). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m + ":" + (r < 10 ? "0" : "") + r
}
