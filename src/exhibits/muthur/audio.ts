import { isMuted, onMutedChange } from "@/lib/sound";
import bootGlyphUrl from "./sfx/boot-glyph.m4a";
import bootMatrixUrl from "./sfx/boot-matrix.m4a";
import roomHumUrl from "./sfx/room-hum.wav";
import selectConfirmUrl from "./sfx/select-confirm.m4a";
import selectMoveUrl from "./sfx/select-move.m4a";
import typeLine1Url from "./sfx/type-line-1.m4a";
import typeLine2Url from "./sfx/type-line-2.m4a";
import typeLine3Url from "./sfx/type-line-3.m4a";

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
  typeLine1: typeLine1Url,
  typeLine2: typeLine2Url,
  typeLine3: typeLine3Url,
} as const;

/** The chamber's constant room tone, looped under every screen. WAV, not
 *  m4a: AAC priming samples would click at the loop seam. */
const HUM_GAIN = 0.1;

export type SfxName = keyof typeof SOURCES;

let ctx: AudioContext | null = null;
let loads: Map<SfxName, Promise<AudioBuffer>> | null = null;
let hum: AudioBufferSourceNode | null = null;
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

const TYPE_LINES = ["typeLine1", "typeLine2", "typeLine3"] as const;
let typeVoice = 0;

/** The line-printer burst announcing a typed line, rotating through the
 *  three takes so back-to-back statements don't machine-gun one sample. */
export function playTypeLine(gain = 1) {
  playSfx(TYPE_LINES[typeVoice++ % TYPE_LINES.length], gain);
}
