---
status: approved
---

# Design brief: Triage Room

## The one spatial moment
You press Start and read "A gas cylinder burst in the college canteen. The fire is out. You're the first trained volunteer inside — four people need you." The 3:00 timer starts. Three light-coloured figures lie on your floor at real size, and you hear a groan behind you with a small arrow at the edge of your view pointing that way. You call out "walk to me" so the walker goes to the green zone, walk up to the person on their back, run the START checks with big pinch buttons, tag them Red, and then the groan reminds you you're not done and you turn round to find the fourth person.

**Who it's for:** college first-aid and NSS volunteers who have done a classroom first-aid session but have never had to handle several hurt people at once.

**The lesson:** find everyone first, then prioritise. The person you never reach is the worst outcome, worse than a wrong tag. Scan the whole room before committing to anyone, call the walkers out early, and stop checking once a step has decided the tag.

## Why it belongs on glasses
- Uses: draws in the world (casualties at real size on your own floor) and leaves your body free (hands for pinch, eyes up, walking around the scene).
- Why it's better than the phone or laptop version: on a screen you can see everyone at once. In your room you have to turn and walk, so the person behind you really is out of sight, and that is what the drill teaches.

## Product or overlay
- Type: product: the virtual scene is the experience.
- What the real version would sense: nothing. Vital signs are scripted, nothing is measured on a real body.
- Stand-in for the preview: vitals are pre-scripted per casualty; "Call out: walk to me" is a button (voice may not work in the preview); "Open airway" is a button; "Open" on a casualty's dot is the fallback for walking up close.

## Where things live
- Where the user is looking during the main task: at the casualty they are checking, with the check card a little below eye level in front of them.
- Play area: about 4 × 4 m of clear floor, designed to still work in a smaller room.
- Casualties: 4 figures on the floor at real size, 1.5 to 3 m apart. Two are in front of the start position about 2 to 3 m away (one a bit left, one a bit right). One sits up against a wall so the layout fits a small room. One is about 2 m behind the start position, always. Stylised, light-coloured, no gore.
- Groan and arrow: the person behind groans (spatial sound, from their direction). A small arrow at the edge of view points to them until they come into view.
- Green zone: a flat green circle on the floor, about 1 m across, 1.5 m to the front-left of the start position, with the word "MINOR". It is always in front of the user, never behind.
- Dot: a small dot above each casualty. It becomes the check card when the user is within about 1.5 m. Pinching "Open" on the dot opens the same card from further away.
- Check card: about 0.8 m from the eyes (default), a little below eye level, with 3 to 4 big buttons.
- Tag band: a coloured band plus a word wraps around a tagged casualty. Every tag shows colour and a word. Black case: dark grey with a white outline and the word "EXPECTANT", never black.
- Debrief map: lies flat on the floor in front of the user, a top-down layout of the room.
- Restart button: sits at waist height just above the map (not flat on the floor), so it can be reached while standing.

## Hands and input
- Start, Restart: pinch a button.
- "Call out: walk to me": pinch a button. The walker stands up, walks to the green circle, and gets a green band. Nobody else moves.
- Check card: pinch the START check buttons ("Breathing?", "Breathing rate", pulse / capillary refill, "Follows commands?"). Each shows that casualty's scripted result.
- "Open airway": a button on the check card, appearing where the "Breathing? No" result appears.
- Tag buttons (Red, Yellow, Green, Expectant): appear on the card once a check has decided the tag. Pinching one tags the casualty and closes the card.
- Targets are big and highlight when aimed at.
- Voice: none. The call-out is a button.

## When things show
- Dot above a casualty: shows from the start; becomes the card within about 1.5 m or when "Open" is pinched.
- Check card: shows only when opened; closes on tagging. Tag buttons appear only once a step has decided the tag.
- Timer: shown only on the open card and in the debrief (default, from the handoff notes). A chime plays at 0:30 left.
- Scenario line: shows after Start, then recedes (default: fades after a few seconds).
- Arrow: shows at the edge of view while the person behind is out of view; disappears once they are in view.
- At 0:00, or when everyone is tagged: any open card closes and the debrief map appears on the floor.
- If something needs attention out of view: the spatial groan plus the edge-of-view arrow.

## START rules the Lens must follow
Run in order; the first rule that fires decides the tag, then stop.
0. Walker (can walk) → Green (Minor).
1. Not breathing → open airway. Still not breathing → Black (Expectant). Breathing after airway → Red.
2. Breathing, rate over 30/min → Red. (Never use exactly 30; use values such as 28 and 32.)
3. Radial pulse absent, or capillary refill over 2 s → Red. (Never use exactly 2 s; use 1 s or 3 s.)
4. Cannot follow simple commands → Red. Can → Yellow (Delayed).
- Walkers are Green even if the injury looks bad; the debrief notes that real START reassesses them later.

**START logic test cases** (every one must pass):

| # | Input | Expected |
|---|---|---|
| 1 | walks=yes | Green |
| 2 | walks=yes, visible bad injury | Green |
| 3 | walks=no, breathing=no, afterAirway=no | Black (EXPECTANT) |
| 4 | walks=no, breathing=no, afterAirway=yes | Red |
| 5 | breathing=yes, RR=34 | Red (no further checks needed) |
| 6 | breathing=yes, RR=32 | Red |
| 7 | breathing=yes, RR=28, pulse=present, refill=1, commands=yes | Yellow |
| 8 | breathing=yes, RR=22, pulse=absent | Red |
| 9 | breathing=yes, RR=22, pulse=present, refill=3 | Red |
| 10 | breathing=yes, RR=18, pulse=present, refill=1, commands=no | Red |
| 11 | breathing=yes, RR=16, pulse=present, refill=1, commands=yes | Yellow |
| 12 | Player checks pulse after RR=34 | Tag Red; extraChecks=1 |

## Casualty pool
Each run has 4 casualties: 1 walker (W1 or W2) plus 3 non-walkers from A–F and X. Every finding is pre-scripted (the Lens can't measure a real body). The buttons on the check card reveal these values; a "—" means that check is never needed for this casualty because an earlier step decides the tag.

| ID | Pose | Walks | Breathing | After airway | Resp. rate | Radial pulse / refill | Follows commands | Correct tag | Deciding step |
|---|---|---|---|---|---|---|---|---|---|
| W1 | Sitting, arm cut | Yes | — | — | — | — | — | Green | 0 |
| W2 | Sitting, holding ankle | Yes | — | — | — | — | — | Green | 0 |
| A | Lying on back | No | Yes | — | 34 | — | — | Red | 3 (rate) |
| B | Lying on side | No | Yes | — | 22 | Pulse absent | — | Red | 4 (pulse) |
| C | Slumped against wall | No | Yes | — | 18 | Present, refill 1 s | No | Red | 5 (commands) |
| D | Lying, groaning | No | Yes | — | 16 | Present, refill 1 s | Yes | Yellow | 5 (commands) |
| E | Sitting, dazed | No | Yes | — | 28 | Present, refill 1 s | Yes | Yellow | 5 (commands) |
| F | Lying face up, still | No | No | Yes | — | — | — | Red | 2 (after airway) |
| X | Lying face up, still | No | No | No | — | — | — | Black (EXPECTANT) | 2 (after airway) |

Deciding step numbers: 0 = can walk, 1 = breathing?, 2 = breathing after airway opened, 3 = rate over 30/min, 4 = radial pulse absent or refill over 2 s, 5 = follows simple commands.

**Rules for choosing a run's casualties:**
- Exactly 1 walker (W1 or W2) and 3 non-walkers.
- The casualty who starts behind the user is always a breathing non-walker, one of A–E. Never a walker (the call-out would walk them into view and spoil the miss), and never F or X (someone who isn't breathing can't groan).
- Black case (X): it takes one of the three non-walker slots (never the one behind the user) in about one run in three. A fixed seed can force it on or off, for testing and for the video.
- Which cases appear and where they lie is shuffled on every run. A seed can be set so the layout is the same every time (see Done criteria 5).

## Debrief
For each casualty the map shows: your tag against the correct tag, time spent, and extra checks (checks made after the deciding step; each one counts +1). Anyone untagged flashes "Not reached" with their correct tag; a missed person counts as a wrong tag, and time spent on everyone else still shows. The Black case gets one sentence explaining why Expectant was the right call. The feel: a small jolt ("I thought I was done, and I wasn't"), then curiosity, not embarrassment, so the first thought is "let me try that again". Restart is a button at waist height just above the map.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. When I press Start, four casualties appear on the floor at real size and roughly the right spacing. One is behind my starting view, I hear a groan from that direction, and an arrow at the edge of my view points to them until I turn round.
2. When I pinch "Call out: walk to me", the walker gets up, walks into the green MINOR circle and gets a green band. None of the others move.
3. When I walk up to a casualty, the check card opens once I'm within about 1.5 m. From further away, pinching "Open" on their dot opens the same card. Each check button shows that person's scripted result. Once a check decides the tag, the tag buttons appear. Tagging closes the card and puts a coloured band and a word on the person.
4. The tags follow START every time: breathing rate 34 → Red with no more checks needed; not breathing, then still not breathing after "Open airway" → EXPECTANT (dark grey, white outline); rate 16, pulse present, refill 1 s, follows commands → Yellow. Checks made after the deciding step are counted as extra checks in the debrief. All 12 START logic test cases above pass.
5. When everyone is tagged, or the timer reaches 0:00, the debrief map lies flat on the floor in front of me. For each person it shows my tag against the correct one, time taken and extra checks; anyone I didn't reach flashes "Not reached". Pressing Restart shuffles who is where: two runs with different seeds give different layouts. A fixed seed can be set so the LEAF tests and my demo recording get the same layout every time; with a fixed seed the Black case can also be forced on or off.

## Out of scope
- Not a CPR, bleeding-control or airway-skills trainer; no hand skills.
- Not a certification or a substitute for an in-person course (say "training drill, not certification" in the video).
- No gore, no real vital-sign measurement, no voice, no recording or following of people.
- No multi-person sharing, no memory across sessions.
- No children / paediatric triage; adult START only.

## Risks and open questions
- Vital signs are scripted and the call-out, airway and "Open" actions are buttons. These stand-ins must be called out honestly in the video.
- Distance-based card opening cannot be fully judged in the preview: how comfortable 1.5 m and a card 0.8 m from the eyes feel on real glasses is unproven.
- A Black case is emotionally heavy; it is kept calm and respectful (light style, no sound, no gore), and the debrief explains it in one sentence.
- Sources disagree on exactly 30/min and 2 s; scripts avoid those exact values.
- Defaults I filled in without the learner choosing them: card distance 0.8 m, timer shown only on the card and in the debrief, scenario line fading. The casualty table and test cases come from the learner's own handoff notes.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands. Casualties are light-coloured; the Expectant tag is dark grey with a white outline.
- Make the shuffle seedable: a fixed seed gives the same layout every run, and with a fixed seed the Black case can be forced on or off.
- Build order: (1) room, casualties placed incl. one behind, Start button, scenario line; (2) check cards plus START engine with the 12 test cases passing; (3) call-out, timer, groan and arrow, chime; (4) debrief map and scoring; (5) shuffle and restart, then polish.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the check card 15 cm lower. Make the tag buttons twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources

## Changes after approval
The text above is the approved brief and is left as it was. Three changes were made after approval (6 Nov 2026), so that a player can really miss someone and see it measured. Done criterion 1 above (the groan with an arrow that points to the person behind until you turn round) now describes **Learn mode only**.

1. **Scene clear.** A run used to end only when everyone was tagged or time ran out, so a player could not decide they had finished. A "Scene clear" button now appears after the first tag or call-out. Pinching it asks "Have you found everyone?" ("Yes, scene clear" / "Keep looking") and never says how many people remain. "Yes" ends the run (end reason "scene-clear", no Time's up panel); anyone untagged is NOT REACHED and counts as wrong, as at time's up. Why: saying "I'm done" while someone is still missing is the mistake the drill is about.
2. **Fewer hints in Drill.** The arrow and the repeating groan led the player to the person behind in both modes, which made a real miss unlikely. In **Drill** there is no arrow; the groan plays once, about 1.5 s after Start, with the caption "A groan, somewhere behind you" (about 4 s). In **Learn** the groan repeats, each with the same caption, and the arrow shows only until the player first sees that person, then never again. Why: the arrow made finding the person behind free.
3. **First-seen times.** To measure the lesson directly, the run records when each casualty first came into view and when the first tag or call-out happened. The debrief adds one line under the summary ("Everyone in view by 0:48" or "1 person never came into view") and, when the first tag or call-out came before everyone had been in view, "You started before seeing everyone". "In view" uses head direction (the camera's field of view, head or torso), not eye tracking, so it is worded "in view", never "looked at". Why: it shows the player, in a number, whether they scanned the room before committing.

4. **A bigger casualty pool (6 Nov 2026).** The pool of 9 cases repeated too quickly, and no case was decided by capillary refill. Four cases were added; the table above is unchanged, and these rows are added to it. Each run still has exactly 4 casualties: 1 walker plus 3 non-walkers. The poses are the existing 12 (no new poses); each new case takes 3 of them under the same pose rules (walkers seated; nobody lies against the wall; no pose is offered to only one tag).

| ID | Pose (first is the default) | Walks | Breathing | After airway | Resp. rate | Radial pulse / refill | Follows commands | Correct tag | Deciding step |
|---|---|---|---|---|---|---|---|---|---|
| G | Lying on back (also sitting leaning back, lying on side) | No | Yes | — | 20 | Present, refill 3 s | — | Red | 4 (refill) |
| H | Sitting, knees up (also lying on back, slumped against wall) | No | Yes | — | 24 | Present, refill 1 s | Yes | Yellow | 5 (commands) |
| J | Lying on back, arm up (also sitting dazed, lying groaning) | No | Yes | — | 32 | — | — | Red | 3 (rate) |
| W3 | Sitting, dazed (also sitting leaning back, sitting knees up) | Yes | — | — | — | — | — | Green | 0 |

   G is the first case decided by capillary refill: pulse present, but refill 3 s is over 2 s, so Red at step 4 (its debrief line reads "Refill 3 s is over 2 s → Red"). W3 is a walker whose seated poses include ones that look serious; walkers are Green however badly hurt they look. No scripted rate is exactly 30/min and no refill exactly 2 s.

   The selection rules above now read: exactly 1 walker (W1, W2 or W3) and 3 non-walkers from A–F, G, H, J and X; the person behind the user is a breathing non-walker, one of A–E, G, H or J (never a walker, F or X). X still appears in about one run in three and is never behind the user.

   Seeds: a bigger pool changes what every seed produces. The demo seed 77 is pinned to the original pool, so its documented layout, cases and poses are exactly as before. Other seeds give a different cast than before (for example seed 21 and seed 42); where each person lies is unchanged.
