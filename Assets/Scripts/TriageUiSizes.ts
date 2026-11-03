/**
 * TriageUiSizes.ts - the three shared text sizes (title, body, small), pure so Node tests can use them.
 * Written for the check card's distance (70 cm); `sizesAt(distanceCm, boost)` keeps the same angular size at another
 * distance. `boost` (default 1) enlarges all three by one common factor (the debrief uses it: it is the panel read last
 * and longest, and an earlier request asked for large text there).
 */
export const FONT_AT_CARD = { title: 60, body: 50, small: 42 }
export const CARD_DISTANCE_CM = 70

export interface UiSizes {
  title: number
  body: number
  small: number
}

export function sizesAt(distanceCm: number, boost: number = 1): UiSizes {
  const k = (distanceCm / CARD_DISTANCE_CM) * boost
  return { title: Math.round(FONT_AT_CARD.title * k), body: Math.round(FONT_AT_CARD.body * k), small: Math.round(FONT_AT_CARD.small * k) }
}
