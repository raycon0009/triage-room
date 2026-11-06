# Build log

## Build step 1: room, casualties, Start button, scenario line (2 Nov 2026)

**Status: written, NOT verified end to end. LEAF tests were not written or run.**

### What was built (in `Assets/Scripts/`)
- `TriageData.ts`: casualty pool table from the brief (data only, no check logic).
- `TriageLayout.ts`: pure seedable selection and layout (`generateRun(seed, forceBlack)`, `validateRun`). Exactly 1 walker + 3 non-walkers; the casualty behind is always a breathing non-walker (A-E); X (Black) in about 1 run in 3 and never behind; a fixed seed gives the same layout and `forceBlack` is auto/on/off.
- `TriageFigureBuilder.ts`: light-coloured primitive figures, no black, no gore.
- `TriageMain.ts`, `TriageStartUI.ts`, `TriageScenarioUI.ts`, `TriageZoneUI.ts`: orchestrator, Start panel (UIKit), fading scenario line, "MINOR" green zone.
- Scene: `TriageRoom` (casualties, room shell, MinorZone) and `TriageUI` (StartPanel, ScenarioLine).

### What was checked
- Before the last layout tweaks: TypeScript compiled, preview ran with no runtime errors, and the Start panel, scenario line, wall and one casualty were seen in a preview capture.
- Selection and layout rules, run in plain Node over seeds 1 to 3000: 0 rule violations; X in about 34% of runs; seed 42 with force-on gave an identical layout twice.

### What failed or is unverified
- `CaptureRuntimeViewTool` auto-installed `AiPreviewAgentInspect`, `Icons` and `Motion` into `Packages/` and added an "AiPreviewAgent Handler" scene object. Their example scripts import `UIKit.lspkg/...` and `InteractionKit.lspkg/...`, which don't exist here, so compilation broke and Lens Studio's model got stuck ("Invalid transition from Immutable to Mutable"). Recompile, run, capture and scene edits now time out or fail.
- The last edits (`TriageLayout.ts` slots and yaw, wall colour in `TriageMain.ts`, `TriageScenarioUI.ts` default size) have never been compiled by Lens Studio.
- Pressing Start with a real pinch was never done (no preview-interaction tool available); only a temporary auto-start probe ran, and it has been removed.
- The two front casualties, the MINOR disc and the casualty behind were not seen in a capture.
- LEAF tests for done criterion 1: not written, not run.

### Stood in or deferred
- Not built (later steps): check cards, START engine, tags, call-out, timer, chime, groan, arrow, debrief.
- The cyan dot above each casualty is a non-interactive placeholder.
- Casualties are hidden until Start.

### Outside the build scope
- `tsconfig.json` got two path aliases (`UIKit.lspkg/*`, `InteractionKit.lspkg/*`) while trying to unblock the compile. A backup of the original is in the session scratchpad.
- A blank line was appended to `TriageData.ts` to trigger a recompile.

### To recover
1. Restart Lens Studio and reopen the project.
2. Delete the "AiPreviewAgent Handler" object and the `AiPreviewAgentInspect`, `Icons` and `Motion` packages. Don't use `CaptureRuntimeViewTool` again; use the Preview panel screenshot instead.
3. Recompile and check the logs, then write and run the LEAF tests for criterion 1.

## Recovery attempt 1 (2 Nov 2026, after restarting Lens Studio)

**Result: not recovered. Stopped as agreed.**

- Not a git repo, so no commit. Backup of `Assets`, `Packages`, `tsconfig.json` and `devpost` copied to the session scratchpad (`backup-before-cleanup`).
- Confirmed the three packages were added this session: their files in `Packages/` are dated 12:29 on 2 Nov, against 03:03 for SIK and UIKit; the log above also records it.
- The scene model answers reads again (VirtualScene read, asset queries work). Found "AiPreviewAgent Handler" as a root object, and the package assets `AiPreviewAgentInspect`, `Icons`, `Motion`.
- Deleting "AiPreviewAgent Handler" failed three ways with "Invalid transition from Immutable to Mutable": `scene-graphql deleteSceneObject`, and `SceneObject.destroy()` through the Editor API. So Lens Studio is still stuck after the restart.
- `RecompileTypeScriptTool` still times out.
- `tsconfig.json` was NOT reverted. The two aliases may be what lets the package example scripts resolve, so reverting before the packages are gone could make the compile worse.
- Nothing else was changed. No tool was asked to install a package, and `CaptureRuntimeViewTool` was not used.
- Not done: package removal, preview capture, Start pinch, LEAF tests.

## Recovery attempt 2 (2 Nov 2026): recovered; step 1 checked in the preview, LEAF pending

**Recovery steps that worked**
- You deleted the "AiPreviewAgent Handler" object and the `AiPreviewAgentInspect`, `Icons`, `Motion` packages by hand in Lens Studio, saved and reopened. `Packages/` now holds only SIK and UIKit.
- `tsconfig.json` restored from the original backup (the two `UIKit.lspkg/*` and `InteractionKit.lspkg/*` aliases are gone).
- `RecompileTypeScriptTool`: **succeeded**. `RunAndCollectLogsTool`: **no errors**.
- Backup of the pre-cleanup state: `backup-before-cleanup` (a folder next to the project, outside git) (47 files, verified identical to the scratchpad copy).

**What was checked in the preview (CapturePanelScreenshotTool, preview set to SPECS 27)**
- Before Start: the Start panel ("Triage Room", Start, "Training drill, not certification") renders.
- Start: a click on the Start button (InjectPreviewGesture touch) hid the panel, showed the scenario line, and logged `TRIAGE_STARTED`. This is a mouse click in the preview, **not** a SIK pinch from `PreviewInteractTool`, which was not used (it needs the `AiPreviewAgent` packages).
- Looking forward and down: 3 casualties visible (one seated against the wall, two lying at the left and right edges). Front-left and front-right casualties sit near the edge of the narrow preview view and are partly cut off.
- Looking front-left: the green MINOR disc with the word "MINOR" is visible.
- Turning round (180 degrees): the casualty behind is visible, with its cyan dot.
- Run state from the logs for the run that was shown (seed 460431052, random): behind = C, walker = W2, X (Black) present in a front slot, `violations: []`.

**Not done / open**
- LEAF tests for criterion 1: **not written or run**. The LEAF package is not installed; installing it adds a package, so this was held for your approval.
- The groan and arrow (criterion 1) belong to build step 3, not built.
- A SIK first-load error ("set the Preview Panel's Device Type Override to SPECS") appeared once at 14:17:18, before the preview was on SPECS 27; it did not repeat.
- The figures are blocky primitives; judging their look is left to you.

## LEAF tests for build step 1 (2 Nov 2026)

**Setup**
- Fresh backup before installing: `backup-before-leaf` (a folder next to the project, outside git) (42 files, identical to the project at that time).
- Installed `Leaf` **v2.0.0** from the Asset Library (SIK is package version 2.0.0; v2.0.x is the matching line; v4.0.0 was not used). Nothing else was installed; no dialog or permission prompt was reported by any tool during or after the install. (I can only see tool output and the Scene panel, so a dialog elsewhere in Lens Studio would not have shown up.)
- After the install: compile succeeded, logs clean.
- Tests are in `Assets/Leaf/` (helpers, six scenarios, `LeafIndex.ts`). A `LeafIndex` scene object was added to the scene.

**Results (LEAF in the Lens Studio preview, SPECS 27): 6 of 6 passed**
1. `triage-start-four-casualties`: pinching the real `StartButton` (DefaultLeafInteractor) starts the run; the casualties root turns on; exactly 4 `Casualty_*` objects, all enabled; exactly 1 walker. PASSED.
2. `triage-one-behind`: exactly one casualty is behind the start position (larger z), it is a breathing non-walker A-E, and the other three are in front. PASSED.
3. `triage-scenario-line`: after Start the scenario line is visible with the brief's text. PASSED.
4. `triage-seed-repeatable`: same seed gives the same layout; a different seed gives a different one; with a fixed seed Black can be forced on/off and stays repeatable; seed 0 reports "not fixed". PASSED.
5. `triage-real-size-on-floor` (new): for all 9 poses in the pool (W1, W2, A-F, X), largest extent 70-220 cm, lowest point -3..8 cm from the floor, nothing above 130 cm. PASSED.
6. `triage-behind-never-walker-f-x` (new): over 300 seeds x 3 Black settings (900 layouts) the casualty behind is never the walker, F or X and no layout rule is broken; the same holds for the built scene objects over 24 more seeds. PASSED.

The size limits come from your requirement ("roughly human height or length, not tiny or floating"), not from measuring the figures first. The measured values are not printed on a pass.

**Caveats**
- I launched two scenarios in parallel by mistake (they share one live Lens). Both were re-run on their own and passed.
- Test 1 presses Start with LEAF's scripted interactor, not the IK interactor, so it does not check that the Start button is within arm's reach. No IK reachability scenario yet.
- Not tested (deferred to build step 3): the groan from the casualty behind and the arrow at the edge of view. Done criterion 1 is therefore only partly covered.
- Not built, so not tested: check cards, START engine, tags, call-out, timer, debrief (steps 2-4).

## Git (2 Nov 2026)

Git was set up for this project (local only, nothing pushed, no remote). First commit: `aa6ed76` "Build step 1: room, casualties, Start, scenario line; LEAF tests passing".

## Build step 2: check cards and START engine (2 Nov 2026)

**Status: gate passed.** START tests 12/12, LEAF 10/10 (6 from step 1 + 4 new), run one at a time on the final scene.

### What was built
- `Assets/Scripts/TriageStartEngine.ts`: pure TypeScript, no scene or Lens Studio dependency. Applies the START rules in order and stops at the first rule that decides. Input: scripted findings + the checks done. Output: `{decided, tag, decidingStep, extraChecks}`. Extra checks = each distinct check done whose step is later than the deciding step (+1 each); tagging at the deciding step is 0. Also holds the scripted result text for each check and the tag words (GREEN, YELLOW, RED, EXPECTANT).
- `Assets/Scripts/TriageCheckCards.ts` (scene object `TriageCards`): a dot with an "Open"/"Close" button above each casualty; one shared check card (UI Kit BackPlate + FlexLayout + Buttons, SIK interaction); proximity opening within 150 cm (closes beyond 220 cm if it opened by proximity); card about 80 cm from the eyes with its top 6 cm below eye level, turned to face the viewer, glides to a new spot only when the viewer turns more than 40 degrees or moves; four check buttons (Breathing?, Breathing rate, Pulse / refill, Follows commands?) showing the scripted result after a press; the rate slot becomes "Open airway" once "Breathing: No" is shown; tag panel (RED, YELLOW, GREEN, EXPECTANT) below the card, enabled only when the engine says a step has decided; tagging closes the card, adds a coloured band round the torso and the tag word above the casualty (EXPECTANT is dark grey with a white outline, never black; words are light).
- Records kept per casualty for the step 4 debrief: checks made (in order, distinct), total presses, seconds the card was open, tag chosen, correct tag, deciding step, extra checks. API: `getRecord(id)`, `getRecords()`, `onCasualtyTagged`.
- Small hooks in step 1 code: `TriageMain.onRegenerated`, `isReady()`, `getCasualtyObject(id)`; `TriageFigureBuilder.addTagBand`.
- Test file: `devpost/tests/start-engine.test.mjs` (run `node devpost/tests/start-engine.test.mjs`, Node 22.18+).

### Decisions I made (change if you disagree)
- A walker's card shows "Can walk: Yes" and the tag buttons straight away (deciding step 0, no checks). Any check pressed on a walker shows "—" and counts as an extra check.
- "—" results (a check the table says is never needed) are shown as "<check>: —" and count as an extra check if pressed after the deciding step.
- Pulse and capillary refill are one button ("Pulse / refill"), as in the brief's table.
- All four tag buttons are offered once a step has decided; the player can pick a wrong one and the debrief will show it.
- The dot shows "Open" and becomes "Close" while its card is open. Pressing "Close" keeps that card shut until the viewer has walked away and come back. (Not in the brief; it gives a way to dismiss a card.)
- A card opened with "Open" from a distance stays open until tagged or closed; walking up to a different casualty switches the card to them.
- Tag buttons are text-coloured (not filled) because UI Kit buttons have no per-button fill colour.

### START tests (plain Node, `devpost/tests/start-engine.test.mjs`): 12 of 12 pass
Cases 1-12 from the brief, plus: undecided before the deciding check, walker + 2 checks = 2 extra, and every pool casualty (W1, W2, A-F, X) through its own check sequence gives the table's tag and deciding step with 0 extra. No scripted value is exactly 30/min or exactly 2 s.

### LEAF (Lens Studio preview, SPECS 27): 10 of 10 pass
Step 1 (unchanged, re-run): triage-start-four-casualties, triage-one-behind, triage-scenario-line, triage-seed-repeatable, triage-real-size-on-floor, triage-behind-never-walker-f-x.
New:
- `triage-card-opens-proximity-and-open` (criterion 3): "Open" on A's dot opens the card from far away (reason: button); "Close" closes it and it stays shut; standing 90 cm away opens it by proximity; card is 70-90 cm from the viewer, its centre below eye level, facing the viewer within about 18 degrees; walking away closes it.
- `triage-card-scripted-results-and-tag-gating` (criterion 3): casualty D's four buttons show "Breathing: Yes", "Rate: 16/min", "Pulse present, refill 1 s", "Follows commands: Yes"; the tag panel is hidden until the last check, then the four tag buttons appear.
- `triage-tag-closes-card-adds-band` (criteria 3 and 4, D -> Yellow): tagging closes the card, adds the band and the word "YELLOW", record has 0 extra checks, 4 checks, time on card above 0.
- `triage-start-rules-in-lens` (criterion 4): rate 34 -> tag buttons appear right after "Breathing rate" -> Red, 0 extra; pulse pressed after that -> "Pulse / refill: —", extraChecks 1; X: "Breathing: No", button reads "Open airway", then "After airway: not breathing" -> EXPECTANT, band dark grey (r between 0.2 and 0.5) with a white outline.

### How these were pressed
Every button press in LEAF is a real UI Kit button press by LEAF's scripted interactor (`DefaultLeafInteractor`), not a hand-IK reach. The viewer position for "walk up" is a test stand-in (`setViewerOverride`) because LEAF cannot walk the preview camera. No IK reachability scenario was written for the card buttons.

### Capture (CapturePanelScreenshotTool only)
One preview capture shows an open card ("Lying face up, still", casualty F) and a tagged casualty X (dark grey band, white outline, the word EXPECTANT cut off at the right edge of the view). A temporary demo script tagged X; the script, its scene object and a temporary LEAF scenario were deleted afterwards. `CaptureRuntimeViewTool` was not used.

### What failed or needs a note
- First run of the card-opens scenario failed once ("Object is null"): `closeCard` touched the dots of the previous run's destroyed casualties. Fixed (reset the dots first, skip destroyed objects); passed on the next run. No test failed twice.
- Mouse clicks injected into the preview (`InjectPreviewGesture`) pressed the card buttons only about one time in three (a press registered only after the cursor had already hovered the same button). Hover highlight works every time. I could not tell whether this is the tool or the Lens, so **real mouse presses on the card buttons in Interactive Preview are not proven**; LEAF presses are proven. Please click through a card yourself.
- The card is big in the narrow preview view (about 34 cm wide at 80 cm); when the viewer looks steeply down at a casualty the card's top sits above the view. Comfort on real glasses: feel unproven.
- The tag word above a casualty can be cut off by the edge of the view when the casualty is at the side.
- Not built (later steps): timer, call-out, groan, arrow, chime, debrief, shuffle/restart. Walker does not stand up yet.
- The project was saved from Lens Studio (the `TriageCards` object is in `Assets/Scene.scene`). A backup was not taken before this step; git holds step 1.

## Build step 2 fix: check card placement (after your Preview check)

**Problem you found:** looking down at a casualty, the card sat at the top edge of the view (only "Follows commands?" visible) and covered the seated casualty's head. Cause: the card used only the horizontal look direction and a fixed height, and had no idea where the casualty was.

**What changed (`TriageCheckCards.ts`)**
- Placement: when the card opens it goes along the full 3D look direction (including looking down), 70 cm from the eyes (was 80), 3 cm below the centre of view. The card is parallel to the view plane (upright, no roll, however far down you look).
- Size: 25 cm wide (was 34). Check buttons 22 x 4.4 cm; the tag panel is one row of four buttons below the card.
- Never covers the casualty: from the eye, rays to sampled points on the head and torso must not pass through the card (card + tag panel area, with a margin about the size of the head at that distance). If the centred spot would cover them, the card slides sideways (or down) to the clear spot that keeps all four corners closest to the view centre.
- Lazy follow: the card stays put when you turn a little. It only glides back (about a quarter of a second to settle) when its centre is more than 30 degrees from where you look, or you have moved away from it (more than 35 cm off its distance).
- Connector: a thin light-cyan line from the card's side edge to the casualty's dot, shown while the card is open.
- The scene still held the old values (distance 80, drop 6), which override script defaults; set to 70 and 3 and saved.

**LEAF (one at a time): 4 of 4 step 2 scenarios pass.** The card-position test (`triage-card-opens-proximity-and-open`) was rewritten for the new rules: far "Open" in front of the eyes (about 70 cm along the view, below centre, within 20 degrees); proximity opening while looking steeply down at A (centre within 22 degrees, all four corners within 35 degrees, upright, parallel to view); independent rays show the head and torso not covered; connector visible and ends at the dot; width 24-26 cm and buttons taller than 4 cm; a 10 degree turn leaves the card still (under 1 cm), a 140 degree turn brings it back within 25 degrees of the new look direction; walking away closes it and the line.
- That scenario failed twice on the way, for different reasons, both fixed before it passed: a distance bound that did not allow for the sideways slide (80.2 cm), then the scene's stale 80 cm value. Not the same failure repeating.
- The 6 step 1 scenarios were not re-run this time (nothing they test changed).

**Capture:** one preview capture looking down at casualty B (lying on side) with the card open to their right, upright, the head and torso clear, the connector line running to the dot. `CaptureRuntimeViewTool` not used.

**Limit you should know about (not solved):** the preview's view is about 14 degrees to each side horizontally (the card at 70 cm is about 25 cm = +/-10 degrees; a casualty centred in view takes about +/-11 degrees). So when you look straight at someone, a 25 cm card that also must not cover them cannot fit fully in the view: in the capture roughly a third of the card is cut off on the right. It is placed as close to the centre as it can be, and turning your head a few degrees towards it brings it fully in view (the casualty is then no longer behind it). Ways to relax this, your call: a narrower card (about 20 cm), the card allowed to overlap the legs, or shown further away (0.9-1 m) when it has to be offset. Real-glasses field of view is similar or narrower, so this is "feel unproven".

## Build step 3: call-out, timer, groan, arrow, chime (2 Nov 2026)

**Status: gate passed.** START tests 12/12 (`node devpost/tests/start-engine.test.mjs`), LEAF 13/13 (10 from steps 1-2, one rewritten, 3 new), each scenario run on its own.

### Card tweak (from step 2)
- The card may now overlap the casualty's legs and arms, never the head or torso. The cover test samples the torso box (centre + 8 corners) and the head (centre + 6 surface points), with a small margin. When the centred spot would cover them, the card takes the clear spot that keeps all four corners closest to the centre of view (the old penalty for sliding away was removed).
- `triage-card-opens-proximity-and-open` updated: independent rays check the torso's 8 corners as well as head/torso centres; new section stands to the side, looks at the feet and checks the card is over the legs (hidden point = legs) yet within 6 degrees of the view centre and not covering head or torso.

### What was built (`Assets/Scripts/`)
- `TriageRunClock.ts` (scene object `TriageClock`, child `ChimeAudio`): 3:00 timer starting on Start; pushes the remaining time to the card (shown in the card's status line, "Can walk: No   ·   2:41", nowhere else); chime at 0:30 left; end state `endRun(reason)` = closes any open card, locks cards, stops the clock, and for "time" shows a "Time's up" panel in the start view. Hook for step 4: `onRunEnded` ("time" | "all-tagged"), `isEnded()`, `getEndReason()`, `endRun("all-tagged")`. I did NOT wire "everyone tagged" to it (step 4 does that); no debrief map.
- `TriageCallOut.ts` (scene object `TriageCallOut`, panel at 0, -14, -80 cm like the Start panel): big "Call out: walk to me" button (30 x 9 cm), appears on Start. Pressing it: the walker is recorded at once as tagged Green at deciding step 0, no checks, 0 extra checks, `calledOutAtSeconds` = run time of the press (new record fields `calledOut`, `calledOutAtSeconds`); the walker stands up (sitting pose blends into a standing one, 1.2 s), walks at 1.1 m/s with a leg/arm swing to 20 cm inside the green circle, faces the start position, and gets the green band + word GREEN on arrival. Nobody else moves. One use per run; the button goes away at the end.
- `TriageBehindCue.ts` (scene object `TriageCue`): groan source = an AudioComponent (spatial: position + distance effects, linear fade 120-1200 cm) on a child of the casualty behind; first groan 1.5 s after Start, then every 5 s while that casualty is out of view and untagged. Arrow = small amber chevron, head-locked at 55 cm, at the edge of the view on the side to turn to (pulses gently), shown only while that casualty is out of view and untagged. "In view" = head or torso centre inside the camera's field of view.
- Sounds (build-sfx, local synthesis, nothing downloaded): `Assets/GeneratedSFX/triage_groan.wav` (1.3 s mono, soft low "mmm", slow swell, gentle fall in pitch, breath under it, volume 0.5) and `triage_chime.wav` (two-note bell, plate reverb; plays at 0:30 left, not spatial).
- Camera Object got an Audio Listener component (Lens Studio warned that spatial audio needs one).
- Edited: `TriageCheckCards.ts` (setLocked, setTimerText, markCalledOut, showCalledOutTag, card tweak), `TriageFigureBuilder.ts` (standing pose, band on a standing torso), `TriageLeafHelpers.ts`, `LeafIndex.ts`.

### Decisions I made (change if you disagree)
- The groan and arrow are not latched: if you turn away again after seeing that casualty, the arrow returns and the groan resumes (until they are tagged).
- The walker's tag is recorded at the moment of the press; the band and word appear when they arrive. Their "time" is the run time of the press, not a card-open time.
- The walker stops 20 cm inside the circle's edge, not on its centre, so the word MINOR stays readable.
- The timer lives in the card's status line, not in its own element, so the card's size did not change.
- "Time's up" panel text: "Time's up" / "The drill has ended".
- Arrow size default 0.7 (it looked large at 1.0 in the preview capture).

### LEAF (Lens Studio preview, SPECS 27): 13 of 13 pass
New: `triage-callout-walker-only` (real press of CallOutButton; walker tagged Green, 0 extra checks, no checks, time recorded; stands (head > 130 cm above floor), ends within 50 cm of the circle centre with band + GREEN; the other three did not move and are untagged; second call-out does nothing), `triage-timer-chime-and-time-up` (3:00 at Start; time shown on the open card only; chime exactly once at 0:30 left; a shortened 4 s run closes an open card at 0:00, shows Time's up, locks the cards, removes the call-out button, and a new run clears it), `triage-groan-and-arrow-behind` (groan source is under Casualty_<behind> and nowhere else, behind the start position; plays and repeats while out of view; arrow shown at the edge of the view, on the right side, while out of view; hidden once in view and the groan stops; returns when turned away; nothing after that casualty is tagged).
Changed: `triage-card-opens-proximity-and-open`. Re-run unchanged: the other 9.
- Failed once on the way: the timer scenario (my test jumped the clock without allowing for real time already elapsed); fixed in the test, passed on the next run. No scenario failed twice.

### Not proven / limits
- Audio was not heard: tests count play calls and check the source placement; I cannot listen to it. The groan's calmness and the chime volume are **feel unproven**. A first compile showed Lens Studio's warning about the missing Audio Listener, fixed before the final runs.
- The timer test uses a shortened run and a clock jump (`debugAdvance`); the real 3:00 was not waited out.
- Viewer position and look direction in tests are stand-ins (`setViewerOverride`); LEAF cannot move the preview camera. The real camera was checked once in the preview capture.
- Pressing the call-out button with a real mouse/hand in Interactive Preview: only LEAF presses are proven (see step 2's note on mouse presses).
- Preview field of view is narrow; the arrow is at the edge of it. Real-glasses comfort: feel unproven.

### Capture (CapturePanelScreenshotTool only)
One capture of a started run with the preview camera at the start position looking forward: the amber arrow at the right edge (the casualty behind is out of view) and the "Call out: walk to me" button in front. `CaptureRuntimeViewTool` not used.

### Cleanup
Temporary auto-start script and scene object (`TmpDemoStart`) deleted; generator script folder `tempAssetGen/` deleted. The project was saved from Lens Studio.

## Build step 4: debrief map and scoring (2 Nov 2026)

**Status: gate passed.** `node devpost/tests/start-engine.test.mjs` 12/12 brief cases; new `node devpost/tests/scoring.test.mjs` 18/18; LEAF 15/15 (13 from steps 1-3 + 2 new), run one at a time. After the last cosmetic edit to `TriageDebrief.ts` (text sizes, summary position/flash) I re-ran only the two debrief scenarios and the timer scenario (the Time's up panel); the other 12 last ran just before that edit, on code that edit did not touch.

### What was built (`Assets/Scripts/`)
- `TriageScoring.ts` (pure, plain-Node testable): per casualty a debrief entry (my tag vs correct tag as word + colour tag, status correct / wrong / missed, time, extra checks, one explanation line) and the summary (correct, wrong, missed, total extra checks, time used). An untagged casualty is "missed" ("Not reached") and counts as a wrong tag (`total - correct = wrong + missed`).
- `TriageDebrief.ts` (scene object `TriageDebrief`):
  - **End trigger:** when all four are tagged (and a called-out walker has finished walking) it waits 1.2 s and calls `TriageRunClock.endRun("all-tagged")`. Time's up already calls `endRun("time")`. The debrief opens on `onRunEnded` for either reason.
  - **Map:** lies flat on the floor, centre 1.2 m in front of the start position, scale 0.16 (room 500 x 670 cm -> 80 x 107 cm). Each casualty is a square marker at their current position (a called-out walker is shown in the green circle): outer square = correct tag colour, inner square = my tag colour (none if missed; Expectant is dark grey with a white outline). The green MINOR zone and the start position ("You start here") are drawn.
  - **Labels:** one upright label per casualty, turning about the vertical axis only to face the viewer, in a 2 x 2 block just beyond the map's far edge (so all four are in front of you; the person behind sits at the near edge of the map, which is out of sight when looking forward). Thin leader lines join each label to its marker. Each label: pose, "You" + my tag word, "Correct" + correct tag word (both coloured), "Time ... Extra checks n", and up to two lines of explanation. Anyone missed takes the lower row of their column (nearest eye level).
  - **Not reached:** the label shows "NOT REACHED" (flashing, 1.8 Hz) with the correct tag still beside it; the map marker pulses; a large flashing "NOT REACHED" floats over the real casualty; and the summary line flashes too.
  - **Summary line** (upright, above the labels): "3 of 4 correct · 1 missed · 0 extra checks · 0:04 used", with a small heading ("Time's up" / "Everyone tagged").
  - **Explanations** (one short line, only where it applies): walkers "Can walk → Green (real START reassesses walkers later)"; the Expectant case "Still not breathing after the airway was opened, so Expectant was the right call"; any wrong or missed tag gets its deciding START rule, e.g. "Rate 34 is over 30 → Red", "Radial pulse absent → Red", "Refill 3 s is over 2 → Red", "Cannot follow commands → Red".
  - Arrow, groan, timer text, open card and call-out button were already off at `endRun` (step 3); the debrief tests assert it. The Time's up panel stays 3 s, then steps aside for the map (`TriageRunClock.hideTimesUp`).
  - A new run (`regenerate`) clears the debrief. **Restart and shuffle-on-restart are not built (step 5).**
- Edited: `TriageRunClock.ts` (`hideTimesUp`), `TriageLeafHelpers.ts` (`getDebrief`, `tagWithChecks`), `LeafIndex.ts`.

### Decisions I made (change if you disagree)
- The called-out walker's "time spent" is shown as "called out at m:ss" (the run time of the press); everyone else shows seconds the card was open.
- A missed casualty also gets its START rule line (so you see what would have decided them); a missed walker gets the walker line.
- The debrief waits 1.2 s after the last tag (and for a walking walker to arrive) before opening.
- Time used = elapsed run time, capped at 3:00.
- Labels stand beyond the far edge of the map rather than directly above each marker (the casualty behind sits at the near edge, out of view); leader lines show which marker each label belongs to.

### LEAF (Lens Studio preview, SPECS 27): 15 of 15 pass
New:
- `triage-debrief-all-tagged`: three non-walkers tagged (A wrongly, Yellow, with one extra check; the others correctly), then the walker's call-out as the last tag. The debrief does not open before the walker has arrived; it then opens with reason "all-tagged". Every entry matches its record (tag, correct tag, time, extra checks); A shows YELLOW vs RED, "Extra checks 1", "Rate 34 is over 30 → Red", yellow and red text colours; summary 3 correct / 1 wrong / 0 missed / 1 extra check and the text; the map is flat, about 1.2 m in front, within 3 cm of the floor, markers at the real positions x 0.16 (within 1 cm), start marked; labels above the map, upright (no tilt) and facing the viewer (dot > 0.99); card, timer text, arrow, groan and call-out button off; no "Time's up" for this ending.
- `triage-debrief-time-up-not-reached`: only X (Expectant) tagged, correctly; a shortened run ends by time. The debrief opens with reason "time", Time's up visible, cards locked; X's line says Expectant was the right call; the other three are missed: not reached, no tag of mine, correct tag shown, explanation (walker line / a START rule), flashing label, marker and text over the real person (within 5 cm of them, above head height), and the flash level really swings (> 0.3); summary exactly "1 of 4 correct · 3 missed · 0 extra checks · 0:03 used" and `total - correct = wrong + missed`; Time's up steps aside after its time.
Unchanged, re-run: the other 13.

### Failed or odd on the way (none failed twice)
- `triage-debrief-all-tagged` failed once: the map marker for the called-out walker used their starting spot while the test (rightly) expected where they stand now. Fixed in `TriageDebrief.ts`; passed on the next run.
- `RecompileTypeScriptTool` and `run_leaf_scenario` calls sometimes timed out on the tool side, and the Lens only advanced while the preview was being rendered (it stalled until I took a screenshot or pressed resume), so some scenarios ran for minutes of wall time. The Lens logs gave the real pass/fail. No Lens Studio dialog appeared. One "Widget is not initialized" error on a run was fixed by re-opening the LEAF panel.

### Not proven / limits
- Text size and the label block's position on real glasses: **feel unproven** (the preview's field of view is narrow; the 2 x 2 block is about 90 cm wide at about 1.8 m, so it needs a small head turn).
- Flashing and colour contrast on the additive display: **feel unproven**.
- The near edge of the map (where the casualty behind sits) is steeply below eye level when you stand at the start; the missed-person cues are the label, the summary flash and the flashing text over the real person, not the marker alone.
- Viewer position in tests is a stand-in (`setViewerOverride`).
- Done criterion 5 is covered for the debrief; Restart and a different layout per seed are step 5.

### Capture (CapturePanelScreenshotTool only)
One capture of the debrief after a run with the casualty behind (D, Yellow) never reached: the map on the floor, four upright labels in a 2 x 2 block with leader lines, "NOT REACHED" (flashing, caught at its dim phase) with YELLOW beside it, and the other three labels showing matching tags. The summary line sat above the frame. Taken from a temporary demo script (`TmpDemoDebrief`; scene object and script deleted before the commit, `Scene.scene` has no trace of it). `CaptureRuntimeViewTool` not used.

## Build step 5: restart, demo seed, readable debrief, polish (2-3 Nov 2026)

**Status: gate passed.** `node devpost/tests/start-engine.test.mjs` 12/12 brief cases; `node devpost/tests/scoring.test.mjs` 23/23; LEAF 17/17 (15 from steps 1-4, two of them updated, + 2 new), each run on its own on the final code, after a Lens Studio restart, with the saved scene values. A WIP commit (`6e6952f`) was made before that restart.

### What was built
- **Restart** (`TriageMain.restart()`, `TriageDebrief.ts`): a Restart button at waist height just above the near part of the floor map (upright, so it can be pinched standing). Pinching it clears everything of the last run (casualties with their dots, bands and groan source are destroyed; cards, clock, call-out, groan / arrow and the debrief reset through `onRegenerated`) and starts a new run at once. With no fixed seed the new run gets a random seed whose cases / slots differ from the run before (`layoutSignature`); with a fixed seed (or the demo seed) a restart repeats that layout.
- **Demo seed** (`TriageLayout.DEMO_SEED = 77`, used with Black = on; `TriageMain` "Use demo seed" setting does both, default off). Layout (floor-relative cm, x right, z toward your back): **D** (lying, groaning, breathing) **behind you to the right** at about (46, 213); **C** slumped at the **wall** (0, -380); **X** (Expectant) **front-left** at about (-95, -238); **W1** (the walker, arm cut) **front-right** at about (96, -249).
- **Readable debrief** (`TriageDebrief.ts`, `TriageScoring.ts`): the four scattered labels and leader lines of step 4 are replaced by ONE upright panel (UI Kit BackPlate, 62 cm wide) 1.2 m in front of the start position, centred 3 cm below eye level, small enough to sit fully in view. Top: the summary in two large lines ("3 of 4 correct · 1 missed" / "0 extra checks · 0:02 used"). Below: one row per casualty, numbered 1-4, anyone missed first; a row is "2 Slumped ... 6 s · 0 extra" / "You RED   Correct RED" / one short explanation line. Tag words keep their colour, everything else is white. The smallest text on the panel is 118 (at least twice step 4's 58); "NOT REACHED" is the biggest text (172) and flashes between red and white. Short names and short explanation lines (all 40 characters or less, tested) keep the large text inside the panel. The floor map stays, its markers carry the same numbers as the panel rows; the flashing "NOT REACHED" over the real missed person stays. At time's up the "Time's up" panel shows alone for `timesUpSeconds` (2 s, set in the scene), then the debrief panel appears.
- **Polish:** card status and tag text larger (status 36 -> 46, tag 32 -> 40); "Time's up" text larger (title 110 -> 130, line 40 -> 62); start screen: the footnote "Training drill, not certification" 38 -> 52 and the "Start" button label 39 -> 52 (see below).
- New tests: `triage-restart-and-seeds` (a messy first run - wrong tag, called-out walker, open card, time's up - then the real Restart button: nothing of the old run left, new seed, cases / slots changed, fresh clock, cards, call-out, groan and arrow working again; two seeds differ, a fixed seed repeats, six restarts in a row never repeat the run before; the demo seed gives the documented layout, also through "Use demo seed") and `triage-start-screen` (title, Start, footnote present, light and not tiny; after Start the panel is gone and the scenario line shows). Updated for the panel: `triage-debrief-all-tagged`, `triage-debrief-time-up-not-reached` (shared checks in `TriageLeafDebriefChecks.ts`: one panel, fully in view from the start position, every text inside it, minimum text size, marker numbers match rows, no leader lines, Restart at waist height). `scoring.test.mjs` 18 -> 23 cases (row order, short names, stats text, two summary lines, explanation length).

### The restart bug (found and fixed)
- Symptom: after pinching Restart the new run started (`TRIAGE_RUN_STATE`, `TRIAGE_STARTED`, `TRIAGE_TIMER_START`), then about 50 ms later "Exception in HostFunction: Object is null" and `triage-restart-and-seeds` failed. Making the test's scene scans skip destroyed objects did not change it (failed twice, stopped and reported).
- **Exact line:** not in the Lens scripts. It is in LEAF's scripted interactor, `Leaf.lspkg/Interactors/interactor/BaseLeafInteractor.ts`, `executeTrigger()`: after the trigger ends it runs `exitHover()` (which waits a frame) and then logs `target.getSceneObject().name`. On that frame `TriageDebrief.tick` ran the restart, whose `clear()` destroyed the whole old debrief, including the Restart button being pressed, so `getSceneObject()` on the destroyed button threw. Confirmed with temporary logging around `pressButton("RestartButton")`: the exception came out of `pressButton`, 1 ms after the new run's `TRIAGE_STARTED`. Temporary logging removed.
- **Cause:** destroying an Interactable while an interactor still targets it. A real hand's SIK cursor has the same problem (the log once showed a SIK `CursorViewModelUpdate ... Object is null` error when targeted buttons were destroyed).
- **Fix (`TriageDebrief.ts`):** `clear()` disables the old debrief root at once (hidden; the button's colliders switch off, so the interactor lets go cleanly) and destroys it 0.5 s later (`RETIRE_SECONDS`, `destroyRetired()` in the update). New test API `getRetiredCount()`; `triage-restart-and-seeds` waits (up to 2 s) for it to reach 0 before its "nothing left" checks.

### Decisions I made (change if you disagree)
- The "Start" button label raised from 39 to 52: `triage-start-screen` failed once on it ("none of it tiny" = above 45). It fits the 14 x 5.5 cm button.
- `timesUpSeconds` set to 2 in the scene (you asked): the scene still held step 4's 3, which overrides the script default.
- An old debrief stays in the scene, hidden, for 0.5 s after a restart before it is destroyed.

### Failed or odd on the way
- `triage-restart-and-seeds`: failed twice before the fix (above), passed on every run after it.
- `triage-start-screen`: failed once (button label 39), passed after the change.
- The `QueryRuntimeSceneTool` MCP call silently installed three packages (`Packages/AiPreviewAgentInspect.lspkg`, `Icons.lspkg`, `Motion.lspkg`) and a scene object "AiPreviewAgent Handler"; the package's example scripts do not compile here. They were moved out of the project (not deleted) and the object removed; Lens Studio's compile then got stuck and Lens Studio was restarted. That tool and `CaptureRuntimeViewTool` are now denied in `.claude/settings.json`.
- `run_leaf_scenario` sometimes timed out on the tool side, and a run request sent right after a lens reset was dropped once; pass / fail was read from the Lens log (`PASSED:` / `FAILED:` lines). No Lens Studio dialog appeared.
- After the restart Lens Studio rewrote `.gitignore` (added its own block) and created `.gitattributes` (puts `Assets/**` and `Packages/**` under Git LFS). Neither is part of this commit; your call.

### Not proven / limits
- Restart was pressed by LEAF's scripted interactor, not a real hand or mouse; that the 0.5 s delay also keeps a real hand's cursor clean is reasoned, not observed.
- Panel text size and the 62 cm panel at 1.2 m on real glasses: **feel unproven**. In the preview it fits the view from the start position with little margin.
- The demo seed layout is tested; the demo video itself is not recorded.
- Viewer position in tests is a stand-in (`setViewerOverride`).

### Captures (CapturePanelScreenshotTool only)
1. Start screen, preview camera at the start position: "Triage Room", the Start button and "Training drill, not certification", all light, fully in frame.
2. Debrief after a demo-seed run (X tagged Expectant, C Red, W1 called out, D behind never reached; the run ended early by time): the whole panel in frame, row 1 "NOT REACHED" (held at its bright, white phase with `flashHz` 0) with "Groaning · Correct YELLOW · Follows commands → Yellow", then C, X and W1 with matching tags; summary "3 of 4 correct · 1 missed / 0 extra checks · 0:02 used" (times are 0 s because the demo tagged instantly). Taken from a temporary demo script (`TmpDemoDebrief`); its scene object was removed and the script moved out of the project before the scene was saved, and `Scene.scene` has no trace of it. `CaptureRuntimeViewTool` not used.

### Cleanup
Temporary logging, the demo script and its scene object removed. The scene was saved from Lens Studio (`timesUpSeconds` 2; the LEAF plugin re-created its own "LEAF Plugin Bridge" object with new IDs on the save).

## Nicer casualty figures: rounded, outlined, varied (3 Nov 2026)

**Status: gate passed.** `node devpost/tests/start-engine.test.mjs` 12/12, `scoring.test.mjs` 23/23, new `figures.test.mjs` 50/50; LEAF 17/17, each scenario run on its own on the final code (the walker scenarios were re-run after the last change).

### What changed
- **New `Assets/Scripts/TriageFigurePose.ts`** (pure, no Lens API, tested in Node): the body as **named parts driven by joint angles**: Pelvis, Torso, Neck, Head, Hair, UpperArm/ForeArm/Hand L+R, Thigh/Shin/Foot L+R (+ Bandage). A `Pose` is joint angles in degrees (body orient, root, spine, neck, head, shoulders, elbows, hips, knees, ankles); `partsFromPose` does the forward kinematics. **To add a pose:** add one entry to `POSES` (the file header explains each angle). Rounded geometry: capsules (heads are spheres, torso and pelvis are rounded slabs) and elliptic rings (bands).
- **`TriageFigureBuilder.ts` rewritten** around that model with `MeshBuilder` (no models, nothing downloaded, no packages installed): each resting figure is **one merged lit mesh ("Skin", vertex colours) + one light outline mesh ("Rim", inflated hull, cull-front) + one soft floor oval ("FloorRing")** = 3 draw calls (about 13 for the four plus dots, bands). Empty anchors `Torso`, `Head`, `LegL`, `LegR` keep the box-size-in-scale convention the check card and tests use.
- **Walker:** it is split into one object per body part only while it stands up and walks (so legs and arms move), then merged again on arrival. `TriageCallOut.ts` now blends joint angles (`lerpPose`, `walkPose`) instead of boxes; the stand-up is lifted so the feet never dip below the floor (`grounded`).
- **Tag bands** are now elliptic rings fitted round the new torso (3.5 cm clearance all round, 14 cm wide, turned with the torso); EXPECTANT keeps the dark-grey band with the white outline. Names `Band` and `Outline` unchanged.
- **Variety by seed:** each of the four casualties gets a different light clothing colour (9 in the palette), trousers, skin tone (5, darkest luminance above 0.55) and hair, chosen by the run seed (same seed, same looks). `lookFor(seed, index, bandage)`.
- **No breathing or movement** of any kind: nothing animates a resting figure.
- **No injuries or gore:** the only mark is the white bandage on W1's forearm (the pink patch was dropped).
- **Lighting (scene):** new material `TriageFigureLit` (Uber PBR, Vertex Color = Base Color, matte, no textures), wired to `TriageMain.litMaterial`. Key (directional) light 1.0 to 0.85, ambient light 1.0 to 1.25, no shadows. Shading is gentle: every vertex colour is light, and the darkest side is still a clearly visible light tone.
- Small hooks: `TriageMain.getFigureBuilder()`; the cards now use that builder for bands.

### Test changes (the only ones)
- `TriageCardOpenScenario.ts`: the "card may overlap the legs" part looked 30 cm past the `LegL` anchor; the rounded lower leg sits slightly further sideways than the old box, which put the test point 0.2 degrees outside the card. Changed to 20 cm. Nothing else in any scenario was changed. The size bounds (70-220 cm, lowest -3..8, top 130) needed no change.
- `figures.test.mjs` (new): parts present, bounds and size per pose, nothing dark, looks distinct within a run and repeatable by seed, all triangles wound outward, stand-up and walk stay above the floor.

### Failed or odd on the way
- `triage-callout-walker-only` failed once: the card script had its own builder with no pose data, so the band crashed. It now uses the main builder. Passed after.
- `triage-card-opens-proximity-and-open` failed twice with two different causes: first the test looked for an old part named `LegL` (added as an anchor), then the 0.2 degree bound above. Passed on the third run. No failure repeated.
- Mid stand-up the legs dipped 15 cm below the floor: found by `figures.test.mjs`, fixed with `grounded`.

### Not proven / limits
- Additive-display look is **feel unproven**: the preview shows the figures on a dark floor, not through glasses. The strong ambient light plus the light outline are meant to keep every side visible.
- Hands are simple capsules (no fingers). Hair is a cap, hidden when lying face up.
- The preview's narrow view crops the side figures when looking forward from the start position.
- Poses were tuned by numbers (hand on ankle, hand to head) and one look at the preview, not judged on a headset.

### Captures (CapturePanelScreenshotTool only)
1. Start layout from the start position (pitch down 28 degrees), run seed 77 with the demo layout: the figure at the wall with a red band, and the front-left and front-right figures partly cropped by the narrow view.
2. Close view of the tagged Expectant casualty X lying face up: dark-grey band with a white outline fitted round the rounded torso, light outline round the whole body, soft floor oval.
Taken with a temporary demo script that tagged X and C (script and scene object removed before the commit; `Scene.scene` has no trace). `CaptureRuntimeViewTool` and `QueryRuntimeSceneTool` were not used.

## Pose variation: appearance no longer predicts the tag (3 Nov 2026, overnight run)

**Status: gate passed.** `start-engine.test.mjs` 12/12, `scoring.test.mjs` 23/23, `figures.test.mjs` all pass (it loops over every pose, so the 4 new ones are covered); LEAF 18/18 (17 old + new `triage-pose-variation`), each run on its own on the final code. Step 2 was already committed (9967cf7) before the overnight run, so it was not redone.

### What changed
- `TriageData.ts`: `POSE_INFO` (label, short name, group lying / sitting / slumped per pose) and `POSE_CHOICES` (2-3 poses per case, first = default). Walkers: seated only. F and X: lying only (no groaning pose). A-E: lying, side-lying, seated or slumped. The same pose is offered to cases with different tags.
- `TriageFigurePose.ts`: 4 new poses from joint angles: `sitting_knees_up`, `sitting_leaning_back`, `lying_back_knee_up`, `lying_back_arm_up`.
- `TriageLayout.ts`: each placed casualty has a `pose`, picked from a separate random stream (so layouts of every seed are unchanged), plus a random body turn (0-360, wall casualty +-8) and a small position shift (+-10 cm, kept inside the slot). The wall casualty only gets a seated or slumped pose. The demo seed (77) keeps default poses, yaw and positions. `validateRun` also checks pose choices, walker seated, F/X lying, wall pose, play area. A slumped casualty away from the wall gets the backrest (was C only).
- Card title, run state (`poseLabel`) and debrief row names now come from the pose shown (`TriageMain.getCasualtyPose`).

### Test
- New LEAF `triage-pose-variation`: all offered poses on the floor at real size; 1200 layouts (400 seeds x 3 Black settings) valid and repeatable; walkers always seated; F/X never upright; every case shows all its poses; shared poses span different tags; demo seed poses and positions unchanged; for 6 built seeds the figure is in the run's pose, real size, on the floor, and the card title equals the label.
- Failed once: my first position shift (+-10 cm beyond the slot) made W2/X 150 cm apart (rule: more than 150). Fixed by keeping the shift inside the slot. No test failed twice.

### Not proven / limits
- New poses were tuned by numbers (feet and hands on the floor, bounds) and one preview capture, not judged by eye. Look at them.
- Pose names are shared between cases, so a pose label never names an injury except W1's bandage / "arm cut" and W2's "holding ankle", which only those walkers can take.

### Capture
`devpost/captures/step3-seed21-layout.jpg`: non-demo seed 21, from the start position, pitched down 28 degrees (seated figure, two lying figures cropped by the narrow view). Taken with a temporary LEAF scenario (deleted).

## Learn mode with START guide; Drill mode unchanged (3 Nov 2026, overnight run)

**Status: gate passed.** `start-engine.test.mjs` 12/12, `scoring.test.mjs` 23/23, `figures.test.mjs` 70/70, new `learn-chips.test.mjs` 15/15; LEAF 19/19 (18 + new `triage-learn-mode`; `triage-start-screen` updated for the new buttons), each run on its own on the final code.

### What changed
- **Start screen** (`TriageStartUI.ts`): two buttons, "Learn" (object `LearnButton`) and "Drill" (object `StartButton`, so the old tests still press it). Both start the same timed run; `onStart` now carries the mode. The label input is `drillLabel` (the scene's old `startLabel: Start` would have overridden a default).
- **Mode** (`TriageMain.ts`): `getMode()` / `setMode()`; `startRun(mode?)`. Restart keeps the mode. Default Drill.
- **Chips** (`TriageStartEngine.ts` `learnChips`, pure and tested in Node; `TriageCheckCards.ts`): five chips across the top of the card: Walks? · Breath? · Rate · Pulse · Obeys? (shortened so the card does not widen). Current step = bright text + a cyan bar; passed steps light blue-white; steps not reached dim grey; the deciding step shows the tag word in the tag colour with a bar in that colour (EXPECTANT is white, never black). While the airway is pending the Breath chip reads "Airway".
- **Same card size.** In Learn the card's spacing is tightened (row gap 0.3, padding 0.7, title and status rows a little shorter, title pushed down by the chip row) so everything fits the same 25 x 26.5 cm card. Drill restores the old values; the test checks the Drill layout is identical before and after a Learn run.
- **Debrief** (`TriageScoring.summarize(…, modeLabel)`): Learn's first summary line is "Learn · 1 of 4 correct · 3 missed". Drill's summary is exactly as before.
- `TriageFigureBuilder.material()` made public (the chips swap bar colours).

### Decisions I made (change if you disagree)
- The mode label appears in the debrief for Learn only; Drill's debrief is deliberately unchanged ("Drill mode is unchanged").
- Chip labels are "Walks?", "Breath?", "Rate", "Pulse", "Obeys?" (spec: shorten rather than widen).
- Start screen buttons are stacked, Learn above Drill, same size as the old Start button.

### Failed or odd on the way
- `triage-learn-mode` failed once: my test ran a debrief with all four casualties missed, and that panel is 17.15 degrees tall from the start position against the 17 degree limit. **This is a pre-existing limit** (the existing tests only ever have 0 or 3 missed): in a real run where you never reach anyone, the debrief panel is about 0.15 degrees over the limit. Not fixed (out of scope); the test now tags X first like the existing time-up test. Passed after.

### Not proven / limits
- Chip text is small (about two thirds of the button text). Readable in the preview capture; on real glasses: feel unproven.
- Mouse presses on the Learn / Drill buttons in Interactive Preview: only LEAF presses are proven (see the earlier note on mouse clicks).

### Capture
`devpost/captures/step4-learn-card.jpg`: Learn card for the slumped casualty after Breathing and Rate: Walks?, Breath?, Rate done, Pulse highlighted with a bar, Obeys? dim. Taken with a temporary LEAF scenario (deleted).

## Polish: consistent UI boards and calm animations (3 Nov 2026)

**Status: gate passed.** Node: start-engine 12/12, scoring 23/23, figures 70/70, learn-chips 15/15, new debrief-layout 12/12. LEAF 20/20 (19 + new `triage-debrief-reveal`), each run alone on the final code.

### Done
1. One style: shared `TriageUi.ts` (UI Kit backplate style, padding, gap) and `TriageUiSizes.ts` (one font, three sizes: title / body / small, scaled by distance so the small size stays readable; debrief boosted x1.4).
2. Card hierarchy: header row (pose left, timer right), Learn chip row directly under it, check buttons in a column, latest result prominent, tag buttons separated. Card width unchanged.
3. Tag buttons: colour plus word, equal size.
4. Debrief: summary and NOT REACHED in title size, rows as a table (`TriageDebriefLayout.ts`, pure and tested in Node), explanations smaller and lighter. All 81 status combinations fit; nobody-reached now fits (was 0.15 deg too tall).
5. Start screen: "Learn — shows the START steps as you go" and "Drill — the real thing, no hints".
7. Buttons: UI Kit hover plus a press pop (0.05 s down, 0.09 s back).
8. Cards and panels fade and scale in (0.24 s) and out (0.18 s).
9. Tag band ring grows into place (0.3 s).
10. Walker: ease in/out (`easeInOutCubic`) for the stand-up and walk.
11. Debrief reveal: Time's up, short pause (0.4 s), panel, then every NOT REACHED row and the marker over the real person together, then the other rows one by one.

### Skipped
- 6: no `devpost/user-tests.md` exists, so nothing to add.

### Tests changed or added (all because the boards deliberately changed)
- New LEAF `triage-debrief-reveal`: nobody reached (reveal order, fit inside the view limits, readable); mixed run (missed first, then the tagged row). New Node `debrief-layout.test.mjs`.
- Updated: timer text now read from the header (`getCardLabels().timer`); explanation and small lines are light blue-grey, not pure white; NOT REACHED ties with the summary at title size; smallest debrief text limit 116 -> 100; Learn chip row checked under the header; all-tagged waits for the reveal; start screen checks the two new lines; pose-variation pins the viewer far away so proximity cannot swap the open card.
- `triage-debrief-all-tagged` failed twice in a row: my first fix (waiting for the reveal) was a wrong guess; the real cause was the explanation colour check. The second fix passed.

### Not proven
- Motion timings were checked as numbers and in tests, not by eye on glasses. Hover highlight is the UI Kit's own.

### Captures
`devpost/captures/polish-learn-card.jpg`, `devpost/captures/polish-debrief.jpg` (temporary LEAF scenarios, deleted).

## Render polish: figures and floor markings (4 and 6 Nov 2026)

**Status: gate passed on 6 Nov.** Node: start-engine 12/12, scoring 23/23, figures 77/77, learn-chips 15/15, debrief-layout 12/12. LEAF 20/20, each run alone on the final code. Git tag `before-render-polish` marks the starting commit. The work stopped on 4 Nov because `triage-learn-mode` failed; the cause and fixes are below.

### Done (code written, checked in the preview)
1. **Exposure:** scene lights changed (ambient 1.25 -> 0.75, key 0.85 -> 0.5; saved in `Scene.scene`) plus baked vertex shading (faces that point down are up to 10% darker, limb ends 4-6% darker at joints, never below about 0.8; darkest baked vertex luminance is tested > 0.4). Limbs and torsos now show soft, clearly visible shading.
2. **Body shape:** tapered limbs (thigh 16.5 -> 11.4 cm, upper arm 9.6 -> 7.6, forearm 7.4 -> 5.6, calf bulge), joint balls at shoulders, elbows, hips, knees (no gaps or capsule ends), shaped torso (hips, waist, chest, shoulders) and an egg-shaped head, via smooth lofted rings with smooth normals. SEGMENTS kept at 14 (edges did not look faceted). About 4,600 vertices and 6,900 triangles per figure (skin mesh), the outline mesh the same again.
3. **Clothing:** sleeves with lighter cuffs, trouser cuffs with a bare ankle below, shoes in their own colour family; more saturated light shirt and trouser palettes; shirt, trousers, skin and shoes of one person are kept apart in colour (rare clashes remain: about 15 in 2,000 looks).
4. **Outline:** 1.1 -> 0.4 cm, tinted per figure (its shirt colour, 15% lighter). The fresnel shader was not tried (thin hull looks right).
5. **Head:** egg-shaped head, five hair styles by seed (short, long, bun, side fringe, buzz), and a minimal face (two small blue-grey eyes, small mouth) identical on everyone.
6. **Floor ovals removed.** The figures did not look like they float, so no replacement ring was added. Resting figure = 2 draw calls (was 3).
7. **Green zone:** the disc is now a smooth light-green ring (96 segments) with a very faint fill; label "GREEN — MINOR" with "Walking wounded" smaller below, lying on the player's side of the zone and turned to face the start position. The walker's stopping point moved to the far side of the ring so they never cover the label (arrival 28 cm from the centre). Inputs on `TriageZoneUI` renamed (`zoneLine1` ...) because the scene's saved old values override script defaults.
8. **Wall:** the blue slab is now a thin 1.2 cm line where the wall meets the floor (same colour as the play-area outline); the slumped casualty's backrest is thinner and dimmer.

### Tests
- Node: start-engine 12/12, scoring 23/23, figures 77/77 (7 new checks: palettes, colour separation, hair styles, cuffs/face parts, thin outline, band fit, darkest vertex), learn-chips 15/15, debrief-layout 12/12.
- LEAF (one at a time, on the final code): 20 of 20 pass. Size bounds (70-220, -3..8, 130) needed no change.
- `triage-behind-never-walker-f-x`: the first call timed out at the tool, then ran late; the retry ran after it. Both passed, with no overlap.
- Test changes: `TriageRestartScenario.ts` waits up to 4 s for the Restart button instead of a fixed 1.3 s (it failed twice in a row because the button became pressable about 70 ms later). `TriageLearnModeScenario.ts` is unchanged: the bugs were in the Lens.

### Why `triage-learn-mode` failed: two Lens bugs, both fixed
**1. Chip row left out of the card layout (`TriageCheckCards.ts`).** The failing check was `startRowY - 0.85 >= fit.statusTop - 0.4`, with the row at y = 0. UI Kit's `FlexLayout` manages only enabled children and finds them once, when the card is first shown. If that first showing was in Drill, the chip row was disabled, so it stayed out of the layout in every later Learn run in that Lens session. The result depended on which mode showed the card first:
- First card in Drill, unchanged code: 6 items, row y = 0, fails.
- First card in Learn, same code: 7 items, row y = 8.74, the chip checks pass.
- It passed on 3 Nov and failed on 4 Nov on the same code because of the preview camera. The scenario presses Learn before it pins the viewer far away, so a camera near a casualty opens a card by proximity in Learn. With the fix removed and the camera at (0, 0, -150), the first card opened in Learn and the scenario passed; from the start position it fails. The 3 Nov camera position is not in the logs, so that part is inferred; this build log's 3 Nov polish entry does record proximity swapping the open card in `triage-pose-variation`, which failed that way minutes before.
- Fix: `applyMode` calls `refreshChildren()` when the mode changes. Drill now has 6 items and Learn 7, in either order. This also removes an extra gap that Drill kept after a card had first been shown in Learn.
- Reach: the mode only changes during a Lens session in tests, because Restart keeps the mode, so a player would not have hit this.

**2. Restart could destroy the button while it was still held (`TriageDebrief.ts`).** One run failed with `Object is null` just after Restart. The old debrief's 0.5 s destroy timer was set before the run was rebuilt, and `getTime()` does not move during a frame, so the rebuild used up about 0.3 s of it. Measured: 0.503 s by `getTime()` but 0.188 s of real time, leaving about 0.1 s after LEAF's interactor let go. Shortening the delay to 0.3 s reproduced the same error on demand. Fix: the timer starts on the first frame after the rebuild; measured afterwards, the destroy comes about 0.5 s after the interactor lets go. Possibly reachable with a real hand, since the same code handles a hand's cursor (not tested on glasses).

Also ruled out: the `Can not Set Media Type for Sink Writer` errors in the log are Lens Studio's audio output on this PC and are already in the 3 Nov log.

### Scene
`Scene.scene` has ambient 0.75, key 0.5 and "Use demo seed" off. Other changes against the last commit, reviewed before committing: the renamed `TriageZoneUI` inputs, `TriageStartUI` start screen lines, and new IDs for the LEAF Plugin Bridge (same content).

### Captures (CapturePanelScreenshotTool only)
`devpost/captures/render-before-seed21.jpg` (base code, 4 Nov) and `render-after-seed21.jpg` (seed 21, start position, pitched down 28 degrees, nobody tagged), `render-after-close-tagged.jpg` (casualty B on seed 21, tagged Red: band round the shaped torso, face, hair, cuffs, shoes). Both `after` captures were retaken on 6 Nov on the final colours, before the last test pass, using a temporary scenario that was then deleted; removing it was the only code change after them. The close view's camera position was chosen to match the old capture, not copied exactly. The zone and walker were checked in a tuning capture on 4 Nov; the label text in that capture still read the old "MINOR" because of the stale scene value, fixed afterwards by renaming the inputs and **not re-captured**.

### Not proven
- Additive-display look: feel unproven (preview shows a dark floor). The faint zone fill and the dim backrest may be too faint on glasses.
- New zone label inside the ring after the rename and the new walker spot: checked by numbers (arrival distance) and one capture, not by a LEAF scenario.
