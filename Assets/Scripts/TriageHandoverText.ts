/**
 * TriageHandoverText.ts - the handover question at the end of a run (pure: no Lens API, so plain Node can test it).
 * The ambulance crew arrives and asks how many need to go first (Red). The question never shows or hints at the answer;
 * only the result line does, after the player has answered.
 */
export const HANDOVER_LINE_1 = "The ambulance crew is here."
export const HANDOVER_LINE_2 = "How many need to go first (Red)?"
export const HANDOVER_CHOICES = [0, 1, 2, 3, 4]

/** How many casualties of the run have Red as their correct tag (anyone not reached is still counted). */
export function redCount(correctTags: string[]): number {
  let n = 0
  for (const t of correctTags) if (t === "Red") n++
  return n
}

/** The result line, in neutral wording: "Handover: you said 2 · 3 Red in the room" (the same line when the answer matches). */
export function handoverLine(said: number, red: number): string {
  return "Handover: you said " + said + " · " + red + " Red in the room"
}

export const MAX_HANDOVER_CHARS = 40
