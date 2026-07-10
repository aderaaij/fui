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
    accuracyNotes: [
      "The wake-up recreates the film frame by frame: a raster-noise storm resolving into the OVERMONITORING ADDRESS MATRIX, transcribed verbatim — including the film's own spelling 'ALLIGNMENT'.",
      "In the film the address matrix and the Interface 2037 inquiry screen are separate displays in MU/TH/UR's core; here the matrix hands off to the inquiry screen so the exhibit stays usable.",
      "The film shot live 1979 CRTs; phosphor color, glow smears, curvature and scanlines are shader approximations tuned against the reference frames.",
      "Typeface is VT323, a DEC VT320 revival — the film's wider, machined face is still unidentified; tracking is widened to approximate it.",
      'MU/TH/UR answers a small set of inquiries, as in the film. Ask her about Special Order 937.',
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
