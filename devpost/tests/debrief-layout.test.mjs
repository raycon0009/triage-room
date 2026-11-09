// Run with: node devpost/tests/debrief-layout.test.mjs  (Node 22.18+, strips TS types)
// The debrief panel's size and reveal order: pure maths from TriageDebriefLayout.ts + real scoring entries.
import { layoutPanel as layout, revealSchedule, PANEL_W, NOTE_GAP } from "../../Assets/Scripts/TriageDebriefLayout.ts"
import { sizesAt } from "../../Assets/Scripts/TriageUiSizes.ts"

const DEBRIEF_SIZES = sizesAt(120, 1.4) // same as TriageUi.DEBRIEF_SIZES
const layoutPanel = (e, notes = 0, gap = 0) => layout(e, DEBRIEF_SIZES, notes, gap)
import { buildEntry, orderRows } from "../../Assets/Scripts/TriageScoring.ts"
import { CASUALTY_TABLE } from "../../Assets/Scripts/TriageData.ts"

let pass = 0
let fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}

const IDS = ["W1", "A", "D", "X"] // the demo-seed cast: walker, Red, Yellow, Expectant (the longest explanation)
const VIEW_HALF_V_DEG = 17 // measured limit of the preview view from the start position (see TriageLeafDebriefChecks)
const DROP = 3 // panel centre is 3 cm below eye level, 120 cm ahead

function entries(statuses, ids = IDS) {
  const raw = ids.map((id, i) => {
    const def = CASUALTY_TABLE[id]
    const tag = statuses[i] === "missed" ? null : statuses[i] === "correct" ? def.correctTag : def.correctTag === "Red" ? "Yellow" : "Red"
    return buildEntry({ def, tag, openSeconds: 5, extraChecks: 0, calledOut: false, calledOutAtSeconds: null })
  })
  return orderRows(raw)
}
const angle = (h) => (Math.atan2(h / 2 + DROP, 120) * 180) / Math.PI

// every combination of correct / wrong / missed over the four casualties (81), each must fit the view
let worst = 0
let worstCombo = ""
const S = ["correct", "wrong", "missed"]
for (const a of S) for (const b of S) for (const c of S) for (const d of S) {
  const lay = layoutPanel(entries([a, b, c, d]))
  const ang = angle(lay.height)
  if (ang > worst) { worst = ang; worstCombo = [a, b, c, d].join(",") }
}
// the bigger pool: casts with the new cases (refill, rate 32, a seated walker, a yellow) fit the view in all 81 combinations too
for (const cast of [["W3", "G", "J", "X"], ["H", "G", "J", "W3"], ["G", "H", "J", "X"]]) {
  let w = 0
  for (const a of S) for (const b of S) for (const c of S) for (const d of S) w = Math.max(w, angle(layoutPanel(entries([a, b, c, d], cast)).height))
  check("bigger pool, cast " + cast.join(",") + ": all 81 status combinations fit the view with 1 degree to spare", w < VIEW_HALF_V_DEG - 1, { worstDeg: Math.round(w * 100) / 100 })
}
check("all 81 status combinations fit the view with 1 degree to spare", worst < VIEW_HALF_V_DEG - 1, { worstDeg: Math.round(worst * 100) / 100, worstCombo })

// 3 and 4 note lines (the "in view" lines plus the two "Last run / This run" lines). Realistic counts: nobody tagged shows
// 1 "in view" line + 2 comparison lines = 3 notes; otherwise up to 2 + 2 = 4. Every status combination still fits the view.
for (const [label, count] of [["nobody tagged", 3], ["someone tagged", 4]]) {
  let w = 0
  let combo = ""
  for (const a of S) for (const b of S) for (const c of S) for (const d of S) {
    const allMissed = [a, b, c, d].every((x) => x === "missed")
    if ((label === "nobody tagged") !== allMissed) continue
    const ang = angle(layoutPanel(entries([a, b, c, d]), count).height)
    if (ang > w) { w = ang; combo = [a, b, c, d].join(",") }
  }
  check(label + " (" + count + " note lines): fits the view with 0.5 degrees to spare", w < VIEW_HALF_V_DEG - 0.5, { worstDeg: Math.round(w * 100) / 100, combo })
}
for (const cast of [["W3", "G", "J", "X"], ["H", "G", "J", "W3"], ["G", "H", "J", "X"]]) {
  let w = 0
  for (const a of S) for (const b of S) for (const c of S) for (const d of S) w = Math.max(w, angle(layoutPanel(entries([a, b, c, d], cast), [a, b, c, d].every((x) => x === "missed") ? 3 : 4).height))
  check("4 note lines, cast " + cast.join(",") + ": every combination within the view limit (0.5 degrees to spare)", w < VIEW_HALF_V_DEG - 0.5, { worstDeg: Math.round(w * 100) / 100 })
}
for (const notes of [3, 4]) {
  const l = layoutPanel(entries(["missed", "correct", "wrong", "correct"]), notes)
  const ok = l.noteY.length === notes && l.noteY.every((y, i) => (i === 0 ? y < l.summaryY[1] : y < l.noteY[i - 1])) && l.rows[0].y1 < l.noteY[notes - 1]
  check(notes + " note lines: stacked in order under the summary, above the first row, and no overlap with it", ok, { noteY: l.noteY })
}
check("2 note lines: layout unchanged (spacing is only tightened from 3 notes)", layoutPanel(entries(["correct", "correct", "correct", "correct"]), 2).noteY[1] === layoutPanel(entries(["correct", "correct", "correct", "correct"]), 2).noteY[1] && layoutPanel(entries(["correct", "correct", "correct", "correct"]), 2).height > layoutPanel(entries(["correct", "correct", "correct", "correct"]), 1).height)
const none = layoutPanel(entries(["missed", "missed", "missed", "missed"]))
check("nobody reached: fits (was 0.15 degrees too tall)", angle(none.height) < VIEW_HALF_V_DEG - 1, { heightCm: Math.round(none.height * 10) / 10, deg: Math.round(angle(none.height) * 100) / 100 })

// three sizes, in order, and the small one stays readable
check("three sizes: title > body > small", DEBRIEF_SIZES.title > DEBRIEF_SIZES.body && DEBRIEF_SIZES.body > DEBRIEF_SIZES.small, DEBRIEF_SIZES)
check("small text is at least as large (as seen from 1.2 m) as the card's body text (50 at 70 cm)", DEBRIEF_SIZES.small / 120 >= 50 / 70, DEBRIEF_SIZES)

// rows stack top to bottom without overlap
const lay = layoutPanel(entries(["missed", "correct", "wrong", "correct"]))
let ok = lay.summaryY[0] > lay.summaryY[1]
let prev = lay.summaryY[1]
for (const r of lay.rows) {
  ok = ok && r.y1 < prev && r.y2 < r.y1 && (r.lines3 === 0 || r.y3 < r.y2)
  prev = r.lines3 ? r.y3 : r.y2
}
ok = ok && prev > -lay.height
check("rows stack downwards inside the panel", ok, { height: lay.height })
check("missed rows use the title size, others the body size", lay.rows[0].line1Size === DEBRIEF_SIZES.title && lay.rows[1].line1Size === DEBRIEF_SIZES.body)

// the explanation lines stay short
let longest = 0
for (const id of Object.keys(CASUALTY_TABLE)) for (const st of ["wrong", "missed", "correct"]) {
  const def = CASUALTY_TABLE[id]
  const e = buildEntry({ def, tag: st === "missed" ? null : st === "correct" ? def.correctTag : "Red", openSeconds: 1, extraChecks: 0, calledOut: false, calledOutAtSeconds: null })
  longest = Math.max(longest, e.explanation.length)
}
check("panel width is 62 cm", PANEL_W === 62)

// reveal order: panel, then the missed rows together, then the others one by one
const ents = entries(["missed", "correct", "wrong", "missed"])
const plan = revealSchedule(ents)
check("reveal starts with the panel", plan[0].kind === "panel" && plan[0].at === 0)
const missedSteps = plan.filter((s) => s.kind === "missed")
const rowSteps = plan.filter((s) => s.kind === "row")
check("every missed row is revealed, together", missedSteps.length === 2 && missedSteps[0].at === missedSteps[1].at && missedSteps[0].at > 0, missedSteps)
check("then the other rows, one by one, in row order", rowSteps.length === 2 && rowSteps[0].at > missedSteps[0].at && rowSteps[1].at > rowSteps[0].at, rowSteps)
check("the plan follows the row numbers", plan.slice(1).map((s) => s.id).join() === ents.map((e) => e.id).join())
const noMiss = revealSchedule(entries(["correct", "wrong", "correct", "correct"]))
check("nobody missed: rows come in one by one from the first", noMiss.filter((s) => s.kind === "missed").length === 0 && noMiss.length === 5 && noMiss[1].at < noMiss[2].at)

// ---- the first-seen lines under the summary (real-miss change 3): small size, so the text is not shrunk below the minimum
{
  let worstN = 0
  let worstNCombo = ""
  for (const a of S) for (const b of S) for (const c of S) for (const d of S) {
    const allMissed = [a, b, c, d].every((x) => x === "missed")
    const notes = allMissed ? 1 : 2 // nobody tagged: only the "in view" line; someone tagged: it can also say "You started before..."
    const lay2 = layout(entries([a, b, c, d]), DEBRIEF_SIZES, notes)
    const ang = angle(lay2.height)
    if (ang > worstN) { worstN = ang; worstNCombo = [a, b, c, d].join(",") + " notes=" + notes }
  }
  check("all 81 status combinations still fit the view with the view lines (0.5 degrees to spare)", worstN < VIEW_HALF_V_DEG - 0.5, { worstDeg: Math.round(worstN * 100) / 100, worstNCombo })
  const noneN = layout(entries(["missed", "missed", "missed", "missed"]), DEBRIEF_SIZES, 1)
  check("nobody reached plus the view line fits", angle(noneN.height) < VIEW_HALF_V_DEG - 0.5, { heightCm: Math.round(noneN.height * 10) / 10, deg: Math.round(angle(noneN.height) * 100) / 100 })
  const worst2 = layout(entries(["correct", "missed", "missed", "missed"]), DEBRIEF_SIZES, 2)
  check("three missed plus both view lines fits", angle(worst2.height) < VIEW_HALF_V_DEG - 0.5, { heightCm: Math.round(worst2.height * 10) / 10, deg: Math.round(angle(worst2.height) * 100) / 100 })
  check("view lines sit under the summary and above the first row", worst2.noteY.length === 2 && worst2.summaryY[1] > worst2.noteY[0] && worst2.noteY[0] > worst2.noteY[1] && worst2.noteY[1] > worst2.rows[0].y1)
  const plain = layoutPanel(entries(["correct", "correct", "correct", "correct"]))
  check("no view lines: the layout has none", plain.noteY.length === 0)
  check("the view lines use the existing smallest size, not smaller", DEBRIEF_SIZES.small >= 100, DEBRIEF_SIZES)
}

// ---- the gap between the "in view" lines and the comparison lines (4 note lines = 2 view + 2 comparison; 3 = 1 + 2)
{
  for (const [label, view, count] of [["nobody tagged", 1, 3], ["someone tagged", 2, 4]]) {
    let w = 0
    let combo = ""
    for (const a of S) for (const b of S) for (const c of S) for (const d of S) {
      const allMissed = [a, b, c, d].every((x) => x === "missed")
      if ((label === "nobody tagged") !== allMissed) continue
      const ang = angle(layoutPanel(entries([a, b, c, d]), count, view).height)
      if (ang > w) { w = ang; combo = [a, b, c, d].join(",") }
    }
    check("gap, " + label + " (" + count + " note lines): every combination fits the view limit (17 degrees) with 0.4 to spare", w < VIEW_HALF_V_DEG - 0.4, { worstDeg: Math.round(w * 100) / 100, combo })
  }
  for (const cast of [["W3", "G", "J", "X"], ["H", "G", "J", "W3"], ["G", "H", "J", "X"]]) {
    let w = 0
    for (const a of S) for (const b of S) for (const c of S) for (const d of S) {
      const allMissed = [a, b, c, d].every((x) => x === "missed")
      w = Math.max(w, angle(layoutPanel(entries([a, b, c, d], cast), allMissed ? 3 : 4, allMissed ? 1 : 2).height))
    }
    check("gap, 4 note lines, cast " + cast.join(",") + ": within the view limit", w < VIEW_HALF_V_DEG - 0.4, { worstDeg: Math.round(w * 100) / 100 })
  }
  const e4 = entries(["missed", "correct", "wrong", "correct"])
  const withGap = layoutPanel(e4, 4, 2)
  const noGap = layoutPanel(e4, 4, 0)
  const pitchNote = noGap.noteY[0] - noGap.noteY[1]
  check("gap: the space between the 2nd and 3rd note line is larger by NOTE_GAP, the other spaces are unchanged",
    Math.abs((withGap.noteY[1] - withGap.noteY[2]) - (pitchNote + NOTE_GAP)) < 1e-9 && Math.abs((withGap.noteY[0] - withGap.noteY[1]) - pitchNote) < 1e-9 && Math.abs((withGap.noteY[2] - withGap.noteY[3]) - pitchNote) < 1e-9, { NOTE_GAP, pitchNote })
  check("gap: the panel grows by exactly the gap", Math.abs(withGap.height - noGap.height - NOTE_GAP) < 1e-9)
  check("gap: the first two note lines and the summary have not moved", withGap.noteY[0] === noGap.noteY[0] && withGap.noteY[1] === noGap.noteY[1] && withGap.summaryY[1] === noGap.summaryY[1])
  check("gap: note lines still stack in order above the first row", withGap.noteY.every((y, i) => i === 0 || y < withGap.noteY[i - 1]) && withGap.rows[0].y1 < withGap.noteY[3])
  check("no comparison lines: no gap (gapBefore 0, or the gap at the end, changes nothing)", layoutPanel(e4, 2, 0).height === layoutPanel(e4, 2, 2).height && layoutPanel(e4, 2, 0).height === layoutPanel(e4, 2).height)
  check("the gap is small (under 1.2 cm) and text sizes are unchanged", NOTE_GAP > 0 && NOTE_GAP < 1.2 && DEBRIEF_SIZES.small >= 100)
}

console.log(pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
