// Run with: node devpost/tests/start-engine.test.mjs  (Node 22.18+, strips TS types)
import { evaluateStart, checkResultText, findingsFromDef } from "../../Assets/Scripts/TriageStartEngine.ts"
import { CASUALTY_TABLE } from "../../Assets/Scripts/TriageData.ts"

let pass = 0
let fail = 0
function t(name, f, checks, tag, step, extra) {
  const full = { walks: false, breathing: null, afterAirway: null, respRate: null, pulsePresent: null, refillSeconds: null, followsCommands: null, ...f }
  const r = evaluateStart(full, checks)
  const ok = r.decided && r.tag === tag && r.decidingStep === step && r.extraChecks === extra
  console.log((ok ? "PASS " : "FAIL ") + name + " -> " + JSON.stringify(r))
  ok ? pass++ : fail++
}
const B = "breathing", A = "airway", R = "rate", P = "pulse", C = "commands"

t("1 walks=yes", { walks: true }, [], "Green", 0, 0)
t("2 walks=yes, visible bad injury", { walks: true, visibleBadInjury: true }, [], "Green", 0, 0)
t("3 not breathing, no after airway", { breathing: false, afterAirway: false }, [B, A], "Black", 2, 0)
t("4 not breathing, breathes after airway", { breathing: false, afterAirway: true }, [B, A], "Red", 2, 0)
t("5 RR=34", { breathing: true, respRate: 34 }, [B, R], "Red", 3, 0)
t("6 RR=32", { breathing: true, respRate: 32 }, [B, R], "Red", 3, 0)
t("7 RR=28 pulse present refill 1 commands yes", { breathing: true, respRate: 28, pulsePresent: true, refillSeconds: 1, followsCommands: true }, [B, R, P, C], "Yellow", 5, 0)
t("8 RR=22 pulse absent", { breathing: true, respRate: 22, pulsePresent: false }, [B, R, P], "Red", 4, 0)
t("9 RR=22 pulse present refill 3", { breathing: true, respRate: 22, pulsePresent: true, refillSeconds: 3 }, [B, R, P], "Red", 4, 0)
t("10 RR=18 pulse ok commands no", { breathing: true, respRate: 18, pulsePresent: true, refillSeconds: 1, followsCommands: false }, [B, R, P, C], "Red", 5, 0)
t("11 RR=16 pulse ok commands yes", { breathing: true, respRate: 16, pulsePresent: true, refillSeconds: 1, followsCommands: true }, [B, R, P, C], "Yellow", 5, 0)
t("12 pulse checked after RR=34", { breathing: true, respRate: 34, pulsePresent: true, refillSeconds: 1 }, [B, R, P], "Red", 3, 1)

// Extras: undecided before the deciding check, order-independence, and the whole casualty pool.
let ok = true
const und = evaluateStart({ walks: false, breathing: true, afterAirway: null, respRate: 34, pulsePresent: null, refillSeconds: null, followsCommands: null }, [B])
ok = ok && !und.decided && und.tag === null
console.log((und.decided ? "FAIL" : "PASS") + " extra: rate not checked yet -> undecided")
const walkerExtra = evaluateStart({ walks: true, breathing: null, afterAirway: null, respRate: null, pulsePresent: null, refillSeconds: null, followsCommands: null }, [B, R])
console.log((walkerExtra.extraChecks === 2 ? "PASS" : "FAIL") + " extra: walker + 2 checks -> extraChecks 2")
if (walkerExtra.extraChecks !== 2) ok = false

const CHECKS_FOR = { 0: [], 2: [B, A], 3: [B, R], 4: [B, R, P], 5: [B, R, P, C] }
for (const id of Object.keys(CASUALTY_TABLE)) {
  const d = CASUALTY_TABLE[id]
  const r = evaluateStart(findingsFromDef(d), CHECKS_FOR[d.decidingStep])
  const good = r.decided && r.tag === d.correctTag && r.decidingStep === d.decidingStep && r.extraChecks === 0
  console.log((good ? "PASS " : "FAIL ") + "pool " + id + " -> " + JSON.stringify(r))
  if (!good) ok = false
}
// No scripted value may be exactly 30/min or exactly 2 s.
for (const d of Object.values(CASUALTY_TABLE)) {
  if (d.respRate === 30 || d.refillSeconds === 2) { ok = false; console.log("FAIL exact 30/2 in " + d.id) }
}
console.log("sample text:", checkResultText(findingsFromDef(CASUALTY_TABLE.D), "pulse"), "|", checkResultText(findingsFromDef(CASUALTY_TABLE.A), "pulse"))

console.log(`\n12 brief cases: ${pass} passed, ${fail} failed; extras ${ok ? "ok" : "FAILED"}`)
process.exit(fail === 0 && ok ? 0 : 1)
