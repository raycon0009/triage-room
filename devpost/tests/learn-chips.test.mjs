// Run with: node devpost/tests/learn-chips.test.mjs  (Node 22.18+). Learn-mode START step chips (pure).
// Codes: D = done (passed), C = current step, T:<Tag> = this step decided the tag, - = not reached (dim).
import { learnChips } from "../../Assets/Scripts/TriageStartEngine.ts"

const F = (o) => ({ walks: false, breathing: true, afterAirway: null, respRate: null, pulsePresent: null, refillSeconds: null, followsCommands: null, ...o })
let pass = 0, fail = 0
const code = (c) => (c.state === "done" ? "D" : c.state === "current" ? "C" : c.state === "decided" ? "T:" + c.tag : "-")
const check = (name, chips, want, labels) => {
  const got = chips.map(code).join(" ")
  const ok = got === want && (!labels || chips.map((c) => c.label).join(",") === labels)
  console.log((ok ? "PASS " : "FAIL ") + name + "  " + got + (ok ? "" : "  (wanted " + want + (labels ? " / " + labels : "") + ")"))
  ok ? pass++ : fail++
}
const W = F({ walks: true, breathing: null })
const A = F({ respRate: 34 })
const B = F({ respRate: 22, pulsePresent: false })
const C = F({ respRate: 18, pulsePresent: true, refillSeconds: 1, followsCommands: false })
const D = F({ respRate: 16, pulsePresent: true, refillSeconds: 1, followsCommands: true })
const X = F({ breathing: false, afterAirway: false })
const FF = F({ breathing: false, afterAirway: true })

check("walker: Walks? decides Green, the rest stay dim", learnChips(W, []), "T:Green - - - -")
check("non-walker, nothing checked: Breath? is current", learnChips(D, []), "D C - - -")
check("D after breathing: Rate current", learnChips(D, ["breathing"]), "D D C - -")
check("D after rate: Pulse current", learnChips(D, ["breathing", "rate"]), "D D D C -")
check("D after pulse: Obeys? current", learnChips(D, ["breathing", "rate", "pulse"]), "D D D D C")
check("D after commands: Obeys? decides Yellow", learnChips(D, ["breathing", "rate", "pulse", "commands"]), "D D D D T:Yellow")
check("C commands = no: Obeys? decides Red", learnChips(C, ["breathing", "rate", "pulse", "commands"]), "D D D D T:Red")
check("A rate 34: Rate decides Red, Pulse and Obeys? dim", learnChips(A, ["breathing", "rate"]), "D D T:Red - -")
check("A extra pulse check does not change the chips", learnChips(A, ["breathing", "rate", "pulse"]), "D D T:Red - -")
check("B pulse absent: Pulse decides Red", learnChips(B, ["breathing", "rate", "pulse"]), "D D D T:Red -")
check("X not breathing: Airway is current", learnChips(X, ["breathing"]), "D C - - -", "Walks?,Airway,Rate,Pulse,Obeys?")
check("X after airway: Breath step decides Expectant", learnChips(X, ["breathing", "airway"]), "D T:Black - - -")
check("F after airway: Breath step decides Red", learnChips(FF, ["breathing", "airway"]), "D T:Red - - -")
check("out of order (pulse first) does not skip ahead", learnChips(D, ["pulse"]), "D C - - -")
check("labels are short", learnChips(D, []), "D C - - -", "Walks?,Breath?,Rate,Pulse,Obeys?")
console.log(pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
