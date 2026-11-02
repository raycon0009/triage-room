/**
 * TriageScoring.ts - pure debrief scoring (NO scene / Lens Studio dependencies; type-only import so plain Node can run it).
 * Owns: turning each casualty's record (my tag, time, extra checks) + the scripted table row into a debrief entry
 *       (my tag vs correct tag as colour + word, status correct / wrong / missed, one SHORT explanation line), putting
 *       the rows in debrief order (anyone missed first) and the summary (correct, missed, total extra checks, time used).
 * Rules: an untagged casualty is "missed" ("Not reached") and counts as a wrong tag.
 * Wording is deliberately short: the debrief panel uses large text in a small panel (build step 5).
 * Must not: touch the scene or the timer.
 */
import type { CasualtyDef } from "./TriageData"

export type DebriefStatus = "correct" | "wrong" | "missed"

const WORD: { [tag: string]: string } = { Green: "GREEN", Yellow: "YELLOW", Red: "RED", Black: "EXPECTANT" }

/** Short names for the debrief rows. */
export const SHORT_NAME: { [id: string]: string } = {
  W1: "Arm cut",
  W2: "Hurt ankle",
  A: "On back",
  B: "On side",
  C: "Slumped",
  D: "Groaning",
  E: "Dazed",
  F: "Face up",
  X: "Face up",
}

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
  /** short name for the debrief row */
  shortName: string
  /** row number in the debrief (1..n); anyone missed comes first. 0 until orderRows() has been applied */
  row: number
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
  /** compact "6 s · 0 extra" (a walker: "call-out 0:42 · 0 extra") */
  statsText: string
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
  /** the whole summary on one line */
  text: string
  /** the same summary split in two for the large-text panel: "3 of 4 correct · 1 missed" / "2 extra checks · 3:00 used" */
  lines: [string, string]
}

/** The START rule that decides this casualty, in one short line. */
export function ruleLine(def: CasualtyDef): string {
  switch (def.decidingStep) {
    case 0:
      return "Can walk → Green"
    case 2:
      return def.correctTag === "Black" ? "Not breathing even with airway open → Expectant: START saves time for those who can still be helped." : "Breathes only after airway opened → Red"
    case 3:
      return "Rate " + def.respRate + " is over 30 → Red"
    case 4:
      return def.radialPulse === "absent" ? "Radial pulse absent → Red" : "Refill " + def.refillSeconds + " s is over 2 → Red"
    case 5:
      return def.followsCommands ? "Rate under 30, pulse OK, obeys → Yellow" : "Rate under 30, pulse OK, no obey → Red"
    default:
      return ""
  }
}

export function explain(def: CasualtyDef, status: DebriefStatus): string {
  if (def.walks) return "Can walk → Green (reassessed later)"
  if (def.correctTag === "Black") return ruleLine(def) // why Expectant was the right call, even when tagged right
  if (status !== "correct") return ruleLine(def)
  return ""
}

export function buildEntry(input: ScoreInput): DebriefEntry {
  const def = input.def
  const status: DebriefStatus = input.tag === null ? "missed" : input.tag === def.correctTag ? "correct" : "wrong"
  const called = input.calledOut && input.calledOutAtSeconds !== null
  const time = called ? (input.calledOutAtSeconds as number) : input.openSeconds
  const timePart = called ? "call-out " + formatClock(input.calledOutAtSeconds as number) : Math.round(input.openSeconds) + " s"
  return {
    id: def.id,
    poseLabel: def.poseLabel,
    shortName: SHORT_NAME[def.id] || def.poseLabel,
    row: 0,
    status: status,
    notReached: status === "missed",
    myTag: input.tag,
    myWord: tagWord(input.tag),
    correctTag: def.correctTag,
    correctWord: tagWord(def.correctTag),
    timeSeconds: time,
    timeText: called ? "called out at " + formatClock(input.calledOutAtSeconds as number) : Math.round(input.openSeconds) + " s",
    statsText: timePart + " · " + input.extraChecks + " extra",
    extraChecks: input.extraChecks,
    calledOut: input.calledOut,
    explanation: explain(def, status),
  }
}

/** Debrief order: anyone "Not reached" comes first (row 1...), the rest keep their order. Numbers the rows 1..n. */
export function orderRows(entries: DebriefEntry[]): DebriefEntry[] {
  const missed = entries.filter((e) => e.status === "missed")
  const rest = entries.filter((e) => e.status !== "missed")
  return missed.concat(rest).map((e, i) => ({ ...e, row: i + 1 }))
}

export function summarize(entries: DebriefEntry[], timeUsedSeconds: number): DebriefSummary {
  const correct = entries.filter((e) => e.status === "correct").length
  const wrong = entries.filter((e) => e.status === "wrong").length
  const missed = entries.filter((e) => e.status === "missed").length
  const extra = entries.reduce((n, e) => n + e.extraChecks, 0)
  const a = correct + " of " + entries.length + " correct · " + missed + " missed"
  const b = extra + (extra === 1 ? " extra check" : " extra checks") + " · " + formatClock(timeUsedSeconds) + " used"
  return { total: entries.length, correct: correct, wrong: wrong, missed: missed, totalExtraChecks: extra, timeUsedSeconds: timeUsedSeconds, text: a + " · " + b, lines: [a, b] }
}
