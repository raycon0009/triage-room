// Run with: node devpost/tests/run-compare.test.mjs  (Node 22.18+, strips TS types)
// The debrief's comparison with the run just before: pure wording from TriageRunCompare.ts.
import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"

// the Lens sources import each other without ".ts"; copy to a temp folder with the extension added (sources unchanged)
const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "Assets", "Scripts")
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-rc-"))
for (const n of ["TriageFirstSeen", "TriageRunCompare"]) {
  fs.writeFileSync(path.join(dir, n + ".ts"), fs.readFileSync(path.join(scripts, n + ".ts"), "utf8").replace(/from "(\.\/[A-Za-z]+)"/g, 'from "$1.ts"'))
}
const { compareLines, describeRun, makeRecord, MAX_COMPARE_CHARS } = await import(pathToFileURL(path.join(dir, "TriageRunCompare.ts")).href)

let pass = 0
let fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}

const learn = makeRecord("Learn", 3, 4, 50, 0)
const drill = makeRecord("Drill", 4, 4, 22, 0)

check("first run of a session: no lines", compareLines(null, drill).length === 0)
check("the brief's example, exactly", JSON.stringify(compareLines(learn, drill)) === JSON.stringify(["Last run (Learn): 3 of 4 · all in view 0:50", "This run (Drill): 4 of 4 · all in view 0:22"]), compareLines(learn, drill))
const rev = compareLines(drill, learn)
check("mode labels follow each run, whatever the order", rev[0].startsWith("Last run (Drill)") && rev[1].startsWith("This run (Learn)"), rev)
const same = compareLines(drill, drill)
check("same mode twice: both lines carry it", same[0].includes("(Drill)") && same[1].includes("(Drill)"))
check("correct count is shown as given (not-reached already counted as wrong by the caller)", describeRun("This run", makeRecord("Drill", 1, 4, 30, 0)).includes("1 of 4"))
check("0 of 4 is written", describeRun("This run", makeRecord("Drill", 0, 4, 30, 0)).includes("0 of 4"))
check("one never in view", describeRun("This run", makeRecord("Drill", 2, 4, null, 1)) === "This run (Drill): 2 of 4 · 1 never in view")
check("two never in view", describeRun("Last run", makeRecord("Learn", 2, 4, null, 2)) === "Last run (Learn): 2 of 4 · 2 never in view")
check("never in view replaces the time", !describeRun("Last run", makeRecord("Learn", 2, 4, null, 2)).includes("all in view"))
check("time rounds to the nearest second: 22.4 -> 0:22", describeRun("This run", makeRecord("Drill", 4, 4, 22.4, 0)).endsWith("0:22"))
check("time rounds to the nearest second: 22.5 -> 0:23", describeRun("This run", makeRecord("Drill", 4, 4, 22.5, 0)).endsWith("0:23"))
check("time rounds: 59.6 -> 1:00", describeRun("This run", makeRecord("Drill", 4, 4, 59.6, 0)).endsWith("1:00"))
check("time 0 -> 0:00", describeRun("This run", makeRecord("Drill", 4, 4, 0, 0)).endsWith("0:00"))
// every line fits: all counts, both modes, never-in-view counts, times up to 9:59
let longest = 0
let worst = ""
for (const mode of ["Learn", "Drill"]) for (const label of ["Last run", "This run"]) for (let c = 0; c <= 4; c++) {
  const cases = [[null, 1], [null, 2], [null, 3], [null, 4]]
  for (let t = 0; t < 600; t += 7) cases.push([t, 0])
  cases.push([599.4, 0])
  for (const [t, n] of cases) {
    const line = describeRun(label, makeRecord(mode, c, 4, t, n))
    if (line.length > longest) { longest = line.length; worst = line }
  }
}
check("every line fits " + MAX_COMPARE_CHARS + " characters", longest <= MAX_COMPARE_CHARS, { longest, worst })
const all = compareLines(learn, drill).concat(compareLines(drill, learn), compareLines(makeRecord("Learn", 0, 4, null, 4), drill)).join(" ")
check("neutral wording: no better/worse/stars/score words, never 'looked at'", !/better|worse|star|score|looked at|improv|%/i.test(all) && !/[★☆]/.test(all), all)
console.log("\n" + pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
