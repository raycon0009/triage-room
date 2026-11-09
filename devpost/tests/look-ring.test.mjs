// Run with: node devpost/tests/look-ring.test.mjs  (Node 22.18+, strips TS types)
// The look-around ring: which of 12 segments (30 degrees each) were in view before the first tag or call-out.
import { LookRingTracker, yawDegOf, angleGap, RING_SEGMENTS, RING_LABEL } from "../../Assets/Scripts/TriageLookRing.ts"

let pass = 0
let fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}
const lit = (t) => t.litFlags().map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
const HALF = 33 // a typical half horizontal field of view (degrees)

check("12 segments", RING_SEGMENTS === 12)
check("label wording", RING_LABEL === "Lit: in view before you started" && !/looked/i.test(RING_LABEL))
check("yaw: ahead is 0, right is +90, behind is 180, left is -90", yawDegOf(0, -1) === 0 && Math.round(yawDegOf(1, 0)) === 90 && Math.round(Math.abs(yawDegOf(0, 1))) === 180 && Math.round(yawDegOf(-1, 0)) === -90)
check("angleGap wraps round 0/360", angleGap(350, 10) === 20 && angleGap(10, 350) === 20 && angleGap(0, 180) === 180 && angleGap(-170, 170) === 20)

// looking only ahead: only the front segments (0, 1, 11 at a 33 degree half view)
{
  const t = new LookRingTracker()
  t.sample(0, HALF)
  t.sample(5, HALF)
  t.sample(-5, HALF)
  check("looking only ahead lights only the front segments", JSON.stringify(lit(t)) === "[0,1,11]", lit(t))
  check("the back half is unlit", [4, 5, 6, 7, 8].every((k) => !t.isLit(k)))
  const narrow = new LookRingTracker()
  narrow.sample(0, 20)
  check("a narrower view lights fewer: segment 0 only at a 20 degree half view", JSON.stringify(lit(narrow)) === "[0]", lit(narrow))
}

// a full turn lights all 12
{
  const t = new LookRingTracker()
  for (let yaw = 0; yaw < 360; yaw += 5) t.sample(yaw, HALF)
  check("a full turn lights all 12", t.litCount() === 12, lit(t))
  const u = new LookRingTracker()
  for (let yaw = 0; yaw >= -360; yaw -= 5) u.sample(yaw, HALF)
  check("a full turn the other way lights all 12", u.litCount() === 12)
  const half = new LookRingTracker()
  for (let yaw = 0; yaw <= 180; yaw += 5) half.sample(yaw, HALF)
  check("turning right from ahead to behind lights the right side, the back and the front-left edge (0-7, 11)", JSON.stringify(lit(half)) === "[0,1,2,3,4,5,6,7,11]", lit(half))
}

// wrap-around at 0/360
{
  const t = new LookRingTracker()
  t.sample(355, 20) // 355 reaches segment 0 (5 away) and 11 (25 away > 20: no)
  check("yaw 355 with a 20 degree half view lights segment 0, not 11", JSON.stringify(lit(t)) === "[0]", lit(t))
  const u = new LookRingTracker()
  u.sample(359, 40)
  check("yaw 359 / half 40 lights 11, 0 and 1 across the wrap", JSON.stringify(lit(u)) === "[0,1,11]", lit(u))
  const v = new LookRingTracker()
  v.sample(-725, 20) // same as -5
  check("angles beyond a full circle wrap", JSON.stringify(lit(v)) === "[0]", lit(v))
  check("segmentOf wraps (359 -> 0, 346 -> 0, 344 -> 11, 15 -> 1, -15 -> 11)", LookRingTracker.segmentOf(359) === 0 && LookRingTracker.segmentOf(344) === 11 && LookRingTracker.segmentOf(16) === 1 && LookRingTracker.segmentOf(-16) === 11)
}

// sampling stops at the first tag or call-out
{
  const t = new LookRingTracker()
  t.sample(0, HALF)
  t.noteAction()
  t.sample(180, HALF)
  t.sample(90, HALF)
  check("sampling stops at the first tag or call-out", JSON.stringify(lit(t)) === "[0,1,11]" && t.isStopped(), lit(t))
}
// stops when the run ends
{
  const t = new LookRingTracker()
  t.sample(0, 10)
  t.stop()
  t.sample(180, 10)
  check("sampling stops when the run ends", JSON.stringify(lit(t)) === "[0]")
}
// no action: the whole run counts
{
  const t = new LookRingTracker()
  for (let i = 0; i < 100; i++) t.sample((i * 37) % 360, 20)
  check("no action: every sample over the whole run counts", t.litCount() === 12 && !t.isStopped(), lit(t))
}
// reset clears it
{
  const t = new LookRingTracker()
  t.sample(0, HALF)
  t.noteAction()
  t.reset()
  check("reset clears the ring and starts sampling again", t.litCount() === 0 && !t.isStopped())
  t.sample(180, 10)
  check("after reset, new samples count", JSON.stringify(lit(t)) === "[6]", lit(t))
}

console.log(pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
