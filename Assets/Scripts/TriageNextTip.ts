/**
 * TriageNextTip.ts - the one-line tip for the next run, shown above the "Again" buttons (pure: no Lens API, so plain Node
 * can test it).
 * The first rule that matches wins (see tipFor). "In view" is head direction, so the wording never says "looked at".
 */
export type TipMode = "Learn" | "Drill"

/** What the tip needs to know about one casualty of the finished run. */
export interface TipCasualty {
  id: string
  /** the walker (tagged Green by a call-out) */
  walks: boolean
  /** "Red" | "Yellow" | "Green" | "Black" (Black = Expectant); null = never tagged */
  myTag: string | null
  correctTag: string
  extraChecks: number
}

export interface TipInput {
  mode: TipMode
  casualties: TipCasualty[]
  /** the first tag or call-out came before every casualty had been in view (FirstSeenTracker.startedBeforeEveryone) */
  startedBeforeEveryone: boolean
}

export const TIP_LOOK_ROUND = "Next run: look all the way round before your first check"
export const TIP_WALKER_GREEN = "Anyone who can walk is Green: call them out first"
export const TIP_AIRWAY_FIRST = "Open the airway before deciding Expectant"
export const TIP_X_EXPECTANT = "No breath even with the airway open: Expectant"
export const TIP_IN_ORDER = "Follow the steps in order: the first that decides is the tag"
export const TIP_STOP_CHECKING = "Stop checking once a step decides the tag"
export const TIP_READY_FOR_DRILL = "Ready for Drill: no arrow, and one groan"
export const TIP_FASTER_VIEW = "Next run: get everyone in view sooner"

export const ALL_TIPS = [
  TIP_LOOK_ROUND,
  TIP_WALKER_GREEN,
  TIP_AIRWAY_FIRST,
  TIP_X_EXPECTANT,
  TIP_IN_ORDER,
  TIP_STOP_CHECKING,
  TIP_READY_FOR_DRILL,
  TIP_FASTER_VIEW,
]

/** The longest tip, in characters: the width the tip line is laid out for. */
export const MAX_TIP_CHARS = 60

/** The tip for the next run: the first rule that matches. */
export function tipFor(input: TipInput): string {
  const cs = input.casualties
  // 1. someone was not reached, or the player started before seeing everyone
  if (cs.some((c) => c.myTag === null) || input.startedBeforeEveryone) return TIP_LOOK_ROUND
  // 2. the walker was not tagged Green
  if (cs.some((c) => c.walks && c.myTag !== "Green")) return TIP_WALKER_GREEN
  // 3. someone other than X was tagged Expectant
  if (cs.some((c) => c.id !== "X" && c.myTag === "Black")) return TIP_AIRWAY_FIRST
  // 4. X was tagged something other than Expectant
  if (cs.some((c) => c.id === "X" && c.myTag !== "Black")) return TIP_X_EXPECTANT
  // 5. any other wrong tag
  if (cs.some((c) => c.myTag !== c.correctTag)) return TIP_IN_ORDER
  // 6. any extra checks
  if (cs.some((c) => c.extraChecks > 0)) return TIP_STOP_CHECKING
  // 7 / 8. everything right
  return input.mode === "Learn" ? TIP_READY_FOR_DRILL : TIP_FASTER_VIEW
}
