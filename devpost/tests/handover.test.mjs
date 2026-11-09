// Run with: node devpost/tests/handover.test.mjs  (Node 22.18+, strips TS types)
// The handover question's wording and the Red count: pure code from TriageHandoverText.ts.
import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "Assets", "Scripts")
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-ho-"))
fs.writeFileSync(path.join(dir, "TriageHandoverText.ts"), fs.readFileSync(path.join(scripts, "TriageHandoverText.ts"), "utf8"))
const { handoverLine, redCount, HANDOVER_LINE_1, HANDOVER_LINE_2, HANDOVER_CHOICES, MAX_HANDOVER_CHARS } = await import(pathToFileURL(path.join(dir, "TriageHandoverText.ts")).href)

let pass = 0
let fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}

// a match
check("match: 3 said, 3 Red", handoverLine(3, redCount(["Red", "Red", "Yellow", "Red"])) === "Handover: you said 3 · 3 Red in the room")
// a mismatch
check("mismatch: 2 said, 3 Red", handoverLine(2, redCount(["Red", "Red", "Red", "Green"])) === "Handover: you said 2 · 3 Red in the room")
// nobody Red
check("nobody Red counts 0", redCount(["Green", "Yellow", "Black", "Yellow"]) === 0)
check("nobody Red: said 0", handoverLine(0, 0) === "Handover: you said 0 · 0 Red in the room")
check("nobody Red: said 2", handoverLine(2, 0) === "Handover: you said 2 · 0 Red in the room")
// a missed Red casualty is counted: the count uses the CORRECT tag, whatever the player tagged (or not)
const run = [
  { correctTag: "Red", myTag: "Red" },
  { correctTag: "Red", myTag: null }, // not reached
  { correctTag: "Yellow", myTag: "Red" }, // wrongly tagged Red: does not count
  { correctTag: "Green", myTag: "Green" },
]
check("missed Red is counted, wrongly-tagged Red is not", redCount(run.map((c) => c.correctTag)) === 2)
check("all four Red", redCount(["Red", "Red", "Red", "Red"]) === 4)
// same line shape either way, neutral wording
for (let said = 0; said <= 4; said++) {
  for (let red = 0; red <= 4; red++) {
    const l = handoverLine(said, red)
    check("line " + said + "/" + red + " is neutral and short", l.startsWith("Handover: you said " + said) && l.endsWith(red + " Red in the room") && l.length <= MAX_HANDOVER_CHARS && !/correct|wrong|right|well|good|bad|oops|mistake/i.test(l))
  }
}
// the question text never contains a number
check("question has no digit", !/\d/.test(HANDOVER_LINE_1 + HANDOVER_LINE_2))
check("question wording", HANDOVER_LINE_1 === "The ambulance crew is here." && HANDOVER_LINE_2 === "How many need to go first (Red)?")
check("five choices 0..4", JSON.stringify(HANDOVER_CHOICES) === "[0,1,2,3,4]")

console.log("\n" + pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
