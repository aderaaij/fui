/**
 * Attract mode — the screensaver entry (screensaver.html) plays MU/TH/UR's
 * whole session unattended: boot, walk the matrix to INTERFACE 2037, type a
 * few of the film's inquiries, hold on SPECIAL ORDER 937's last line, then
 * power-cycle and loop. The operator is played through the same synthetic
 * keydown events the touch keyboard sends, so every cadence and rule of the
 * terminal applies unchanged — and the whole screen stays live-rendered,
 * which is what makes the loop resolution- and dpi-agnostic.
 */
import { useEffect, useRef } from 'react'
import { muteForSession } from '@/lib/sound'
import type { BootPhase } from './useMuthurBoot'

let attract = false

/** Flip the exhibit into attract mode — call once, before mounting it. */
export function enableAttract() {
  attract = true
  // Screensavers are silent: mute for the session (the visitor's persisted
  // preference is untouched), which also waves off the POWER ON gate —
  // attract is exactly the muted visitor needsBootGate already powers on.
  muteForSession()
}

// Openers, phrased as terse as Ripley's. Every one answers from the scripted
// table in muthur.ts — attract must never wake the Worker, so hours of
// looping cost nothing and the loop works offline.
const OPENERS = [
  'CREW STATUS',
  'DESTINATION',
  'ORIGIN OF SIGNAL',
  'SCIENCE OFFICER',
  'EMERGENCY COMMAND OVERRIDE 100375',
]
const CLOSER = 'SPECIAL ORDER 937'

const SELECT_SETTLE_MS = 1400
const STEP_MS = 420
const PRE_ENTER_MS = 900
/** Beat after the interface title lands before the first inquiry. */
const FIRST_READ_MS = 1600
/** Dwell on a landed reply before asking the next thing. */
const REPLY_READ_MS = 3200
const KEY_MS = 95
const PRE_SUBMIT_MS = 650
/** CREW EXPENDABLE. holds, then the tube power-cycles into the next loop. */
const FINAL_HOLD_MS = 9000

const jitter = (base: number, j: number) => base + (Math.random() * 2 - 1) * j

/** Two random openers, then always the special order — it's the closer. */
function buildCycle(): string[] {
  const pool = [...OPENERS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return [...pool.slice(0, 2), CLOSER]
}

const press = (key: string) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))

/**
 * Watches the terminal's phase/locked state from inside Terminal and plays
 * the operator. Effects only schedule timers and dispatch key events;
 * progress commits through the terminal's own state changes, so StrictMode's
 * double-invoke and re-renders can't double-type.
 */
export function useAttract(phase: BootPhase, locked: boolean) {
  const cycle = useRef<string[] | null>(null)
  const sent = useRef(0)

  // The matrix waits in 'select' — walk the left column down to INTERFACE
  // 2037 (row 9; selection starts at CRFX) and open it.
  useEffect(() => {
    if (!attract || phase !== 'select') return
    const timers: number[] = []
    let t = SELECT_SETTLE_MS
    for (let i = 0; i < 9; i++) {
      t += jitter(STEP_MS, 130)
      timers.push(window.setTimeout(() => press('ArrowDown'), t))
    }
    timers.push(window.setTimeout(() => press('Enter'), t + PRE_ENTER_MS))
    return () => timers.forEach(clearTimeout)
  }, [phase])

  // Each unlock means the previous statement finished typing: ask the next
  // inquiry, or — cycle spent — hold the last reply and power-cycle.
  useEffect(() => {
    if (!attract || locked || phase !== 'ready') return
    cycle.current ??= buildCycle()
    const inquiry = cycle.current[sent.current]
    const timers: number[] = []
    if (inquiry === undefined) {
      timers.push(window.setTimeout(() => window.location.reload(), FINAL_HOLD_MS))
      return () => timers.forEach(clearTimeout)
    }
    let t = sent.current === 0 ? FIRST_READ_MS : REPLY_READ_MS
    for (const ch of inquiry) {
      t += jitter(KEY_MS, 45)
      timers.push(window.setTimeout(() => press(ch), t))
    }
    timers.push(
      window.setTimeout(() => {
        sent.current += 1
        press('Enter')
      }, t + PRE_SUBMIT_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [phase, locked])
}
