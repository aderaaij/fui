/**
 * Archive-wide mute preference. The chrome owns the SOUND toggle (like
 * NOTES), exhibits with audio subscribe and route their output through a
 * master gain honoring it. Persisted so a muted archive stays muted.
 */
const KEY = 'fui-audio-muted'

let muted = false
try {
  muted = localStorage.getItem(KEY) === '1'
} catch {
  /* storage denied — session-only preference */
}

const listeners = new Set<(muted: boolean) => void>()

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    /* storage denied — session-only preference */
  }
  listeners.forEach((l) => l(next))
}

/** Session-only mute — the screensaver entry silences the archive without
 *  touching the visitor's persisted preference. */
export function muteForSession() {
  muted = true
  listeners.forEach((l) => l(true))
}

export function onMutedChange(listener: (muted: boolean) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
