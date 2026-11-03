/**
 * TriageUi.ts - shared look and calm motion for every board (start screen, check card, tag row, Time's up, call-out,
 * debrief, Restart).
 *
 * LOOK (one style everywhere)
 *  - One font (the Lens Studio default) at three sizes: title, body, small. Sizes are written for the card's distance
 *    (70 cm); `sizesAt(distanceCm)` scales them so every board keeps the same angular size, i.e. the small size stays
 *    as readable at the debrief's 1.2 m as it is on the card.
 *  - Every board is a UI Kit BackPlate (the one backplate style and corner radius) with padding PAD and gap GAP.
 *  - Light on dark: every text is light (small text is a light blue-grey, never dark).
 *
 * MOTION (calm, short; nothing here is a new feature)
 *  - press pop on buttons (under 0.15 s), fade + scale in/out of panels (under 0.3 s), plus `tween` for anything else.
 *  - Test hooks: `finishMotion()` jumps every running tween to its end; `motionBusy()` counts running tweens.
 * Pure helpers (ease, sizesAt, lerp) have no Lens API in them, but the file uses the Lens API for the tween driver, so it
 * is not unit-tested in Node.
 */
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

// ------------------------------------------------------------------ look

export { FONT_AT_CARD, CARD_DISTANCE_CM, sizesAt } from "./TriageUiSizes"
export type { UiSizes } from "./TriageUiSizes"
import { sizesAt as sizesAtLocal } from "./TriageUiSizes"

/** The debrief's three sizes: the shared sizes at 1.2 m, enlarged by one common factor (the panel read last and longest). */
export const DEBRIEF_BOOST = 1.4
export const DEBRIEF_SIZES = sizesAtLocal(120, DEBRIEF_BOOST)

/** Board padding and gap in cm (at the card's distance; larger boards scale it with `k`). */
export const PAD = 1.2
export const GAP = 0.6

export const TEXT_WHITE = new vec4(1, 1, 1, 1)
/** The small, quieter text: a light blue-grey (still light on dark). */
export const TEXT_SMALL = new vec4(0.8, 0.87, 0.96, 1)

// ------------------------------------------------------------------ pure helpers

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
export function easeOutCubic(k: number): number {
  const a = 1 - clamp01(k)
  return 1 - a * a * a
}
export function easeInCubic(k: number): number {
  const a = clamp01(k)
  return a * a * a
}
export function easeInOutCubic(k: number): number {
  const a = clamp01(k)
  return a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2
}
/** Ease-out that overshoots a little (for the press pop). */
export function easeOutBack(k: number): number {
  const a = clamp01(k) - 1
  const c = 1.7
  return 1 + (c + 1) * a * a * a + c * a * a
}
export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k
}

// ------------------------------------------------------------------ tween driver

interface Tween {
  key: string
  owner: SceneObject | null
  delay: number
  t: number
  dur: number
  step: (k: number) => void
  done: (() => void) | null
}

const tweens: Tween[] = []
let driver: ScriptComponent | null = null

function ensureDriver(): void {
  if (driver && !isNull(driver)) return
  const so = global.scene.createSceneObject("UiMotionDriver")
  driver = so.createComponent("Component.ScriptComponent") as ScriptComponent
  driver.createEvent("UpdateEvent").bind(() => {
    const dt = getDeltaTime()
    for (const tw of tweens.slice()) advance(tw, dt)
  })
}

function advance(tw: Tween, dt: number): void {
  if (tweens.indexOf(tw) < 0) return
  if (tw.owner && isNull(tw.owner)) {
    remove(tw)
    return
  }
  if (tw.delay > 0) {
    tw.delay -= dt
    if (tw.delay > 0) return
    dt = -tw.delay
    tw.delay = 0
  }
  tw.t += dt
  const k = tw.dur <= 0 ? 1 : clamp01(tw.t / tw.dur)
  tw.step(k)
  if (k >= 1) {
    remove(tw)
    if (tw.done) tw.done()
  }
}

function remove(tw: Tween): void {
  const i = tweens.indexOf(tw)
  if (i >= 0) tweens.splice(i, 1)
}

/**
 * Run `step(k)` for k from 0 to 1 over `dur` seconds (after `delay`). A new tween with the same `key` replaces the old
 * one (the old one's `done` is NOT called). `owner` stops the tween quietly if that object is destroyed.
 */
export function tween(key: string, dur: number, step: (k: number) => void, done: (() => void) | null = null, delay: number = 0, owner: SceneObject | null = null): void {
  ensureDriver()
  for (const o of tweens.slice()) if (o.key === key) remove(o)
  tweens.push({ key: key, owner: owner, delay: delay, t: 0, dur: dur, step: step, done: done })
}

export function cancelTween(key: string): void {
  for (const o of tweens.slice()) if (o.key === key) remove(o)
}

export function motionBusy(): number {
  return tweens.length
}

/** Test hook: jump every running tween to its end (delays skipped) so positions and sizes can be measured. */
export function finishMotion(): void {
  for (let guard = 0; guard < 20 && tweens.length > 0; guard++) {
    for (const tw of tweens.slice()) {
      if (tweens.indexOf(tw) < 0) continue
      if (tw.owner && isNull(tw.owner)) {
        remove(tw)
        continue
      }
      tw.delay = 0
      tw.step(1)
      remove(tw)
      if (tw.done) tw.done()
    }
  }
}

// ------------------------------------------------------------------ fade + scale of a whole panel

interface Fade {
  texts: Text[]
  plates: RoundedRectangle[]
  buttons: Button[]
}

function collect(so: SceneObject, out: Fade): void {
  if (!so || isNull(so)) return
  const t = so.getComponent("Component.Text") as Text
  if (t) out.texts.push(t)
  const rr = so.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  if (rr) out.plates.push(rr)
  const b = so.getComponent(Button.getTypeName()) as Button
  if (b) out.buttons.push(b)
  for (let i = 0; i < so.getChildrenCount(); i++) collect(so.getChild(i), out)
}

/** Set the see-through level of everything on a panel (texts keep their colour, only the alpha changes). */
export function setPanelAlpha(root: SceneObject, a: number): void {
  const f: Fade = { texts: [], plates: [], buttons: [] }
  collect(root, f)
  applyAlpha(f, a)
}

function applyAlpha(f: Fade, a: number): void {
  for (const t of f.texts) {
    if (isNull(t)) continue
    const c = t.textFill.color
    t.textFill.color = new vec4(c.r, c.g, c.b, a)
  }
  for (const p of f.plates) if (!isNull(p)) p.opacity = a
  for (const b of f.buttons) if (!isNull(b)) b.opacity = a
}

const baseScale: { [id: string]: vec3 } = {}

function baseOf(o: SceneObject): vec3 {
  const id = o.uniqueIdentifier
  if (!baseScale[id]) baseScale[id] = o.getTransform().getLocalScale()
  return baseScale[id]
}

function setScaleK(o: SceneObject, k: number): void {
  const b = baseOf(o)
  o.getTransform().setLocalScale(new vec3(b.x * k, b.y * k, b.z * k))
}

export const PANEL_IN_SECONDS = 0.24
export const PANEL_OUT_SECONDS = 0.18
const PANEL_FROM = 0.9

/** Enable a panel and fade + scale it in (0.24 s). Cancels a hide in progress. */
export function showPanel(o: SceneObject, delay: number = 0): void {
  if (!o || isNull(o)) return
  const key = "panel:" + o.uniqueIdentifier
  cancelTween(key)
  baseOf(o)
  o.enabled = true
  const f: Fade = { texts: [], plates: [], buttons: [] }
  collect(o, f)
  setScaleK(o, PANEL_FROM)
  applyAlpha(f, 0)
  tween(
    key,
    PANEL_IN_SECONDS,
    (k) => {
      const e = easeOutCubic(k)
      setScaleK(o, lerp(PANEL_FROM, 1, e))
      applyAlpha(f, e)
    },
    () => {
      setScaleK(o, 1)
      applyAlpha(f, 1)
    },
    delay,
    o,
  )
}

/** Fade + scale a panel out (0.18 s), then disable it and put its scale and alpha back. Cancels a show in progress. */
export function hidePanel(o: SceneObject, then: (() => void) | null = null): void {
  if (!o || isNull(o)) return
  const key = "panel:" + o.uniqueIdentifier
  if (!o.enabled) {
    cancelTween(key)
    if (then) then()
    return
  }
  cancelTween(key)
  baseOf(o)
  const f: Fade = { texts: [], plates: [], buttons: [] }
  collect(o, f)
  tween(
    key,
    PANEL_OUT_SECONDS,
    (k) => {
      const e = easeInCubic(k)
      setScaleK(o, lerp(1, PANEL_FROM, e))
      applyAlpha(f, 1 - e)
    },
    () => {
      o.enabled = false
      setScaleK(o, 1)
      applyAlpha(f, 1)
      if (then) then()
    },
    0,
    o,
  )
}

/** Disable at once (no animation), with scale and alpha restored. */
export function hidePanelNow(o: SceneObject): void {
  if (!o || isNull(o)) return
  cancelTween("panel:" + o.uniqueIdentifier)
  o.enabled = false
  if (baseScale[o.uniqueIdentifier]) setScaleK(o, 1)
  setPanelAlpha(o, 1)
}

// ------------------------------------------------------------------ buttons

export const POP_DOWN_SECONDS = 0.05
export const POP_UP_SECONDS = 0.09
const POP_SCALE = 0.93

/**
 * Hover highlight comes from the UI Kit button itself (it lights up when the hand or cursor is over it). This adds the
 * quick press "pop": 0.05 s down to 93 percent, then 0.09 s back with a tiny overshoot (0.14 s in all).
 */
export function addPressPop(btn: Button, target: SceneObject): void {
  const key = "pop:" + target.uniqueIdentifier
  const base = target.getTransform().getLocalScale()
  const at = (k: number): void => target.getTransform().setLocalScale(new vec3(base.x * k, base.y * k, base.z))
  btn.onTriggerDown.add(() => {
    tween(key, POP_DOWN_SECONDS, (k) => at(lerp(1, POP_SCALE, easeOutCubic(k))), null, 0, target)
  })
  btn.onTriggerUp.add(() => {
    tween(key, POP_UP_SECONDS, (k) => at(lerp(POP_SCALE, 1, easeOutBack(k))), () => at(1), 0, target)
  })
}

/** The one backplate style for every board. */
export function styleBackPlate(back: BackPlate): void {
  back.style = "default"
}
