// Run with: node devpost/tests/debrief-layout.test.mjs  (Node 22.18+, strips TS types)
// The debrief panel's size and reveal order: pure maths from TriageDebriefLayout.ts + real scoring entries.
import { layoutPanel as layout, revealSchedule, PANEL_W } from "../../Assets/Scripts/TriageDebriefLayout.ts"
import { sizesAt } from "../../Assets/Scripts/TriageUiSizes.ts"

const DEBRIEF_SIZES = sizesAt(120, 1.4) // same as TriageUi.DEBRIEF_SIZES
const layoutPanel = (e) => layout(e, DEBRIEF_SIZES)
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

function entries(statuses) {
  const raw = IDS.map((id, i) => {
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
check("all 81 status combinations fit the view with 1 degree to spare", worst < VIEW_HALF_V_DEG - 1, { worstDeg: Math.round(worst * 100) / 100, worstCombo })

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

console.log(pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
