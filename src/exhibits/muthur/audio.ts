import { isMuted, onMutedChange } from "@/lib/sound";
import bootGlyphUrl from "./sfx/boot-glyph.m4a";
import bootMatrixUrl from "./sfx/boot-matrix.m4a";
import roomHumUrl from "./sfx/room-hum.wav";
import selectConfirmUrl from "./sfx/select-confirm.m4a";
import selectMoveUrl from "./sfx/select-move.m4a";
import typeLoopUrl from "./sfx/type-loop.wav";

/**
 * MU/TH/UR's voice, cut from the same film clips her animations were timed
 * against (scripts/grab-audio.sh), so cue lengths already match the phases:
 * bootGlyph runs the glyph's 2.5s, bootMatrix the 4s storm-to-matrix,
 * selectConfirm the 0.5s 'chosen' beat.
 */
const SOURCES = {
  bootGlyph: bootGlyphUrl,
  bootMatrix: bootMatrixUrl,
  roomHum: roomHumUrl,
  selectMove: selectMoveUrl,
  selectConfirm: selectConfirmUrl,
  typeLoop: typeLoopUrl,
} as const;

/** The chamber's constant room tone, looped under every screen. WAV, not
 *  m4a: AAC priming samples would click at the loop seam. */
const HUM_GAIN = 0.1;

export type SfxName = keyof typeof SOURCES;

let ctx: AudioContext | null = null;
let loads: Map<SfxName, Promise<AudioBuffer>> | null = null;
let hum: AudioBufferSourceNode | null = null;
let typeLoop: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let typeLoopToken = 0;
let master: GainNode | null = null;
let unsubMute: (() => void) | null = null;
let unlock: (() => void) | null = null;

export function initMuthurAudio() {
  if (ctx) return;
  const c = new AudioContext();
  ctx = c;
  loads = new Map(
    (Object.entries(SOURCES) as [SfxName, string][]).map(([name, url]) => [
      name,
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => c.decodeAudioData(data)),
    ]),
  );
  // Everything routes through one gain honoring the archive-wide SOUND
  // toggle; the graph keeps running while muted so unmuting is instant
  const m = c.createGain();
  m.gain.value = isMuted() ? 0 : 1;
  m.connect(c.destination);
  master = m;
  unsubMute = onMutedChange((muted) => {
    m.gain.setTargetAtTime(muted ? 0 : 1, c.currentTime, 0.03);
  });
  // The autoplay gate lifts only for a resume() issued during a gesture.
  // Cues resume on keydown already, but a click plays nothing by itself —
  // without this, a cold-opened tab that was only ever clicked stays mute
  unlock = () => void c.resume();
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  // The hum starts the moment the context is allowed to run — immediately
  // when the visitor arrived via a click (sticky activation), otherwise on
  // the first gesture (statechange fires when the queued resume lands)
  const startHum = () => {
    if (c !== ctx || c.state !== "running" || hum) return;
    loads
      ?.get("roomHum")
      ?.then((buffer) => {
        if (c !== ctx || c.state !== "running" || hum) return;
        hum = c.createBufferSource();
        hum.buffer = buffer;
        hum.loop = true;
        const g = c.createGain();
        g.gain.value = HUM_GAIN;
        hum.connect(g);
        g.connect(m);
        hum.start();
      })
      .catch(() => {});
  };
  c.addEventListener("statechange", startHum);
  startHum();
  if (c.state !== "running") void c.resume().then(startHum, () => {});
}

/** Leaving the exhibit silences it — a booting MU/TH/UR must not follow
 *  the visitor back to the index. */
export function disposeMuthurAudio() {
  if (unlock) {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    unlock = null;
  }
  unsubMute?.();
  unsubMute = null;
  ctx?.close().catch(() => {});
  ctx = null;
  loads = null;
  hum = null;
  typeLoop = null;
  typeLoopToken++;
  master = null;
}

/**
 * Fire a cue. Playback waits on decode and on the browser's autoplay gate
 * (a context created without user activation stays suspended until the
 * first gesture): a cue that becomes playable within a beat starts late
 * with a catch-up offset, anything staler is dropped — so a cold-opened
 * tab boots silent instead of dumping the backlog on the first keypress.
 */
export function playSfx(name: SfxName, gain = 1) {
  const c = ctx;
  const load = loads?.get(name);
  if (!c || !load) return;
  const requested = performance.now();
  Promise.all([load, c.state === "running" ? null : c.resume()])
    .then(([buffer]) => {
      if (c.state !== "running") return;
      const late = (performance.now() - requested) / 1000;
      if (late > 0.6) return;
      if (!master) return;
      const src = c.createBufferSource();
      src.buffer = buffer;
      const g = c.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(master);
      src.start(0, late > 0.05 ? late : 0);
    })
    .catch(() => {}); // an unplayable cue is a quieter exhibit, not a crash
}

/**
 * The line-printer ratchet under the write-head. A loop rather than a
 * one-shot so it runs exactly as long as the line takes to type — start
 * it when the reveal begins, stop it as the last character lands. Starts
 * at a random point in the loop so consecutive lines don't share an
 * identical clack pattern. Same stale-drop rules as playSfx.
 */
export function startTypeLoop(gain = 1) {
  const c = ctx;
  const load = loads?.get("typeLoop");
  if (!c || !load) return;
  const token = ++typeLoopToken;
  const requested = performance.now();
  Promise.all([load, c.state === "running" ? null : c.resume()])
    .then(([buffer]) => {
      if (token !== typeLoopToken || typeLoop) return;
      if (c !== ctx || c.state !== "running" || !master) return;
      if (performance.now() - requested > 600) return;
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = c.createGain();
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.015);
      src.connect(g);
      g.connect(master);
      src.start(0, Math.random() * buffer.duration);
      typeLoop = { src, gain: g };
    })
    .catch(() => {});
}

export function stopTypeLoop() {
  typeLoopToken++;
  const c = ctx;
  const t = typeLoop;
  typeLoop = null;
  if (!c || !t || c.state === "closed") return;
  const now = c.currentTime;
  t.gain.gain.cancelScheduledValues(now);
  t.gain.gain.setValueAtTime(t.gain.gain.value, now);
  t.gain.gain.linearRampToValueAtTime(0, now + 0.06);
  t.src.stop(now + 0.08);
}
