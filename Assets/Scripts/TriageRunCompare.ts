/**
 * TriageRunCompare.ts - the debrief's comparison with the run just before (pure: no Lens API, so plain Node can test it).
 * Owns: the short record of one finished run (mode, correct tags, when everyone came into view) and the two lines
 *       "Last run (Learn): 3 of 4 · all in view 0:50" / "This run (Drill): 4 of 4 · all in view 0:22".
 * Neutral wording only: numbers and mode names, nothing that says better or worse. "In view" is head direction, never
 * "looked at". The record is kept in memory by TriageDebrief for the length of one Lens session (nothing is saved).
 */
import { clock } from "./TriageFirstSeen"

export type RunMode = "Learn" | "Drill"

/** What is remembered about a run that reached a debrief. */
export interface RunRecord {
  mode: RunMode
  /** correct tags; anyone not reached counts as wrong, as in the summary */
  correct: number
  total: number
  /** run time (s) at which the last casualty first came into view; null if someone never did */
  allSeenAt: number | null
  /** how many casualties never came into view */
  neverInView: number
}

/** The longest a comparison line may be (characters) so it stays on one line at the small size inside the panel. */
export const MAX_COMPARE_CHARS = 44

export function makeRecord(mode: RunMode, correct: number, total: number, allSeenAt: number | null, neverInView: number): RunRecord {
  return { mode: mode, correct: correct, total: total, allSeenAt: allSeenAt, neverInView: neverInView }
}

function viewPart(r: RunRecord): string {
  if (r.neverInView > 0 || r.allSeenAt === null) return Math.max(1, r.neverInView) + " never in view"
  return "all in view " + clock(r.allSeenAt)
}

/** One line: "Last run (Learn): 3 of 4 · all in view 0:50". */
export function describeRun(label: "Last run" | "This run", r: RunRecord): string {
  return label + " (" + r.mode + "): " + r.correct + " of " + r.total + " · " + viewPart(r)
}

/** The comparison lines for the debrief: none for the first run of a session (no earlier run), else last run then this run. */
export function compareLines(last: RunRecord | null, current: RunRecord): string[] {
  if (last === null) return []
  return [describeRun("Last run", last), describeRun("This run", current)]
}
