/**
 * TriageStartEngine.ts - pure START rules engine (NO scene / Lens Studio dependencies).
 * Owns: applying the brief's START rules in order; stops at the first rule that decides the tag;
 *       counting extra checks; the text of each scripted check result.
 * Input: a casualty's scripted findings + the checks the player has done.
 * Output: { decided, tag, decidingStep, extraChecks }.
 * Steps: 0 can walk, 1 breathing?, 2 breathing after airway, 3 rate over 30/min,
 *        4 radial pulse absent or refill over 2 s, 5 follows simple commands.
 * Extra checks: every distinct check done whose step is later than the deciding step (+1 each).
 *   Tagging at the deciding step costs 0.
 * Must not: touch the scene, timers, UI. Never uses exactly 30/min or exactly 2 s (">" only on data
 * that avoids those values).
 */
import type { CasualtyDef } from "./TriageData"

export type CheckId = "breathing" | "airway" | "rate" | "pulse" | "commands"
export type StartTag = "Green" | "Yellow" | "Red" | "Black"

export interface Findings {
  walks: boolean
  breathing: boolean | null
  afterAirway: boolean | null
  respRate: number | null
  /** true = present, false = absent, null = never needed */
  pulsePresent: boolean | null
  refillSeconds: number | null
  followsCommands: boolean | null
}

export interface StartResult {
  decided: boolean
  tag: StartTag | null
  decidingStep: number | null
  extraChecks: number
}

export const CHECK_STEP: { [k in CheckId]: number } = {
  breathing: 1,
  airway: 2,
  rate: 3,
  pulse: 4,
  commands: 5,
}

export const CHECK_LABEL: { [k in CheckId]: string } = {
  breathing: "Breathing?",
  airway: "Open airway",
  rate: "Breathing rate",
  pulse: "Pulse / refill",
  commands: "Follows commands?",
}

const RATE_LIMIT = 30 // per minute; scripted rates are never exactly this
const REFILL_LIMIT = 2 // seconds; scripted refills are never exactly this

export function findingsFromDef(d: CasualtyDef): Findings {
  return {
    walks: d.walks,
    breathing: d.breathing,
    afterAirway: d.breathingAfterAirway,
    respRate: d.respRate,
    pulsePresent: d.radialPulse === null ? null : d.radialPulse === "present",
    refillSeconds: d.refillSeconds,
    followsCommands: d.followsCommands,
  }
}

function decide(f: Findings, done: { [k in CheckId]?: boolean }): { tag: StartTag; step: number } | null {
  // 0: walker -> Green, needs no check
  if (f.walks) return { tag: "Green", step: 0 }
  // 1: breathing?
  if (!done.breathing) return null
  if (f.breathing === false) {
    // not breathing: open airway
    if (!done.airway) return null
    return f.afterAirway === true ? { tag: "Red", step: 2 } : { tag: "Black", step: 2 }
  }
  // 2 (rate): breathing, rate over 30/min -> Red
  if (!done.rate) return null
  if (f.respRate !== null && f.respRate > RATE_LIMIT) return { tag: "Red", step: 3 }
  // 3 (pulse / refill)
  if (!done.pulse) return null
  if (f.pulsePresent === false || (f.refillSeconds !== null && f.refillSeconds > REFILL_LIMIT)) {
    return { tag: "Red", step: 4 }
  }
  // 4 (commands)
  if (!done.commands) return null
  return f.followsCommands === true ? { tag: "Yellow", step: 5 } : { tag: "Red", step: 5 }
}

export function evaluateStart(f: Findings, checks: CheckId[]): StartResult {
  const done: { [k in CheckId]?: boolean } = {}
  for (const c of checks) done[c] = true
  const d = decide(f, done)
  if (!d) return { decided: false, tag: null, decidingStep: null, extraChecks: 0 }
  let extra = 0
  for (const c of Object.keys(done) as CheckId[]) {
    if (CHECK_STEP[c] > d.step) extra++
  }
  return { decided: true, tag: d.tag, decidingStep: d.step, extraChecks: extra }
}

/** Scripted result text a check button shows. "—" = never needed for this casualty. */
export function checkResultText(f: Findings, check: CheckId): string {
  switch (check) {
    case "breathing":
      return f.breathing === null ? "—" : f.breathing ? "Breathing: Yes" : "Breathing: No"
    case "airway":
      return f.breathing !== false || f.afterAirway === null ? "—" : f.afterAirway ? "After airway: breathing" : "After airway: not breathing"
    case "rate":
      return f.respRate === null ? "—" : "Rate: " + f.respRate + "/min"
    case "pulse":
      if (f.pulsePresent === null) return "—"
      if (f.pulsePresent === false) return "Pulse: absent"
      return f.refillSeconds === null ? "Pulse: present" : "Pulse present, refill " + f.refillSeconds + " s"
    case "commands":
      return f.followsCommands === null ? "—" : f.followsCommands ? "Follows commands: Yes" : "Follows commands: No"
  }
}

export const TAG_WORD: { [k in StartTag]: string } = {
  Green: "GREEN",
  Yellow: "YELLOW",
  Red: "RED",
  Black: "EXPECTANT",
}

// ------------------------------------------------------------------ Learn mode: the START step chips

export type ChipState = "done" | "current" | "decided" | "dim"

export interface LearnChip {
  /** short label for the chip ("Walks?", "Breath?", "Rate", "Pulse", "Obeys?"; "Airway" while the airway is pending) */
  label: string
  state: ChipState
  /** only for state "decided": the tag this step gave */
  tag: StartTag | null
}

/** Short chip labels, in START order (the card is narrow, so the labels are shortened). */
export const CHIP_LABELS: string[] = ["Walks?", "Breath?", "Rate", "Pulse", "Obeys?"]
/** START step number (0-5, see top of file) -> chip index (breathing and breathing-after-airway share one chip). */
export const STEP_CHIP: number[] = [0, 1, 1, 2, 3, 4]

/**
 * The five chips for Learn mode. Passed steps are "done", the step the START rules need next is "current", the step
 * that decided the tag shows the tag ("decided"), and steps not reached stay "dim".
 */
export function learnChips(f: Findings, checks: CheckId[]): LearnChip[] {
  const res = evaluateStart(f, checks)
  const done: { [k in CheckId]?: boolean } = {}
  for (const c of checks) done[c] = true
  const chips: LearnChip[] = CHIP_LABELS.map((l) => ({ label: l, state: "dim" as ChipState, tag: null }))
  if (res.decided && res.decidingStep !== null && res.tag) {
    const idx = STEP_CHIP[res.decidingStep]
    for (let i = 0; i < idx; i++) chips[i].state = "done"
    chips[idx].state = "decided"
    chips[idx].tag = res.tag
    return chips
  }
  let cur = 1
  if (!done.breathing) cur = 1
  else if (f.breathing === false) cur = 1 // airway pending
  else if (!done.rate) cur = 2
  else if (!done.pulse) cur = 3
  else cur = 4
  for (let i = 0; i < cur; i++) chips[i].state = "done"
  chips[cur].state = "current"
  if (cur === 1 && done.breathing && f.breathing === false) chips[1].label = "Airway"
  return chips
}
