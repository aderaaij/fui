import { useEffect, useState } from 'react'
import {
  COLS,
  MATRIX_LINES,
  MATRIX_START_ROW,
  ROWS,
  STORM_FRAGMENTS,
  STORM_GLYPHS,
  targetScreen,
  TITLE,
  TITLE_ROW,
} from './matrix'

export type BootPhase = 'glyph' | 'storm' | 'resolve' | 'stable' | 'ready'

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

function blankGrid(): string[][] {
  return Array.from({ length: ROWS }, () => Array<string>(COLS).fill(' '))
}

function writeAt(grid: string[][], row: number, col: number, text: string) {
  if (row < 0 || row >= ROWS) return
  for (let i = 0; i < text.length && col + i < COLS; i++) {
    grid[row][col + i] = text[i]
  }
}

function joinGrid(grid: string[][]): string[] {
  return grid.map((row) => row.join('').trimEnd())
}

function stormScreen(): string[] {
  const grid = blankGrid()
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
    writeAt(grid, row, col, token)
    // interlace ghost: the film doubles rows one line down
    if (chance(0.6)) writeAt(grid, row + 1, col, token)
  }
  for (let i = 0, blocks = 3 + rand(4); i < blocks; i++) {
    writeAt(grid, rand(ROWS), rand(COLS), '█')
  }
  return joinGrid(grid)
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

function resolveScreen(p: number, schedule: RowSchedule[]): string[] {
  const rows = Array.from({ length: ROWS }, () => '')
  rows[TITLE_ROW] = TITLE.slice(0, Math.floor(Math.min(1, p * 1.6) * TITLE.length))
  MATRIX_LINES.forEach((line, i) => {
    const { start, end } = schedule[i]
    const t = Math.min(1, Math.max(0, (p - start) / (end - start)))
    rows[MATRIX_START_ROW + i] = line.slice(0, Math.floor(t * line.length))
  })
  const grid = rows.map((row) => row.padEnd(COLS).split(''))
  for (let i = 0, n = rand(4); i < n; i++) {
    grid[rand(ROWS)][rand(COLS)] = chance(0.5) ? '█' : '_'
  }
  return joinGrid(grid)
}

/**
 * Drives MU/TH/UR's wake-up: raster-noise storm → the address matrix typing
 * itself in → stable hold → 'ready' (hand-off to the inquiry interface).
 */
export function useMuthurBoot() {
  const [phase, setPhase] = useState<BootPhase>('glyph')
  const [glyphProgress, setGlyphProgress] = useState(0)
  const [screen, setScreen] = useState<string[]>([])
  const [streaks, setStreaks] = useState<Streak[]>([])

  useEffect(() => {
    const schedule = makeSchedule()
    const start = performance.now()
    const id = window.setInterval(() => {
      const t = performance.now() - start
      if (t < GLYPH_MS) {
        setGlyphProgress(t / GLYPH_MS)
      } else if (t < GLYPH_MS + STORM_MS) {
        setPhase('storm')
        setScreen(stormScreen())
        setStreaks(makeStreaks(2, 6))
      } else if (t < GLYPH_MS + STORM_MS + RESOLVE_MS) {
        const p = (t - GLYPH_MS - STORM_MS) / RESOLVE_MS
        setPhase('resolve')
        setScreen(resolveScreen(p, schedule))
        setStreaks(makeStreaks(0, 3, 1 - p * 0.6))
      } else if (t < GLYPH_MS + STORM_MS + RESOLVE_MS + STABLE_MS) {
        setPhase('stable')
        setScreen(targetScreen())
        setStreaks(makeStreaks(0, 1, 0.12))
      } else {
        window.clearInterval(id)
        setPhase('ready')
        setScreen([])
        setStreaks([])
      }
    }, TICK_MS)
    return () => {
      window.clearInterval(id)
      setPhase('glyph')
      setGlyphProgress(0)
      setScreen([])
      setStreaks([])
    }
  }, [])

  return { phase, glyphProgress, text: screen.join('\n'), streaks }
}
