// Run with: node devpost/tests/first-seen.test.mjs  (Node 22.18+, strips TS types)
// The first-seen record: when each casualty first came into view, and when the first tag / call-out happened.
import { FirstSeenTracker, clock } from "../../Assets/Scripts/TriageFirstSeen.ts"

let pass = 0
let fail = 0
function check(name, cond, detail) {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail !== undefined ? " -> " + JSON.stringify(detail) : ""))
  cond ? pass++ : fail++
}
const IDS = ["W1", "A", "D", "X"]
const only = (...ids) => Object.fromEntries(ids.map((i) => [i, true]))

// ---- everyone seen
{
  const t = new FirstSeenTracker()
  t.reset(IDS)
  t.sample(1, only("W1", "A"))
  t.sample(20, only("W1", "A", "X"))
  t.sample(48, only("D"))
  t.noteAction(60)
  t.sample(70, only("W1", "A", "D", "X"))
  check("everyone seen: the first time counts, later sightings do not move it", t.firstSeenAt("W1") === 1 && t.firstSeenAt("X") === 20 && t.firstSeenAt("D") === 48)
  check("everyone seen: all-seen time is the last first-sighting", t.allSeenAt() === 48 && t.neverSeenCount() === 0)
  check("everyone seen, tagged later: one line", JSON.stringify(t.lines()) === JSON.stringify(["Everyone in view by 0:48"]), t.lines())
  check("action after everyone was seen is not 'started before'", t.startedBeforeEveryone() === false)
}

// ---- someone never seen
{
  const t = new FirstSeenTracker()
  t.reset(IDS)
  t.sample(1, only("W1", "A", "X"))
  t.sample(30, only("W1"))
  check("one never seen: count 1 and no all-seen time", t.neverSeenCount() === 1 && t.allSeenAt() === null)
  check("one never seen: singular wording", JSON.stringify(t.lines()) === JSON.stringify(["1 person never came into view"]), t.lines())
  const u = new FirstSeenTracker()
  u.reset(IDS)
  u.sample(2, only("W1"))
  check("three never seen: plural wording", JSON.stringify(u.lines()) === JSON.stringify(["3 people never came into view"]), u.lines())
  const n = new FirstSeenTracker()
  n.reset(IDS)
  check("nobody ever in view: all four", JSON.stringify(n.lines()) === JSON.stringify(["4 people never came into view"]), n.lines())
  check("nobody tagged: no 'started before' line", n.startedBeforeEveryone() === false && n.firstActionAt() === null)
  // someone never seen AND a tag happened: both lines
  t.noteAction(40)
  check("never seen and tagged: both lines", JSON.stringify(t.lines()) === JSON.stringify(["1 person never came into view", "You started before seeing everyone"]), t.lines())
}

// ---- tagging before everyone was seen
{
  const t = new FirstSeenTracker()
  t.reset(IDS)
  t.sample(1, only("W1", "A"))
  t.noteAction(15) // first tag at 0:15
  t.noteAction(99) // a later one does not replace it
  t.sample(50, only("D", "X"))
  check("first action is kept", t.firstActionAt() === 15)
  check("tagged before everyone was seen", t.startedBeforeEveryone() === true)
  check("tagged early: both lines", JSON.stringify(t.lines()) === JSON.stringify(["Everyone in view by 0:50", "You started before seeing everyone"]), t.lines())
  // action in the same sample as the last sighting is not "before"
  const e = new FirstSeenTracker()
  e.reset(["A", "B"])
  e.sample(10, only("A", "B"))
  e.noteAction(10)
  check("action at the very moment everyone is in view is not 'before'", e.startedBeforeEveryone() === false)
}

// ---- sampling stops at the end
{
  const t = new FirstSeenTracker()
  t.reset(IDS)
  t.sample(5, only("W1"))
  t.stop()
  t.sample(170, only("A", "D", "X"))
  t.noteAction(171)
  check("after stop: nothing more is recorded", t.firstSeenAt("A") === null && t.firstActionAt() === null && t.neverSeenCount() === 3 && t.isStopped())
}

// ---- reset on restart
{
  const t = new FirstSeenTracker()
  t.reset(IDS)
  t.sample(5, only("W1", "A", "D", "X"))
  t.noteAction(6)
  t.stop()
  t.reset(["A", "B", "C", "D"])
  check("reset: a clean record for the new run", t.neverSeenCount() === 4 && t.firstActionAt() === null && !t.isStopped() && t.firstSeenAt("W1") === null)
  t.sample(3, only("A"))
  check("reset: sampling works again", t.firstSeenAt("A") === 3)
}

check("clock format", clock(0) === "0:00" && clock(48) === "0:48" && clock(161) === "2:41" && clock(47.6) === "0:48")
console.log(pass + " passed, " + fail + " failed")
process.exit(fail ? 1 : 0)
