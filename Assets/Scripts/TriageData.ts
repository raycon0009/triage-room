/**
 * TriageData.ts - pure data module (NO engine dependencies).
 * Owns: the scripted casualty pool exactly as in devpost/design-brief.md
 *       ("Casualty pool" table). Later build steps read these values; no check logic here.
 * Must not: contain any START/check logic or touch the scene.
 */

export type CasualtyId = "W1" | "W2" | "W3" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "J" | "X"
export type TagColour = "Green" | "Yellow" | "Red" | "Black"
export type PoseKind =
  | "sitting_arm_cut"
  | "sitting_holding_ankle"
  | "lying_back"
  | "lying_side"
  | "slumped_against_wall"
  | "lying_groaning"
  | "sitting_dazed"
  | "lying_face_up_still"
  | "sitting_knees_up"
  | "sitting_leaning_back"
  | "lying_back_knee_up"
  | "lying_back_arm_up"

export type PoseGroup = "lying" | "sitting" | "slumped"

export interface PoseInfo {
  /** card title: matches the pose shown */
  label: string
  /** debrief row name */
  short: string
  group: PoseGroup
}

/** What each pose looks like, in words. Group: lying (on the floor), sitting (upright), slumped (leaning on a wall). */
export const POSE_INFO: { [k: string]: PoseInfo } = {
  sitting_arm_cut: { label: "Sitting, arm cut", short: "Arm cut", group: "sitting" },
  sitting_holding_ankle: { label: "Sitting, holding ankle", short: "Hurt ankle", group: "sitting" },
  lying_back: { label: "Lying on back", short: "On back", group: "lying" },
  lying_side: { label: "Lying on side", short: "On side", group: "lying" },
  slumped_against_wall: { label: "Slumped against wall", short: "Slumped", group: "slumped" },
  lying_groaning: { label: "Lying, groaning", short: "Groaning", group: "lying" },
  sitting_dazed: { label: "Sitting, dazed", short: "Dazed", group: "sitting" },
  lying_face_up_still: { label: "Lying face up, still", short: "Face up", group: "lying" },
  sitting_knees_up: { label: "Sitting, knees up", short: "Knees up", group: "sitting" },
  sitting_leaning_back: { label: "Sitting, leaning back", short: "Leaning back", group: "sitting" },
  lying_back_knee_up: { label: "Lying on back, knee up", short: "Knee up", group: "lying" },
  lying_back_arm_up: { label: "Lying on back, arm up", short: "Arm up", group: "lying" },
}

/** The pool, in the order the layout draws from it. */
export const WALKER_IDS: CasualtyId[] = ["W1", "W2", "W3"]
/** Breathing non-walkers: any of these may be the person behind the player (never a walker, F or X). */
export const BEHIND_IDS: CasualtyId[] = ["A", "B", "C", "D", "E", "G", "H", "J"]
/** Non-walkers that can fill the other two non-walker slots (F joins them; X has its own roll). */
export const NON_WALKER_IDS: CasualtyId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "J"]
/** The pool before the bigger pool (demo seed 77 keeps drawing from it, so its documented layout never changes). */
export const LEGACY_WALKER_IDS: CasualtyId[] = ["W1", "W2"]
export const LEGACY_BEHIND_IDS: CasualtyId[] = ["A", "B", "C", "D", "E"]
export const LEGACY_NON_WALKER_IDS: CasualtyId[] = ["A", "B", "C", "D", "E", "F"]

/**
 * The believable poses each case can take (the first is the default, used by the demo seed). Rules:
 * walkers are always seated; F and X only lie still (never upright, never groaning); A-E, G, H and J any lying / sitting / slumped.
 * The same pose is offered to cases with different tags, so appearance never predicts the tag.
 */
export const POSE_CHOICES: { [id: string]: PoseKind[] } = {
  W1: ["sitting_arm_cut", "sitting_knees_up", "sitting_dazed"],
  W2: ["sitting_holding_ankle", "sitting_knees_up", "sitting_leaning_back"],
  A: ["lying_back", "lying_back_knee_up", "lying_side"],
  B: ["lying_side", "lying_back", "lying_back_arm_up"],
  C: ["slumped_against_wall", "sitting_dazed", "sitting_leaning_back"],
  D: ["lying_groaning", "lying_back_arm_up", "lying_side"],
  E: ["sitting_dazed", "slumped_against_wall", "sitting_knees_up"],
  F: ["lying_face_up_still", "lying_back", "lying_side"],
  G: ["lying_back", "sitting_leaning_back", "lying_side"],
  H: ["sitting_knees_up", "lying_back", "slumped_against_wall"],
  J: ["lying_back_arm_up", "sitting_dazed", "lying_groaning"],
  W3: ["sitting_dazed", "sitting_leaning_back", "sitting_knees_up"],
  X: ["lying_face_up_still", "lying_back", "lying_side"],
}

export function poseLabelOf(kind: string): string {
  return POSE_INFO[kind] ? POSE_INFO[kind].label : kind
}
export function poseShortOf(kind: string): string {
  return POSE_INFO[kind] ? POSE_INFO[kind].short : kind
}

export interface CasualtyDef {
  id: CasualtyId
  pose: PoseKind
  poseLabel: string
  walks: boolean
  /** null = never needed (an earlier step decides the tag) */
  breathing: boolean | null
  breathingAfterAirway: boolean | null
  respRate: number | null
  radialPulse: "present" | "absent" | null
  refillSeconds: number | null
  followsCommands: boolean | null
  correctTag: TagColour
  /** 0 walk, 1 breathing?, 2 breathing after airway, 3 rate>30, 4 pulse/refill, 5 commands */
  decidingStep: number
  /** upright poses can be placed against the wall */
  upright: boolean
}

function def(d: CasualtyDef): CasualtyDef {
  return d
}

export const CASUALTY_TABLE: { [id: string]: CasualtyDef } = {
  W1: def({ id: "W1", pose: "sitting_arm_cut", poseLabel: "Sitting, arm cut", walks: true, breathing: null, breathingAfterAirway: null, respRate: null, radialPulse: null, refillSeconds: null, followsCommands: null, correctTag: "Green", decidingStep: 0, upright: true }),
  W2: def({ id: "W2", pose: "sitting_holding_ankle", poseLabel: "Sitting, holding ankle", walks: true, breathing: null, breathingAfterAirway: null, respRate: null, radialPulse: null, refillSeconds: null, followsCommands: null, correctTag: "Green", decidingStep: 0, upright: true }),
  A: def({ id: "A", pose: "lying_back", poseLabel: "Lying on back", walks: false, breathing: true, breathingAfterAirway: null, respRate: 34, radialPulse: null, refillSeconds: null, followsCommands: null, correctTag: "Red", decidingStep: 3, upright: false }),
  B: def({ id: "B", pose: "lying_side", poseLabel: "Lying on side", walks: false, breathing: true, breathingAfterAirway: null, respRate: 22, radialPulse: "absent", refillSeconds: null, followsCommands: null, correctTag: "Red", decidingStep: 4, upright: false }),
  C: def({ id: "C", pose: "slumped_against_wall", poseLabel: "Slumped against wall", walks: false, breathing: true, breathingAfterAirway: null, respRate: 18, radialPulse: "present", refillSeconds: 1, followsCommands: false, correctTag: "Red", decidingStep: 5, upright: true }),
  D: def({ id: "D", pose: "lying_groaning", poseLabel: "Lying, groaning", walks: false, breathing: true, breathingAfterAirway: null, respRate: 16, radialPulse: "present", refillSeconds: 1, followsCommands: true, correctTag: "Yellow", decidingStep: 5, upright: false }),
  E: def({ id: "E", pose: "sitting_dazed", poseLabel: "Sitting, dazed", walks: false, breathing: true, breathingAfterAirway: null, respRate: 28, radialPulse: "present", refillSeconds: 1, followsCommands: true, correctTag: "Yellow", decidingStep: 5, upright: true }),
  F: def({ id: "F", pose: "lying_face_up_still", poseLabel: "Lying face up, still", walks: false, breathing: false, breathingAfterAirway: true, respRate: null, radialPulse: null, refillSeconds: null, followsCommands: null, correctTag: "Red", decidingStep: 2, upright: false }),
  G: def({ id: "G", pose: "lying_back", poseLabel: "Lying on back", walks: false, breathing: true, breathingAfterAirway: null, respRate: 20, radialPulse: "present", refillSeconds: 3, followsCommands: null, correctTag: "Red", decidingStep: 4, upright: false }),
  H: def({ id: "H", pose: "sitting_knees_up", poseLabel: "Sitting, knees up", walks: false, breathing: true, breathingAfterAirway: null, respRate: 24, radialPulse: "present", refillSeconds: 1, followsCommands: true, correctTag: "Yellow", decidingStep: 5, upright: true }),
  J: def({ id: "J", pose: "lying_back_arm_up", poseLabel: "Lying on back, arm up", walks: false, breathing: true, breathingAfterAirway: null, respRate: 32, radialPulse: null, refillSeconds: null, followsCommands: null, correctTag: "Red", decidingStep: 3, upright: false }),
  W3: def({ id: "W3", pose: "sitting_dazed", poseLabel: "Sitting, dazed", walks: true, breathing: null, breathingAfterAirway: null, respRate: null, radialPulse: null, refillSeconds: null, followsCommands: null, correctTag: "Green", decidingStep: 0, upright: true }),
  X: def({ id: "X", pose: "lying_face_up_still", poseLabel: "Lying face up, still", walks: false, breathing: false, breathingAfterAirway: false, respRate: null, radialPulse: null, refillSeconds: null, followsCommands: null, correctTag: "Black", decidingStep: 2, upright: false }),
}

export function getCasualtyDef(id: CasualtyId): CasualtyDef {
  return CASUALTY_TABLE[id]
}

