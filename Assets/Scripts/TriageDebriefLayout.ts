/**
 * TriageDebriefLayout.ts - the debrief panel's measurements and reveal order, pure (no Lens API) so Node can test them.
 * Used by TriageDebrief.ts, which only draws what this works out.
 *
 * Table (cm, in the panel's plane, panel width 62):
 *   summary: two title-size lines, centred.
 *   view notes (0-2 lines, small size, centred) directly under the summary: when everyone came into view, and whether the
 *   player started before seeing everyone.
 *   per casualty, one row of up to three lines:
 *     line 1: "#  name .............. stats"   (a missed casualty: "#  NOT REACHED" in title size, flashing red)
 *     line 2: "   You WORD     Correct WORD"      (a missed casualty: "   name     Correct WORD")
 *     line 3: "   explanation"                    (small size, lighter; wraps to a second line when long)
 *   columns: A = the number (left edge), B = text start, C = the "Correct" label, D = the correct word.
 */

export const PANEL_W = 62
export const MARGIN = 2.2
export const LEFT = -PANEL_W / 2 + MARGIN
export const RIGHT = PANEL_W / 2 - MARGIN
export const COL_B = LEFT + 5.2
export const COL_YOU_WORD = COL_B + 5.4
export const COL_C = -0.5
export const COL_D = 10.4

/** The three text sizes the layout is worked out for (TriageUi.DEBRIEF_SIZES: the shared sizes at 1.2 m, enlarged by 1.4). */
export interface Sizes {
  title: number
  body: number
  small: number
}

const LINE = 1.2 // line pitch = em * LINE
const PAD_Y = 2
const ROW_GAP = 0.7
/** about this many characters of explanation fit on one line at the small size across the table's text columns */
export const EXPLANATION_CHARS_PER_LINE = 44

export function pitch(size: number): number {
  return (size / 43.9) * LINE
}

export interface RowIn {
  id: string
  row: number
  status: string
  explanation: string
}

export interface RowLayout {
  id: string
  row: number
  missed: boolean
  line1Size: number
  y1: number
  y2: number
  y3: number
  lines3: number
  p3: number
}

export interface PanelLayout {
  height: number
  summaryY: number[]
  /** centre of each view-note line (small size) */
  noteY: number[]
  rows: RowLayout[]
}

export function layoutPanel(entries: RowIn[], sizes: Sizes, notes: number = 0): PanelLayout {
  let cursor = PAD_Y
  const summaryY: number[] = []
  const pSum = pitch(sizes.title)
  for (let i = 0; i < 2; i++) {
    summaryY.push(-(cursor + pSum / 2))
    cursor += pSum
  }
  const noteY: number[] = []
  const pNote = pitch(sizes.small)
  for (let i = 0; i < notes; i++) {
    noteY.push(-(cursor + pNote / 2))
    cursor += pNote
  }
  cursor += ROW_GAP
  const rows: RowLayout[] = []
  for (const e of entries) {
    const missed = e.status === "missed"
    const s1 = missed ? sizes.title : sizes.body
    const p1 = pitch(s1)
    const y1 = -(cursor + p1 / 2)
    cursor += p1
    const p2 = pitch(sizes.body)
    const y2 = -(cursor + p2 / 2)
    cursor += p2
    let lines3 = 0
    let p3 = 0
    let y3 = 0
    if (e.explanation) {
      lines3 = Math.max(1, Math.ceil(e.explanation.length / EXPLANATION_CHARS_PER_LINE))
      p3 = pitch(sizes.small) * lines3
      y3 = -(cursor + p3 / 2)
      cursor += p3
    }
    cursor += ROW_GAP
    rows.push({ id: e.id, row: e.row, missed: missed, line1Size: s1, y1: y1, y2: y2, y3: y3, lines3: lines3, p3: p3 })
  }
  cursor += PAD_Y - ROW_GAP
  return { height: cursor, summaryY: summaryY, noteY: noteY, rows: rows }
}

/** Largest explanation line length (characters) the table is designed for; scoring keeps every line within it. */
export const MAX_EXPLANATION_CHARS = 40

// ------------------------------------------------------------------ reveal order

export type RevealKind = "panel" | "missed" | "row"
export interface RevealStep {
  kind: RevealKind
  id: string | null
  /** seconds after the panel starts to appear */
  at: number
}

export const REVEAL_FIRST_AT = 0.55 // after the panel and summary are in
export const REVEAL_ROW_SPACING = 0.45
export const REVEAL_FADE_SECONDS = 0.28

/**
 * Order of appearance after "Time's up" and a short pause: the panel (plate and summary) first; then everyone missed
 * (their NOT REACHED row, the marker over the real person) together; then the other rows one by one.
 */
export function revealSchedule(entries: RowIn[]): RevealStep[] {
  const steps: RevealStep[] = [{ kind: "panel", id: null, at: 0 }]
  let t = REVEAL_FIRST_AT
  const missed = entries.filter((e) => e.status === "missed")
  const others = entries.filter((e) => e.status !== "missed")
  for (const e of missed) steps.push({ kind: "missed", id: e.id, at: t })
  if (missed.length > 0) t += REVEAL_ROW_SPACING + 0.15
  for (const e of others) {
    steps.push({ kind: "row", id: e.id, at: t })
    t += REVEAL_ROW_SPACING
  }
  return steps
}

/** Short pause (s) between the Time's up panel stepping aside and the debrief panel appearing. */
export const PAUSE_AFTER_TIMES_UP = 0.4
