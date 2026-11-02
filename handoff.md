# Triage Room — handoff notes

Prep notes for the plan-lens interview and the build. These are NOT the design brief.
plan-lens writes the brief (`devpost/design-brief.md`) from your own answers; the brief is
what CLAD builds from. Keep this file in the project root, not in `devpost/`.

Sections marked **YOU DECIDE** are yours to answer in the interview, in your own words.

---

## 1. The idea in one line

A timed mass-casualty triage drill in your room: 4 casualties on the floor at real size,
you find each one, run the START checks with big pinch buttons, tag them, and a floor
debrief shows what you got right, how long each took, and anyone you missed.

## 2. What it is not

- Not a CPR, bleeding-control or airway trainer (no hand skills; the preview can't see hands).
- Not a certification or a substitute for an in-person course.
- No gore. Casualties are stylised, light-coloured figures (dark content is invisible on an
  additive display).

## 3. The pitch (reframed after stress test)

Not "pressure". **Scene management**: did you find everyone, prioritise correctly, and how
much time did each person cost you? The key video moment is a deliberate miss: you tag
fast, feel done, and the debrief lights up the casualty behind you that you never reached.

## 4. START rules the Lens must follow (adult START)

Run in this order. The first rule that fires decides the tag; stop checking.

| Step | Check | Result |
|---|---|---|
| 0 | Scene call-out: "If you can walk, come to me" | Anyone who walks → **Green (Minor)** |
| 1 | Breathing? | No → reposition airway (step 2). Yes → step 3 |
| 2 | Breathing after airway repositioned? | Yes → **Red (Immediate)**. No → **Black (Expectant)** |
| 3 | Respiratory rate > 30/min? | Yes → **Red** |
| 4 | Radial pulse absent, or capillary refill > 2 s? | Yes → **Red** |
| 5 | Follows simple commands? | No → **Red**. Yes → **Yellow (Delayed)** |

Notes:
- Sources disagree on exactly 30/min and exactly 2 s. **Scripts never use those exact
  values** (use 28 or 32, 1 s or 3 s).
- Walking casualties are Green even if the injury looks bad. Real START reassesses them
  later; say so in the debrief.
- A Black tag must not render black (invisible on SPECS). Use dark grey with a white outline
  and the word "EXPECTANT".
- Show colour and a word on every tag (accessibility).

## 5. Casualty pool (pick 1 walker + 3 non-walkers per run)

Each finding is pre-scripted (stand-in: the Lens can't measure a real body).

| ID | Pose | Walks | Breathing | After airway | RR | Radial pulse / refill | Commands | Correct tag | Deciding step |
|---|---|---|---|---|---|---|---|---|---|
| W1 | Sitting, arm cut | Yes | — | — | — | — | — | Green | 0 |
| W2 | Sitting, holding ankle | Yes | — | — | — | — | — | Green | 0 |
| A | Lying on back | No | Yes | — | 34 | — | — | Red | 3 |
| B | Lying on side | No | Yes | — | 22 | Absent | — | Red | 4 |
| C | Slumped against wall | No | Yes | — | 18 | Present, 1 s | No | Red | 5 |
| D | Lying, groaning | No | Yes | — | 16 | Present, 1 s | Yes | Yellow | 5 |
| E | Sitting, dazed | No | Yes | — | 28 | Present, 1 s | Yes | Yellow | 5 |
| F | Lying face up, still | No | No | Yes | — | — | — | Red | 2 |
| X (optional) | Lying face up, still | No | No | No | — | — | — | Black | 2 |

- **YOU DECIDE:** include case X (Black)? It's emotionally heavy, but triage teaches it.
- Shuffle which cases appear and where on every run, so replays can't be memorised.
- One casualty always starts behind the player, with a groan from that direction.

## 6. Where things live (defaults from the SPECS design rules)

- 4 casualties on the floor, 1.5–3 m apart, inside about a 4 × 4 m area. At least one is
  seated or against a wall, so it fits a small room.
- One casualty behind the starting view. A spatial groan plays from it, and a small arrow at
  the edge of view points to it until it comes into view.
- Each casualty has a small dot above it. The check card opens only when you're within about
  1.5 m (with an "Open" button fallback for the preview), about 0.8 m from the eyes, a little
  below eye level.
- The card holds 3–4 big buttons: the next START check, plus tag buttons once a step fires.
  Tagging closes the card and puts a coloured band and label on the casualty.
- The timer appears only on the open card and in the debrief. A chime plays at 30 s left.
- The debrief map lies flat on the floor in front of you: a top-down layout of the room with
  each casualty showing your tag vs correct, time spent, and extra checks. Missed casualties
  flash.

## 7. Done criteria (each checkable in the preview, each with a LEAF test)

1. On start, 4 casualties appear on the floor at real size, one behind the start view, with a
   groan from it and an arrow pointing to it.
2. Pressing "Call out: walk to me" moves the walker to a green zone and tags them Green.
3. A check card opens only when near (or via "Open"). Each check reveals the scripted finding.
4. Tagging follows the section 4 rules. Tagging at the deciding step counts 0 extra checks;
   each further check counts +1.
5. When all are tagged or time runs out, the debrief shows your tag vs correct, time spent,
   extra checks, and any untagged casualty flashing.
6. Restart shuffles cases and positions (two seeded runs give different layouts).
7. START logic passes every test case in section 8.

## 8. START logic test cases (for LEAF / unit tests)

| # | Input | Expected |
|---|---|---|
| 1 | walks=yes | Green |
| 2 | walks=yes, visible bad injury | Green |
| 3 | walks=no, breathing=no, afterAirway=no | Black |
| 4 | walks=no, breathing=no, afterAirway=yes | Red |
| 5 | breathing=yes, RR=34 | Red (no further checks needed) |
| 6 | breathing=yes, RR=32 | Red |
| 7 | breathing=yes, RR=28, pulse=present, refill=1, commands=yes | Yellow |
| 8 | breathing=yes, RR=22, pulse=absent | Red |
| 9 | breathing=yes, RR=22, pulse=present, refill=3 | Red |
| 10 | breathing=yes, RR=18, pulse=present, refill=1, commands=no | Red |
| 11 | breathing=yes, RR=16, pulse=present, refill=1, commands=yes | Yellow |
| 12 | Player checks pulse after RR=34 | Tag Red; extraChecks=1 |

## 9. Stand-ins (say these honestly in the video)

- Vital signs are scripted; nothing is measured.
- The "walk to me" call-out is a button, since voice may not work in the preview.
- Opening the airway is a button.
- Proximity can also be triggered with an "Open" button.

## 10. YOU DECIDE in the interview (your words, not mine)

- Who exactly is it for? Examples to react to, not copy: college first-aid or NSS volunteers,
  disaster-response volunteers, workplace first-aiders. A real person you know is strongest.
- The scenario line at the start (where it happened, kept non-graphic).
- Time limit (default 3:00).
- Whether to include the Black case.
- What the debrief should make you feel, and what one thing you want people to learn.
- The name. "Triage Room" is a working title.

## 11. Build order (one feature per Claude Code session, `/clear` between)

1. Room, casualties placed (incl. one behind), start button, scenario line.
2. Check cards plus the START engine, with section 8 tests passing.
3. Call-out, timer, groan and arrow, chime.
4. Debrief map plus scoring (extra checks, time per casualty, misses).
5. Shuffle and restart, then polish placement and readability.

Gate: LEAF tests for that feature pass before moving on. If one fails twice after fixes,
log it in `devpost/build-log.md` and move on.

## 12. Video skeleton (under 3:00)

- 0:00–0:20: The problem and who it's for (your face/voice).
- 0:20–0:35: START in one line on screen.
- 0:35–2:00: A full run in the preview, including the deliberate miss of the one behind you.
- 2:00–2:30: The debrief reveals the miss, the extra checks and time per casualty.
- 2:30–2:50: Process: the brief, CLAD building, LEAF tests passing.
- 2:50–3:00: Why it matters, plus "training drill, not certification".

## Sources

- START Adult Triage Algorithm (CHEMM, U.S. HHS): https://chemm.hhs.gov/startadult.htm
- START Triage with RPM (Fire Engineering): https://www.fireengineering.com/firefighting/start-triage-with-rpm/
- SPECS design rules and preview limits: `challengepost/learn-specs` skill pack, `references/`
