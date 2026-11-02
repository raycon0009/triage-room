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
