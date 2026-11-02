# Triage Room

A timed mass-casualty triage drill for Snap Spectacles, built in Lens Studio. It is for college first-aid and NSS volunteers who want to practise the START triage method.

**The lesson: find everyone first, then prioritise.** Four casualties lie on the floor at real size. One of them is behind you. If you only look at the ones in front of you, you miss them.

## How a run works

1. Press **Learn** or **Drill**. Both start the same timed run (a short scenario line and a 3-minute timer). Learn adds a START guide: a row of five step chips (Walks? · Breath? · Rate · Pulse · Obeys?) across the top of the check card. The current step is highlighted, the step that decides the tag shows the tag colour and word, and steps not reached stay dim. Drill is the plain drill with no guide. The debrief notes the mode ("Learn · 3 of 4 correct · ..."), and Restart keeps the mode.
2. Walk to a casualty. A check card opens when you are close.
3. Run the START checks with the buttons: breathing, rate, pulse / refill, follows commands. Use Open airway if they are not breathing.
4. Tag them: Green, Yellow, Red or Expectant. Call out to the walking casualty to send them to the green zone.
5. Listen for the groan behind you, and find that casualty before time runs out.
6. When all are tagged or time is up, a debrief shows each casualty: your tag, the correct tag, the rule that decides it, time taken, extra checks, and anyone you never reached. Restart gives a new layout.

Poses vary between runs, so you can't tag by appearance — you have to check.

## Open it

- Lens Studio 5.23.2. Open `Triage-room.esproj`.
- Use the Interactive Preview. Controls: WASD to move, Q / E to go down and up, right-drag to look around, click = pinch.

## Demo seed

Select the TriageMain object and tick **Use demo seed**. It gives a fixed layout with the Expectant case, a walker, and a groaning casualty behind you. It is used for the demo video. A restart repeats the same layout while it is on.

## Tests

- LEAF tests run in the preview: open the LEAF panel and run each scenario one at a time.
- Plain Node (22.18+):
  - `node devpost/tests/start-engine.test.mjs`
  - `node devpost/tests/scoring.test.mjs`
  - `node devpost/tests/figures.test.mjs`
  - `node devpost/tests/learn-chips.test.mjs`

## Honest limits

- Vitals are scripted. Nothing is measured.
- Call-out, Open airway and Open are buttons, not voice or hand skills.
- Built and tested only in the Lens Studio preview. It has never run on a device.
- The preview's view is narrow, so the layout and the debrief panel are sized to fit it.
- This is a training drill, not certification. It is not a replacement for an in-person course.

## How it was built

Planned with the hackathon skill pack (`devpost/design-brief.md`). Built with Claude Code and CLAD over the Lens Studio MCP, step by step, with LEAF tests as the gate for each step. See [devpost/build-log.md](devpost/build-log.md).

## Sources

- START Adult Triage Algorithm (CHEMM, U.S. HHS): https://chemm.hhs.gov/startadult.htm
- START Triage with RPM (Fire Engineering): https://www.fireengineering.com/firefighting/start-triage-with-rpm/
- SPECS design rules and preview limits: `challengepost/learn-specs` skill pack

## Licence

My own code is MIT (see `LICENSE`). The Spectacles packages in `Packages/` (Spectacles Interaction Kit, Spectacles UI Kit, Leaf) are Snap's and are under Snap's terms.
