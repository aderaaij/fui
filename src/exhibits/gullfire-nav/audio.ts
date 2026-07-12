import { isMuted, onMutedChange } from '@/lib/sound'
import bedUrl from './sfx/approach-bed.wav'

/**
 * The approach bed: 8.8s of the film's own glide — the score's drone and
 * the wind under the nose view — cut from the reference window
 * (scripts/grab-audio.sh, 0:07–0:18 of the clip) and crossfaded into a
 * seamless loop. Equal-power fade, not linear: the married ends are
 * uncorrelated noise, and a linear fade dips 3dB across the seam. WAV,
 * not m4a — AAC priming samples click at the loop point.
 */
const BED_GAIN = 0.3

let ctx: AudioContext | null = null
let bed: AudioBufferSourceNode | null = null
let load: Promise<AudioBuffer> | null = null
let unsubMute: (() => void) | null = null
let unlock: (() => void) | null = null

export function initGullfireAudio() {
  if (ctx) return
  const c = new AudioContext()
  ctx = c
  load = fetch(bedUrl)
    .then((r) => r.arrayBuffer())
    .then((data) => c.decodeAudioData(data))
  // One master gain honoring the archive-wide SOUND toggle; the graph
  // keeps running while muted so unmuting is instant
  const m = c.createGain()
  m.gain.value = isMuted() ? 0 : 1
  m.connect(c.destination)
  unsubMute = onMutedChange((muted) => {
    m.gain.setTargetAtTime(muted ? 0 : 1, c.currentTime, 0.03)
  })
  // The autoplay gate lifts only for a resume() issued during a gesture
  unlock = () => void c.resume()
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  // The bed starts the moment the context is allowed to run — immediately
  // when the visitor arrived via a click (sticky activation), otherwise on
  // the first gesture. A short attack ramp: the loop's first sample is
  // mid-noise, and a hard start ticks.
  const startBed = () => {
    if (c !== ctx || c.state !== 'running' || bed) return
    load
      ?.then((buffer) => {
        if (c !== ctx || c.state !== 'running' || bed) return
        bed = c.createBufferSource()
        bed.buffer = buffer
        bed.loop = true
        const g = c.createGain()
        g.gain.setValueAtTime(0, c.currentTime)
        g.gain.linearRampToValueAtTime(BED_GAIN, c.currentTime + 0.4)
        bed.connect(g)
        g.connect(m)
        bed.start()
      })
      .catch(() => {}) // an unplayable bed is a quieter exhibit, not a crash
  }
  c.addEventListener('statechange', startBed)
  startBed()
  if (c.state !== 'running') void c.resume().then(startBed, () => {})
}

/** Leaving the exhibit silences it — the glide must not follow the
 *  visitor back to the index. */
export function disposeGullfireAudio() {
  if (unlock) {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    unlock = null
  }
  unsubMute?.()
  unsubMute = null
  ctx?.close().catch(() => {})
  ctx = null
  load = null
  bed = null
}
