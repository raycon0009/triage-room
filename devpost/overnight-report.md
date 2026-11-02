# Overnight report (3 Nov 2026)

## Steps
| Step | Result | Commit |
|---|---|---|
| 2 Figure upgrade | **Already done before the run** (commit exists with the exact message), so I did not redo it. No `before-step-2` tag. | `9967cf7` |
| 3 Pose variation | **Done** | `33f24ae` |
| 4 Learn mode | **Done** | `205bd31` |
| 5 Final check | **Done** (this report) | this commit |

Tags made tonight: `before-step-3`, `before-step-4`.

## Tests (final code)
- Node: start-engine 12/12, scoring 23/23, figures 70/70 (new poses included), learn-chips 15/15 (new).
- LEAF: 19/19, each run on its own (17 older, `triage-pose-variation`, `triage-learn-mode`). `triage-start-screen` was updated for the Learn/Drill buttons; nothing else was changed to make tests pass.
- Failures on the way, none repeated: pose shift of 10 cm beyond the slot broke the 150 cm spacing rule (fixed); my Learn test used an all-missed debrief that is 0.15 degrees over the view limit (see below).

## Final check
- Scene holds only the project objects, SIK, `LeafIndex` and `LEAF Plugin Bridge`; no temporary scripts or demo objects; `Packages/` has only SIK, UIKit, Leaf.
- Demo seed is **off** by default (`useDemoSeed` false in the scene). To turn it on: select the `TriageMain` object, tick "Use demo seed". Untick to turn it off. (Seed 77, Expectant on.)
- README matches the Lens (Learn/Drill, pose line, tests list). I also fixed a broken em dash in the README that my step 3 edit saved in the wrong encoding.
- `git status` is clean except `devpost/overnight-prompt.md`, which is untracked on purpose (you said not to commit it).

## Captures (`devpost/captures/`)
- `step3-seed21-layout.jpg` (non-demo layout), `step4-learn-card.jpg` (Learn card mid-check).

## Look at by eye
- The 4 new poses and the mirrored/turned figures from about 3 m; the new poses were tuned by numbers and one capture only.
- Chip text on the Learn card is small.
- Restart 4-5 times for pose variety; one Learn run.

## Decisions you may want to change
- Step 2 skipped (already committed).
- Poses: each case has 3 choices; walkers always sit; F/X only lie (no groaning pose). Position shift is only inside the existing slot.
- Learn mode names itself in the debrief ("Learn · ..."); Drill's debrief is unchanged and shows no mode.
- Chip labels shortened: Walks? Breath? Rate Pulse Obeys?
- Learn and Drill buttons are stacked.

## Known issue (existing, not fixed)
If you reach nobody, the debrief panel is 17.15 degrees tall from the start position, 0.15 over the 17 degree limit.
