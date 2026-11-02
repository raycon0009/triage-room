// Run with: node devpost/tests/scoring.test.mjs  (Node 22.18+, strips TS types)
import { buildEntry, summarize, ruleLine, formatClock, tagWord } from "../../Assets/Scripts/TriageScoring.ts"
import { CASUALTY_TABLE } from "../../Assets/Scripts/TriageData.ts"

let pass = 0
let fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}
const D = (id) => CASUALTY_TABLE[id]
const entry = (id, tag, extra = 0, open = 10, calledOut = false, at = null) =>
  buildEntry({ def: D(id), tag, openSeconds: open, extraChecks: extra, calledOut, calledOutAtSeconds: at })

// words
check("tag words", tagWord("Green") === "GREEN" && tagWord("Yellow") === "YELLOW" && tagWord("Red") === "RED" && tagWord("Black") === "EXPECTANT" && tagWord(null) === "")
check("clock format", formatClock(0) === "0:00" && formatClock(161) === "2:41" && formatClock(180) === "3:00" && formatClock(9.6) === "0:10")

// statuses
const a = entry("A", "Red")
check("correct tag -> correct", a.status === "correct" && !a.notReached && a.explanation === "", a)
const aw = entry("A", "Yellow", 1)
check("wrong tag -> wrong + rule line", aw.status === "wrong" && aw.explanation === "Rate 34 is over 30 → Red" && aw.myWord === "YELLOW" && aw.correctWord === "RED" && aw.extraChecks === 1, aw)
const am = entry("A", null, 0, 0)
check("untagged -> missed / Not reached, correct tag still shown", am.status === "missed" && am.notReached && am.myWord === "" && am.correctWord === "RED" && am.explanation === "Rate 34 is over 30 → Red", am)

// the rule line for every deciding step in the pool
check("rule B", ruleLine(D("B")) === "Radial pulse absent → Red")
check("rule C", ruleLine(D("C")) === "Cannot follow commands → Red")
check("rule D", ruleLine(D("D")) === "Follows commands → Yellow")
check("rule E", ruleLine(D("E")) === "Follows commands → Yellow")
check("rule F", ruleLine(D("F")) === "Breathes after the airway was opened → Red")
check("rule X", ruleLine(D("X")) === "Not breathing after the airway was opened → Expectant")

// expectant + walkers
const x = entry("X", "Black")
check("expectant case explained even when right", x.status === "correct" && x.explanation.indexOf("Expectant was the right call") >= 0, x)
const w = entry("W1", "Green", 0, 0, true, 42)
check("walker line + called-out time", w.status === "correct" && w.explanation.indexOf("reassesses walkers later") >= 0 && w.timeText === "called out at 0:42" && w.timeSeconds === 42, w)
const wm = entry("W2", null)
check("missed walker still gets the walker line", wm.status === "missed" && wm.explanation.indexOf("reassesses walkers later") >= 0, wm)

// summary for a scripted run: W1 called out (right), A wrong (1 extra), D right, C missed
const run = [entry("W1", "Green", 0, 0, true, 30), entry("A", "Yellow", 1), entry("D", "Yellow", 0, 12), entry("C", null, 0, 4)]
const s = summarize(run, 161)
check("summary counts", s.total === 4 && s.correct === 2 && s.wrong === 1 && s.missed === 1 && s.totalExtraChecks === 1 && s.timeUsedSeconds === 161, s)
check("summary text", s.text === "2 of 4 correct · 1 missed · 1 extra check · 2:41 used", s.text)
check("missed counts as wrong (not correct)", s.total - s.correct === s.wrong + s.missed)
const s2 = summarize([entry("D", "Yellow"), entry("A", "Red", 2)], 70)
check("summary text plural", s2.text === "2 of 2 correct · 0 missed · 2 extra checks · 1:10 used", s2.text)

console.log("\n" + pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
