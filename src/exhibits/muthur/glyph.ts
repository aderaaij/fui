/**
 * MU/TH/UR's wake-up glyph — the circuit-mandala that blooms from the center
 * of the monitor in MOTHER's room (reference/muthur-boot-animation).
 *
 * The film's artwork is regrown procedurally on every boot: rectilinear
 * circuit walkers run through one quadrant (vertical spine first, then
 * horizontal arms, then stepped diagonals, then core infill, as in the
 * clip) and are mirrored four ways at draw time. Each rect carries a birth
 * time derived from its radius, so revealing by time grows the pattern
 * radially outward.
 */

export interface GlyphRect {
  /** Quadrant cell coords, x right / y up from the glyph center */
  x: number
  y: number
  w: number
  h: number
  /** Birth time, 0..1 across the growth animation */
  t: number
  /** Pads render brighter than traces */
  bright: boolean
}

/** Max radius in cells; the glyph is wider than tall, as on the tube */
export const GLYPH_RADIUS = 50
const STRETCH_X = 1.3

const rand = (n: number) => Math.floor(Math.random() * n)
const chance = (p: number) => Math.random() < p

interface Walker {
  x: number
  y: number
  dx: number
  dy: number
  /** Stepped diagonal (alternating 1-cell runs) instead of straight runs */
  stair: boolean
  /** Earliest birth time — staggers spine/arms/diagonals like the film */
  startT: number
}

function radius(x: number, y: number) {
  return Math.sqrt((x / STRETCH_X) ** 2 + y ** 2) / GLYPH_RADIUS
}

export function generateGlyph(): GlyphRect[] {
  const rects: GlyphRect[] = []
  const queue: Walker[] = [
    // vertical spine first, as in the film
    { x: 0, y: 0, dx: 0, dy: 1, stair: false, startT: 0 },
    { x: 2, y: 3, dx: 0, dy: 1, stair: false, startT: 0.06 },
    // horizontal arms
    { x: 0, y: 0, dx: 1, dy: 0, stair: false, startT: 0.2 },
    { x: 1, y: 4, dx: 1, dy: 0, stair: false, startT: 0.24 },
    // stepped diagonals
    { x: 1, y: 1, dx: 1, dy: 1, stair: true, startT: 0.3 },
    { x: 3, y: 1, dx: 1, dy: 1, stair: true, startT: 0.36 },
    // late infill around the core
    { x: 2, y: 6, dx: 1, dy: 0, stair: false, startT: 0.5 },
    { x: 6, y: 2, dx: 0, dy: 1, stair: false, startT: 0.55 },
    { x: 4, y: 8, dx: 1, dy: 0, stair: false, startT: 0.6 },
    { x: 9, y: 3, dx: 0, dy: 1, stair: false, startT: 0.65 },
  ]

  const put = (x: number, y: number, w: number, h: number, startT: number, bright: boolean) => {
    rects.push({
      x,
      y,
      w,
      h,
      t: Math.min(1, Math.max(startT, radius(x + w / 2, y + h / 2))),
      bright,
    })
  }

  for (let qi = 0; qi < queue.length && qi < 80; qi++) {
    const wk = { ...queue[qi] }
    let stairPhase = 0
    for (let step = 0; step < 200; step++) {
      if (radius(wk.x, wk.y) >= 1) break
      if (wk.stair) {
        const horizontal = stairPhase++ % 2 === 0
        const len = 1 + rand(3)
        if (horizontal) {
          put(wk.x, wk.y, len, 1, wk.startT, false)
          wk.x += len
        } else {
          put(wk.x, wk.y, 1, len, wk.startT, false)
          wk.y += len
        }
      } else {
        const len = 2 + rand(4)
        if (wk.dx !== 0) {
          put(wk.x, wk.y, len, 1, wk.startT, false)
          wk.x += len
        } else {
          put(wk.x, wk.y, 1, len, wk.startT, false)
          wk.y += len
        }
        if (chance(0.16)) {
          const dx = wk.dx
          wk.dx = wk.dy
          wk.dy = dx
        }
      }
      if (chance(0.07)) {
        put(wk.x - 1, wk.y - 1, 2 + rand(2), 2 + rand(2), wk.startT, true)
      }
      if (chance(0.09) && queue.length < 48) {
        queue.push({
          x: wk.x,
          y: wk.y,
          dx: wk.dx === 0 ? 1 : 0,
          dy: wk.dx === 0 ? 0 : 1,
          stair: false,
          startT: Math.max(wk.startT, radius(wk.x, wk.y)),
        })
      }
      if (chance(0.06)) break
    }
  }

  return rects.sort((a, b) => a.t - b.t)
}
