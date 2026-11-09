// Run with: node devpost/tests/groan-pick.test.mjs  (Node 22.18+, strips TS types)
import { pickGroan, groanSequence, GROAN_COUNT } from "../../Assets/Scripts/TriageGroanPick.ts"
let pass = 0, fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}
check("three groans", GROAN_COUNT === 3)
let ok = true, inRange = true, seen = new Set(), det = true, atLeast2 = true
for (let seed = 1; seed <= 500; seed++) {
  const s = groanSequence(seed, 12)
  for (let i = 0; i < s.length; i++) { if (s[i] < 0 || s[i] > 2) inRange = false; seen.add(s[i]); if (i && s[i] === s[i - 1]) ok = false }
  if (JSON.stringify(s) !== JSON.stringify(groanSequence(seed, 12))) det = false
  if (new Set(s.slice(0, 4)).size < 2) atLeast2 = false
}
check("never the same twice in a row (500 seeds x 12)", ok)
check("always 0..2", inRange)
check("all three used", seen.size === 3)
check("same seed gives the same sequence", det)
check("at least 2 different groans in the first 4", atLeast2)
const first = new Array(3).fill(0)
for (let seed = 1; seed <= 3000; seed++) first[pickGroan(seed, 0, -1)]++
check("first groan spread over all three (each > 25%)", first.every((c) => c > 750), first)
check("different seeds give different sequences", new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => groanSequence(s, 6).join(""))).size > 3)
check("a prev of -1 or out of range is treated as none", pickGroan(5, 0, -1) === pickGroan(5, 0, 9))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
