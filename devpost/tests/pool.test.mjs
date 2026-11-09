// Run with: node devpost/tests/pool.test.mjs  (Node 22.18+, strips TS types)
// The bigger casualty pool (G, H, J, W3): each new case gives its tag and deciding step, the selection rules still hold over
// many seeds, and the demo seed 77 keeps its documented layout, cases and poses.
import { loadModules } from "./load-layout.mjs"

const { TriageData: Data, TriageLayout: Layout, TriageStartEngine: Engine, TriageScoring: Scoring } = await loadModules()
const { CASUALTY_TABLE, POSE_CHOICES, POSE_INFO } = Data

let pass = 0
let fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}

const ORDER = ["breathing", "rate", "pulse", "commands"]
const decideWith = (id, checks) => Engine.evaluateStart(Engine.findingsFromDef(CASUALTY_TABLE[id]), checks)

// ---- the four new cases: the right tag at the right step with 0 extra checks
const EXPECT = { G: ["Red", 4], H: ["Yellow", 5], J: ["Red", 3], W3: ["Green", 0] }
for (const id of Object.keys(EXPECT)) {
  const d = CASUALTY_TABLE[id]
  // tag as soon as the deciding step is reached: the checks in START order up to and including that step
  const checks = ORDER.filter((c) => Engine.CHECK_STEP[c] <= EXPECT[id][1])
  const early = checks.slice(0, -1)
  const res = decideWith(id, checks)
  check(id + ": " + EXPECT[id][0] + " at step " + EXPECT[id][1] + " with 0 extra checks", res.decided && res.tag === EXPECT[id][0] && res.decidingStep === EXPECT[id][1] && res.extraChecks === 0 && d.correctTag === EXPECT[id][0] && d.decidingStep === EXPECT[id][1], res)
  if (id !== "W3") check(id + ": not decided one check before its deciding step", !decideWith(id, early).decided)
}
check("W3 walks and is decided without any check", decideWith("W3", []).decided && decideWith("W3", []).tag === "Green")

// ---- G: refill 3 s is the first case decided by capillary refill, and tagging after an extra check costs 1
const G = CASUALTY_TABLE.G
check("G findings: not walking, breathing, rate 20, pulse present, refill 3 s", !G.walks && G.breathing === true && G.respRate === 20 && G.radialPulse === "present" && G.refillSeconds === 3)
check("G: the pulse / refill button shows the refill", Engine.checkResultText(Engine.findingsFromDef(G), "pulse") === "Pulse present, refill 3 s", Engine.checkResultText(Engine.findingsFromDef(G), "pulse"))
check("G: tags are not offered after breathing and rate alone", !decideWith("G", ["breathing", "rate"]).decided)
const gExtra = decideWith("G", ["breathing", "rate", "pulse", "commands"])
check("G tagged after one extra check (commands): Red, step 4, extraChecks 1", gExtra.tag === "Red" && gExtra.decidingStep === 4 && gExtra.extraChecks === 1, gExtra)
check("G: no commands result is needed (never scripted)", Engine.checkResultText(Engine.findingsFromDef(G), "commands") === "—")
const noOne = [CASUALTY_TABLE.A, CASUALTY_TABLE.B, CASUALTY_TABLE.C, CASUALTY_TABLE.D, CASUALTY_TABLE.E, CASUALTY_TABLE.G, CASUALTY_TABLE.H, CASUALTY_TABLE.J]
check("no scripted rate is exactly 30 and no refill exactly 2 s", Object.values(CASUALTY_TABLE).every((d) => d.respRate !== 30 && d.refillSeconds !== 2))
check("J: rate 32 decides before the pulse", CASUALTY_TABLE.J.respRate === 32 && decideWith("J", ["breathing", "rate"]).tag === "Red")
check("H: rate 24, refill 1 s, obeys -> Yellow", CASUALTY_TABLE.H.respRate === 24 && CASUALTY_TABLE.H.refillSeconds === 1 && CASUALTY_TABLE.H.followsCommands === true)

// ---- debrief explanations name the real deciding condition and stay short
const entry = (id, tag) => Scoring.buildEntry({ def: CASUALTY_TABLE[id], tag, openSeconds: 5, extraChecks: 0, calledOut: false, calledOutAtSeconds: null })
check("G explanation names the refill", entry("G", "Yellow").explanation === "Refill 3 s is over 2 s → Red", entry("G", "Yellow").explanation)
check("G missed shows the same line", entry("G", null).explanation === "Refill 3 s is over 2 s → Red")
check("J explanation names the rate", entry("J", "Yellow").explanation === "Rate 32 is over 30 → Red", entry("J", "Yellow").explanation)
check("H explanation names the commands", entry("H", "Red").explanation === "Rate under 30, pulse OK, obeys → Yellow", entry("H", "Red").explanation)
check("W3 explanation says walkers are reassessed", entry("W3", null).explanation === "Can walk → Green (reassessed later)")
check("the existing pulse-absent case (B) keeps its line", Scoring.ruleLine(CASUALTY_TABLE.B) === "Radial pulse absent → Red")
check("every new explanation is at most as long as the longest existing short one (40)", ["G", "H", "J", "W3"].every((id) => entry(id, null).explanation.length <= 40))
check("debrief short names exist for the new cases", ["G", "H", "J", "W3"].every((id) => !!Scoring.SHORT_NAME[id]))

// ---- poses: 3 from the existing set, following the pose rules
const KNOWN = Object.keys(POSE_INFO)
for (const id of ["G", "H", "J"]) {
  const p = POSE_CHOICES[id]
  check(id + ": 3 existing poses, first is the default", p.length === 3 && p.every((k) => KNOWN.includes(k)) && CASUALTY_TABLE[id].pose === p[0] && CASUALTY_TABLE[id].poseLabel === POSE_INFO[p[0]].label, p)
  check(id + ": no pose is exclusive to its tag (each is also offered to a case with a different tag)", p.every((k) => Object.keys(POSE_CHOICES).some((o) => o !== id && CASUALTY_TABLE[o].correctTag !== CASUALTY_TABLE[id].correctTag && POSE_CHOICES[o].includes(k))))
}
const w3 = POSE_CHOICES.W3
check("W3: 3 seated poses, all existing, first is the default", w3.length === 3 && w3.every((k) => KNOWN.includes(k) && POSE_INFO[k].group === "sitting") && CASUALTY_TABLE.W3.pose === w3[0], w3)
check("W3 offers a serious-looking pose (dazed or leaning back)", w3.includes("sitting_dazed") && w3.includes("sitting_leaning_back"))
check("the pose set itself did not grow (12 poses)", KNOWN.length === 12)

// ---- selection over many seeds
const SEEDS = 3000
const seen = {}
let bad = []
let xRuns = 0
let seenBehind = {}
let walkers = {}
const ALLOWED_BEHIND = ["A", "B", "C", "D", "E", "G", "H", "J"]
for (let seed = 1; seed <= SEEDS; seed++) {
  for (const fb of ["auto", "on", "off"]) {
    const r = Layout.generateRun(seed, fb)
    const ids = r.casualties.map((c) => c.id)
    const nWalk = ids.filter((id) => CASUALTY_TABLE[id].walks).length
    const behind = r.casualties.filter((c) => c.behind)
    if (r.casualties.length !== 4 || nWalk !== 1 || behind.length !== 1 || !ALLOWED_BEHIND.includes(behind[0].id)) bad.push(seed + fb)
    if (Layout.validateRun(r).length) bad.push(seed + fb + " " + Layout.validateRun(r).join(";"))
    if (fb === "auto") {
      for (const id of ids) seen[id] = (seen[id] || 0) + 1
      seenBehind[behind[0].id] = (seenBehind[behind[0].id] || 0) + 1
      walkers[r.walkerId] = (walkers[r.walkerId] || 0) + 1
      if (ids.includes("X")) xRuns++
    }
    if (fb === "on" && !ids.includes("X")) bad.push(seed + " X forced on but missing")
    if (fb === "off" && ids.includes("X")) bad.push(seed + " X forced off but present")
  }
}
check("3000 seeds x 3 modes: exactly 4 casualties, exactly 1 walker, 1 behind, every rule holds (validateRun)", bad.length === 0, bad.slice(0, 5))
check("every case in the pool appears", Object.keys(CASUALTY_TABLE).every((id) => seen[id] > 0), seen)
check("the walker is W1, W2 or W3, each about a third of runs", ["W1", "W2", "W3"].every((id) => walkers[id] / SEEDS > 0.28 && walkers[id] / SEEDS < 0.39), walkers)
check("the person behind is always one of A-E, G, H, J, and every one of them shows up behind", ALLOWED_BEHIND.every((id) => seenBehind[id] > 0) && Object.keys(seenBehind).every((id) => ALLOWED_BEHIND.includes(id)), seenBehind)
check("never F, X or a walker behind", !["F", "X", "W1", "W2", "W3"].some((id) => seenBehind[id]))
check("X still appears in about 1 run in 3", xRuns / SEEDS > 0.3 && xRuns / SEEDS < 0.37, xRuns / SEEDS)

// ---- poses over many seeds follow the rules
let poseBad = []
for (let seed = 1; seed <= 1000; seed++) {
  for (const c of Layout.generateRun(seed, "auto").casualties) {
    if (!POSE_CHOICES[c.id].includes(c.pose)) poseBad.push(seed + c.id)
    if (CASUALTY_TABLE[c.id].walks && POSE_INFO[c.pose].group !== "sitting") poseBad.push(seed + c.id + " walker not seated")
    if (c.slot === "wall" && POSE_INFO[c.pose].group === "lying") poseBad.push(seed + c.id + " lying at the wall")
  }
}
check("1000 seeds: every pose is from the case's own 3, walkers sit, nobody lies at the wall", poseBad.length === 0, poseBad.slice(0, 5))

// ---- the demo seed 77 is exactly as documented (Black on), and unchanged in the other modes
const near = (a, x, z) => Math.abs(a.x - x) < 1 && Math.abs(a.z - z) < 1
{
  const r = Layout.generateRun(Layout.DEMO_SEED, "on")
  const by = {}
  for (const c of r.casualties) by[c.id] = c
  check("demo seed 77 (Black on): D behind (46, 213), C at the wall, X front-left, W1 front-right", r.casualties.map((c) => c.id + ":" + c.slot).join(",") === "D:behind,C:wall,X:frontLeft,W1:frontRight" && near(by.D, 46, 213.5) && near(by.C, -3.2, -380) && near(by.X, -95.4, -237.6) && near(by.W1, 95.6, -248.7), r.casualties.map((c) => c.id + ":" + c.slot + ":" + c.pose).join(","))
  check("demo seed 77 (Black on): poses are the documented defaults", by.D.pose === "lying_groaning" && by.C.pose === "slumped_against_wall" && by.X.pose === "lying_face_up_still" && by.W1.pose === "sitting_arm_cut")
  check("demo seed 77 repeats exactly", JSON.stringify(Layout.generateRun(77, "on")) === JSON.stringify(r))
}
for (const fb of ["auto", "off"]) {
  // before the bigger pool, seed 77 without the forced Black gave D, C, W1, A in the same slots
  const r = Layout.generateRun(Layout.DEMO_SEED, fb)
  check("demo seed 77 (" + fb + "): the same cast as before the bigger pool (D behind, C wall, W1, A)", r.casualties.map((c) => c.id + ":" + c.slot).join(",") === "D:behind,C:wall,W1:frontLeft,A:frontRight" && near(r.casualties[0], 34.1, 191.7), r.casualties.map((c) => c.id + ":" + c.slot).join(","))
}

console.log("\n" + pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
