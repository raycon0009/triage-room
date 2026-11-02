/**
 * TriageScoring.ts - pure debrief scoring (NO scene / Lens Studio dependencies; type-only import so plain Node can run it).
 * Owns: turning each casualty's record (my tag, time, extra checks) + the scripted table row into a debrief entry
 *       (my tag vs correct tag as colour + word, status correct / wrong / missed, one explanation line) and the summary
 *       (correct, missed, total extra checks, time used).
 * Rules: an untagged casualty is "missed" ("Not reached") and counts as a wrong tag.
 * Explanations are one short line, only where they apply: the Expectant case, walkers, and any wrong or missed tag
 * (which START step decides it, e.g. "Rate 34 is over 30 → Red").
 * Must not: touch the scene or the timer.
 */
import type { CasualtyDef } from "./TriageData"

export type DebriefStatus = "correct" | "wrong" | "missed"

const WORD: { [tag: string]: string } = { Green: "GREEN", Yellow: "YELLOW", Red: "RED", Black: "EXPECTANT" }

export function tagWord(tag: string | null): string {
  return tag ? WORD[tag] || tag.toUpperCase() : ""
}

/** "m:ss" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m + ":" + (r < 10 ? "0" : "") + r
}

export interface ScoreInput {
  def: CasualtyDef
  /** the tag the player chose (Green / Yellow / Red / Black), null = never tagged */
  tag: string | null
  /** seconds the card was open for this casualty */
  openSeconds: number
  extraChecks: number
  calledOut: boolean
  calledOutAtSeconds: number | null
}

export interface DebriefEntry {
  id: string
  poseLabel: string
  status: DebriefStatus
  /** true when the casualty was never tagged ("Not reached") */
  notReached: boolean
  myTag: string | null
  myWord: string
  correctTag: string
  correctWord: string
  /** seconds spent (card open); for a called-out walker, the run time of the call-out */
  timeSeconds: number
  timeText: string
  extraChecks: number
  calledOut: boolean
  /** one short line, "" when nothing applies */
  explanation: string
}

export interface DebriefSummary {
  total: number
  correct: number
  /** tagged, but with the wrong tag */
  wrong: number
  /** never tagged ("Not reached"); each also counts as a wrong tag */
  missed: number
  totalExtraChecks: number
  timeUsedSeconds: number
  text: string
}

/** The START rule that decides this casualty, in one short line. */
export function ruleLine(def: CasualtyDef): string {
  switch (def.decidingStep) {
    case 0:
      return "Can walk → Green"
    case 2:
      return def.correctTag === "Black" ? "Not breathing after the airway was opened → Expectant" : "Breathes after the airway was opened → Red"
    case 3:
      return "Rate " + def.respRate + " is over 30 → Red"
    case 4:
      return def.radialPulse === "absent" ? "Radial pulse absent → Red" : "Refill " + def.refillSeconds + " s is over 2 → Red"
    case 5:
      return def.followsCommands ? "Follows commands → Yellow" : "Cannot follow commands → Red"
    default:
      return ""
  }
}

export function explain(def: CasualtyDef, status: DebriefStatus): string {
  if (def.walks) return "Can walk → Green (real START reassesses walkers later)"
  if (def.correctTag === "Black") return "Still not breathing after the airway was opened, so Expectant was the right call"
  if (status !== "correct") return ruleLine(def)
  return ""
}

export function buildEntry(input: ScoreInput): DebriefEntry {
  const def = input.def
  const status: DebriefStatus = input.tag === null ? "missed" : input.tag === def.correctTag ? "correct" : "wrong"
  const time = input.calledOut && input.calledOutAtSeconds !== null ? input.calledOutAtSeconds : input.openSeconds
  return {
    id: def.id,
    poseLabel: def.poseLabel,
    status: status,
    notReached: status === "missed",
    myTag: input.tag,
    myWord: tagWord(input.tag),
    correctTag: def.correctTag,
    correctWord: tagWord(def.correctTag),
    timeSeconds: time,
    timeText: input.calledOut && input.calledOutAtSeconds !== null ? "called out at " + formatClock(input.calledOutAtSeconds) : Math.round(input.openSeconds) + " s",
    extraChecks: input.extraChecks,
    calledOut: input.calledOut,
    explanation: explain(def, status),
  }
}

export function summarize(entries: DebriefEntry[], timeUsedSeconds: number): DebriefSummary {
  const correct = entries.filter((e) => e.status === "correct").length
  const wrong = entries.filter((e) => e.status === "wrong").length
  const missed = entries.filter((e) => e.status === "missed").length
  const extra = entries.reduce((n, e) => n + e.extraChecks, 0)
  const text =
    correct + " of " + entries.length + " correct · " + missed + " missed · " + extra + (extra === 1 ? " extra check" : " extra checks") + " · " + formatClock(timeUsedSeconds) + " used"
  return { total: entries.length, correct: correct, wrong: wrong, missed: missed, totalExtraChecks: extra, timeUsedSeconds: timeUsedSeconds, text: text }
}
