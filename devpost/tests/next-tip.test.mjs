// Run with: node devpost/tests/next-tip.test.mjs  (Node 22.18+, strips TS types)
// The one-line tip for the next run: every rule, the priority order, and the length.
import { tipFor, ALL_TIPS, MAX_TIP_CHARS, TIP_LOOK_ROUND, TIP_WALKER_GREEN, TIP_AIRWAY_FIRST, TIP_X_EXPECTANT, TIP_IN_ORDER, TIP_STOP_CHECKING, TIP_READY_FOR_DRILL, TIP_FASTER_VIEW } from "../../Assets/Scripts/TriageNextTip.ts"

let pass = 0, fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}

// a run where everything is right: walker W1 Green, A Red, B Yellow, X Expectant (Black)
const right = () => [
  { id: "W1", walks: true, myTag: "Green", correctTag: "Green", extraChecks: 0 },
  { id: "A", walks: false, myTag: "Red", correctTag: "Red", extraChecks: 0 },
  { id: "B", walks: false, myTag: "Yellow", correctTag: "Yellow", extraChecks: 0 },
  { id: "X", walks: false, myTag: "Black", correctTag: "Black", extraChecks: 0 },
]
const run = (mode, edit, started = false) => {
  const cs = right()
  if (edit) edit(cs)
  return tipFor({ mode, casualties: cs, startedBeforeEveryone: started })
}
const by = (cs, id) => cs.find((c) => c.id === id)

// the wording, exactly
check("rule 1 wording", TIP_LOOK_ROUND === "Next run: look all the way round before your first check")
check("rule 2 wording", TIP_WALKER_GREEN === "Anyone who can walk is Green: call them out first")
check("rule 3 wording", TIP_AIRWAY_FIRST === "Open the airway before deciding Expectant")
check("rule 4 wording", TIP_X_EXPECTANT === "No breath even with the airway open: Expectant")
check("rule 5 wording", TIP_IN_ORDER === "Follow the steps in order: the first that decides is the tag")
check("rule 6 wording", TIP_STOP_CHECKING === "Stop checking once a step decides the tag")
check("rule 7 wording", TIP_READY_FOR_DRILL === "Ready for Drill: no arrow, and one groan")
check("rule 8 wording", TIP_FASTER_VIEW === "Next run: get everyone in view sooner")

// each rule on its own
check("rule 1: someone not reached", run("Drill", (cs) => { by(cs, "A").myTag = null }) === TIP_LOOK_ROUND)
check("rule 1: started before seeing everyone", run("Learn", null, true) === TIP_LOOK_ROUND)
check("rule 2: the walker not Green", run("Drill", (cs) => { by(cs, "W1").myTag = "Yellow" }) === TIP_WALKER_GREEN)
check("rule 3: someone other than X tagged Expectant", run("Drill", (cs) => { by(cs, "A").myTag = "Black" }) === TIP_AIRWAY_FIRST)
check("rule 4: X tagged something else", run("Learn", (cs) => { by(cs, "X").myTag = "Red" }) === TIP_X_EXPECTANT)
check("rule 5: another wrong tag", run("Drill", (cs) => { by(cs, "A").myTag = "Yellow" }) === TIP_IN_ORDER)
check("rule 6: extra checks", run("Drill", (cs) => { by(cs, "B").extraChecks = 2 }) === TIP_STOP_CHECKING)
check("rule 7: all right, Learn", run("Learn") === TIP_READY_FOR_DRILL)
check("rule 8: all right, Drill", run("Drill") === TIP_FASTER_VIEW)

// priority when several apply
check("1 beats 2 (not reached and walker wrong)", run("Drill", (cs) => { by(cs, "A").myTag = null; by(cs, "W1").myTag = "Red" }) === TIP_LOOK_ROUND)
check("1 beats everything (started early plus every other mistake)", run("Learn", (cs) => { by(cs, "W1").myTag = "Red"; by(cs, "A").myTag = "Black"; by(cs, "X").myTag = "Red"; by(cs, "B").extraChecks = 3 }, true) === TIP_LOOK_ROUND)
check("2 beats 3", run("Drill", (cs) => { by(cs, "W1").myTag = "Red"; by(cs, "A").myTag = "Black" }) === TIP_WALKER_GREEN)
check("2 beats 4", run("Drill", (cs) => { by(cs, "W1").myTag = "Yellow"; by(cs, "X").myTag = "Red" }) === TIP_WALKER_GREEN)
check("3 beats 4", run("Drill", (cs) => { by(cs, "A").myTag = "Black"; by(cs, "X").myTag = "Red" }) === TIP_AIRWAY_FIRST)
check("3 beats 5", run("Drill", (cs) => { by(cs, "A").myTag = "Black"; by(cs, "B").myTag = "Red" }) === TIP_AIRWAY_FIRST)
check("4 beats 5", run("Drill", (cs) => { by(cs, "X").myTag = "Yellow"; by(cs, "B").myTag = "Red" }) === TIP_X_EXPECTANT)
check("5 beats 6", run("Learn", (cs) => { by(cs, "A").myTag = "Yellow"; by(cs, "B").extraChecks = 1 }) === TIP_IN_ORDER)
check("6 beats 7 and 8", run("Learn", (cs) => { by(cs, "B").extraChecks = 1 }) === TIP_STOP_CHECKING && run("Drill", (cs) => { by(cs, "B").extraChecks = 1 }) === TIP_STOP_CHECKING)
check("the mode only matters when everything is right", run("Learn", (cs) => { by(cs, "A").myTag = "Yellow" }) === run("Drill", (cs) => { by(cs, "A").myTag = "Yellow" }))
check("a run without X: all right is rule 7", tipFor({ mode: "Learn", casualties: right().filter((c) => c.id !== "X"), startedBeforeEveryone: false }) === TIP_READY_FOR_DRILL)

// length and wording
check("eight different tips", new Set(ALL_TIPS).size === 8 && ALL_TIPS.length === 8)
const longest = Math.max(...ALL_TIPS.map((t) => t.length))
check("every tip within " + MAX_TIP_CHARS + " characters", longest <= MAX_TIP_CHARS, { longest })
check("the longest tip is the limit (the layout is sized for it)", longest === MAX_TIP_CHARS, { longest })
check("no tip says 'looked at'", ALL_TIPS.every((t) => !/looked at/i.test(t)))
check("every tip is one line (no newline)", ALL_TIPS.every((t) => t.indexOf("\n") < 0))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
