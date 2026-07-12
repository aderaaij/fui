import { lazy } from 'react'
import type { ExhibitMeta } from './types'

/**
 * The archive. Adding an exhibit = add a folder under src/exhibits/ with a
 * default-exported fullscreen component, then register it here. Entries in
 * 'restoration' status appear on the index as offline records.
 */
export const exhibits: ExhibitMeta[] = [
  {
    id: 'muthur',
    title: 'MU/TH/UR 6000',
    source: { title: 'Alien', year: 1979 },
    description: "The Nostromo's mainframe. Interface 2037 ready for inquiry.",
    renderer: 'r3f',
    status: 'online',
    component: lazy(() => import('./muthur')),
    sound: true,
    accuracyNotes: [
      "The boot opens with the circuit-mandala blooming across MOTHER's monitor; it is regrown procedurally on every boot rather than traced from the film's artwork.",
      "The wake-up then recreates the film frame by frame: a raster-noise storm resolving into the OVERMONITORING ADDRESS MATRIX, transcribed verbatim — including the film's own spelling 'ALLIGNMENT'.",
      'Once the matrix settles MU/TH/UR waits: arrow keys walk the white selection rule down both address columns and ENTER opens the record — INTERFACE 2037 is the only address wired to anything, as in the film.',
      "Every printed line is announced by the film's full-width light bar collapsing into the margin, then types out behind an overdriven write-head that flickers through garbage before each character resolves; statements are ruled underneath as they land. The head's garbage is drawn from Graduate's own glyphs plus quad blocks — the original MSD display's exact stray shapes are unreproducible.",
      "Your own inquiry appears as you type it — with the write-head flaring per keystroke — rather than at the film's uniform machine cadence; live keyboards outrank strict accuracy here.",
      "MU/TH/UR sounds like herself: the boot rumble, matrix beeps, selection sweep and line-printer ratchet are lifted from the film scenes the animations were timed against. The ratchet loops under the write-head for exactly as long as each line types — however long the reply. The chamber's room tone loops constantly underneath, so the cues are spectrally de-hummed to sit on it. Keystrokes borrow the matrix tick — the film never mics the keyboard clean.",
      "Dallas says 'Morning, Mother' over the wake-up glyph. His voice sits center in the film's stereo mix while the electronics spread wide, so the glyph cue is rebuilt from the sides only — the machine boots, the man is edited out.",
      "Browsers gate sound behind a first interaction, so a direct visit gets MU/TH/UR's power switch instead of a silent boot; arriving from the archive index counts, and she wakes unprompted. SOUND in the chrome mutes her entirely.",
      "The film shot live 1979 CRTs; phosphor color, glow smears, curvature and scanlines are shader approximations tuned against the reference frames.",
      "The film's screen face is Berthold City Light, optically stretched (per Typeset in the Future). Every screen on this tube renders Graduate — an open square slab — under the same optical stretch; City's license keeps the original out of reach.",
      "The film's own inquiries — Special Order 937, the crew, the signal — answer verbatim from a scripted table. Anything else is synthesized live by a language model held to MU/TH/UR's register and 2122 shipboard knowledge, so free inquiry is an extrapolation of her, not the film; the terminal's charset and line grid clamp whatever she says.",
      "The synthesis runs on a small daily budget. When it runs out the exhibit silently degrades to its fully scripted self: unscripted inquiries get the film's own UNABLE TO CLARIFY, and the scripted records keep answering. Ask her about Special Order 937.",
      "MU/TH/UR answered to a keyboard in a landscape tube, and desktop keeps that — arrows, ENTER, nothing to click. Touch screens get the necessary heresies: the matrix shrinks to fit portrait glass and opens its row spacing, a tap walks the selection rule (a second tap on INTERFACE 2037 opens it), and your device's own keyboard stands in for the Nostromo's — tap the tube to raise it.",
    ],
  },
  {
    id: 'gullfire-nav',
    title: 'GULLFIRE WIREFRAME NAV',
    source: { title: 'Escape from New York', year: 1981 },
    description: 'Glider approach over a wireframe Manhattan.',
    renderer: 'r3f',
    status: 'restoration',
    accuracyNotes: [],
  },
  {
    id: 'bio-helmet',
    title: 'BIO-HELMET THERMAL',
    source: { title: 'Predator', year: 1987 },
    description: 'Thermal vision, target lock, and a language you cannot read.',
    renderer: 'r3f',
    status: 'restoration',
    accuracyNotes: [],
  },
  {
    id: 't800-hud',
    title: 'T-800 VISION',
    source: { title: 'The Terminator', year: 1984 },
    description: 'Red-shifted threat assessment with scrolling 6502 assembly.',
    renderer: 'hybrid',
    status: 'restoration',
    accuracyNotes: [],
  },
  {
    id: 'hand-terminal',
    title: 'HAND TERMINAL',
    source: { title: 'The Expanse', year: 2015 },
    description: 'Translucent Belter glass. Sasa ke?',
    renderer: 'dom',
    status: 'restoration',
    accuracyNotes: [],
  },
]

export function getExhibit(id: string | undefined): ExhibitMeta | undefined {
  return exhibits.find((e) => e.id === id)
}
