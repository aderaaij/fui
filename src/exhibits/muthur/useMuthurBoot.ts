import { useEffect, useState } from 'react'
import { COLS, MATRIX_LINES, ROWS, STORM_FRAGMENTS, STORM_GLYPHS, TITLE } from './matrix'

export type BootPhase = 'glyph' | 'storm' | 'resolve' | 'stable' | 'ready'

/** How much of the address matrix has typed in, in padded-line chars. */
export interface MatrixReveal {
  titleChars: number
  lineChars: number[]
}

const FULL_MATRIX: MatrixReveal = {
  titleChars: TITLE.length,
  lineChars: MATRIX_LINES.map((l) => l.length),
}

export type StreakKind = 'hair' | 'glow' | 'hot'

/** A horizontal light smear, in screen-fraction coordinates. */
export interface Streak {
  id: number
  x: number
  y: number
  w: number
  kind: StreakKind
}

// Phase lengths follow the film clips: the circuit-mandala blooms for ~2.5s
// (muthur-boot-animation), then ~4s of storm/matrix (muthur-boot), then a
// stable hold before handing off to Interface 2037.
const GLYPH_MS = 2500
const STORM_MS = 2100
const RESOLVE_MS = 1500
const STABLE_MS = 1400
const TICK_MS = 85

const rand = (n: number) => Math.floor(Math.random() * n)
const chance = (p: number) => Math.random() < p

let streakId = 0

function makeStreaks(min: number, max: number, keep = 1): Streak[] {
  const out: Streak[] = []
  for (let i = 0, count = min + rand(max - min + 1); i < count; i++) {
    if (!chance(keep)) continue
    const roll = Math.random()
    out.push({
      id: streakId++,
      x: Math.random() * 0.5,
      y: (rand(ROWS) + 0.5) / ROWS,
      w: 0.15 + Math.random() * 0.7,
      kind: roll < 0.4 ? 'hair' : roll < 0.85 ? 'glow' : 'hot',
    })
  }
  return out
}

/**
 * One burst of raster noise, in grid coordinates. Graduate is proportional,
 * so the storm can't be laid out as padded monospace strings — each fragment
 * is placed on the 64-column grid individually, which also keeps interlace
 * ghosts perfectly registered under their source row.
 */
export interface StormFragment {
  row: number
  col: number
  text: string
  /** Hot phosphor block — rendered as a quad (Graduate has no █ glyph). */
  block?: boolean
}

function stormFragments(): StormFragment[] {
  const out: StormFragment[] = []
  const put = (row: number, col: number, text: string, block = false) => {
    if (row < 0 || row >= ROWS || col >= COLS) return
    out.push({ row, col, text: text.slice(0, COLS - col), block })
  }
  for (let i = 0, bursts = 14 + rand(10); i < bursts; i++) {
    const row = rand(ROWS - 1)
    const col = rand(COLS - 12)
    const roll = Math.random()
    let token: string
    if (roll < 0.35) {
      token = STORM_FRAGMENTS[rand(STORM_FRAGMENTS.length)]
    } else if (roll < 0.6) {
      token = STORM_GLYPHS[rand(STORM_GLYPHS.length)].repeat(3 + rand(4))
    } else {
      token = Array.from({ length: 2 + rand(7) }, () =>
        chance(0.2) ? ' ' : STORM_GLYPHS[rand(STORM_GLYPHS.length)],
      ).join('')
    }
    put(row, col, token)
    // interlace ghost: the film doubles rows one line down
    if (chance(0.6)) put(row + 1, col, token)
  }
  for (let i = 0, blocks = 3 + rand(4); i < blocks; i++) {
    put(rand(ROWS), rand(COLS - 2), '', true)
  }
  return out
}

interface RowSchedule {
  start: number
  end: number
}

function makeSchedule(): RowSchedule[] {
  return MATRIX_LINES.map(() => {
    const start = Math.random() * 0.55
    return { start, end: Math.min(1, start + 0.3 + Math.random() * 0.35) }
  })
}

function resolveMatrix(p: number, schedule: RowSchedule[]): MatrixReveal {
  return {
    titleChars: Math.floor(Math.min(1, p * 1.6) * TITLE.length),
    lineChars: MATRIX_LINES.map((line, i) => {
      const { start, end } = schedule[i]
      const t = Math.min(1, Math.max(0, (p - start) / (end - start)))
      return Math.floor(t * line.length)
    }),
  }
}

/**
 * Drives MU/TH/UR's wake-up: raster-noise storm → the address matrix typing
 * itself in → stable hold → 'ready' (hand-off to the inquiry interface).
 */
// Dev pins: /muthur?boot=glyph[&p=0.6] freezes the wake-up glyph,
// ?boot=matrix freezes the stable address matrix — for tuning against the
// reference frames. Read once; applied as initial state so no mid-suspense
// phase flip happens at mount.
function readPin() {
  const params = new URLSearchParams(window.location.search)
  return { pin: params.get('boot'), p: Number(params.get('p') ?? '1') }
}

export function useMuthurBoot() {
  const [{ pin, p }] = useState(readPin)
  const [phase, setPhase] = useState<BootPhase>(pin === 'matrix' ? 'stable' : 'glyph')
  const [glyphProgress, setGlyphProgress] = useState(pin === 'glyph' ? p : 0)
  const [storm, setStorm] = useState<StormFragment[]>([])
  const [matrix, setMatrix] = useState<MatrixReveal | null>(pin === 'matrix' ? FULL_MATRIX : null)
  const [streaks, setStreaks] = useState<Streak[]>([])

  useEffect(() => {
    if (pin) return
    const schedule = makeSchedule()
    const start = performance.now()
    const id = window.setInterval(() => {
      const t = performance.now() - start
      if (t < GLYPH_MS) {
        setGlyphProgress(t / GLYPH_MS)
      } else if (t < GLYPH_MS + STORM_MS) {
        setPhase('storm')
        setStorm(stormFragments())
        setStreaks(makeStreaks(2, 6))
      } else if (t < GLYPH_MS + STORM_MS + RESOLVE_MS) {
        const p = (t - GLYPH_MS - STORM_MS) / RESOLVE_MS
        setPhase('resolve')
        setStorm([])
        setMatrix(resolveMatrix(p, schedule))
        setStreaks(makeStreaks(0, 3, 1 - p * 0.6))
      } else if (t < GLYPH_MS + STORM_MS + RESOLVE_MS + STABLE_MS) {
        setPhase('stable')
        setMatrix(FULL_MATRIX)
        setStreaks(makeStreaks(0, 1, 0.12))
      } else {
        window.clearInterval(id)
        setPhase('ready')
        setStorm([])
        setMatrix(null)
        setStreaks([])
      }
    }, TICK_MS)
    return () => {
      window.clearInterval(id)
      setPhase('glyph')
      setGlyphProgress(0)
      setStorm([])
      setMatrix(null)
      setStreaks([])
    }
  }, [pin])

  return { phase, glyphProgress, storm, matrix, streaks }
}
