/**
 * MU/TH/UR's wake-up glyph — the circuit-mandala that blooms across the
 * monitor in MOTHER's room (reference/muthur-boot-animation).
 *
 * The film artwork is hollow PCB-style linework: bundles of parallel traces
 * that jog together, true 45° runs in the corner sectors, comb/pin rows,
 * outlined boxes, and a dark cross of dead space on the axes — all inside an
 * octagonal silhouette wider than it is tall. We regrow it procedurally each
 * boot: structures are generated in one quadrant as stroked paths and
 * mirrored four ways at draw time. Every event carries a birth time from its
 * distance to the center, so revealing chronologically grows the mandala
 * outward, vertical spine first, exactly like the clip.
 */

export type GlyphEvent =
  | { kind: 'stroke'; t: number; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'fill'; t: number; x: number; y: number; w: number; h: number }

/** Quadrant extents in trace units */
export const QUAD_W = 110
export const QUAD_H = 72
/** Octagon corner cut: inside while x/W + y/H stays below this */
const CUT = 1.5
/** Max piece length so long runs reveal gradually instead of popping in */
const PIECE = 8

type Pt = [number, number]

const rand = (n: number) => Math.floor(Math.random() * n)
const range = (a: number, b: number) => a + Math.random() * (b - a)
const chance = (p: number) => Math.random() < p

function inside(x: number, y: number) {
  return x >= 0 && y >= 0 && x <= QUAD_W && y <= QUAD_H && x / QUAD_W + y / QUAD_H <= CUT
}

/** 0 at the center, 1 at the octagon boundary */
function rnorm(x: number, y: number) {
  return Math.min(1, Math.max(x / QUAD_W, y / QUAD_H, (x / QUAD_W + y / QUAD_H) / CUT))
}

function birth(x: number, y: number, startT: number) {
  return Math.min(1, Math.max(startT, rnorm(x, y) * 0.85 + 0.05))
}

/** Emit a polyline as clipped, subdivided stroke events. */
function pathEvents(path: Pt[], startT: number, out: GlyphEvent[]) {
  for (let i = 0; i < path.length - 1; i++) {
    let [ax, ay] = path[i]
    let [bx, by] = path[i + 1]
    if (!inside(ax, ay) && !inside(bx, by)) continue
    if (!inside(ax, ay)) [[ax, ay], [bx, by]] = [[bx, by], [ax, ay]]
    for (let k = 0; k < 8 && !inside(bx, by); k++) {
      bx = (ax + bx) / 2
      by = (ay + by) / 2
    }
    const len = Math.hypot(bx - ax, by - ay)
    const pieces = Math.max(1, Math.ceil(len / PIECE))
    for (let p = 0; p < pieces; p++) {
      const x1 = ax + ((bx - ax) * p) / pieces
      const y1 = ay + ((by - ay) * p) / pieces
      const x2 = ax + ((bx - ax) * (p + 1)) / pieces
      const y2 = ay + ((by - ay) * (p + 1)) / pieces
      out.push({ kind: 'stroke', t: birth((x1 + x2) / 2, (y1 + y2) / 2, startT), x1, y1, x2, y2 })
    }
  }
}

/**
 * Horizontal bus: long x-runs with shared vertical jogs. Drift is clamped so
 * the whole bundle stays inside its lane instead of wandering into
 * neighboring bundles.
 */
function hPath(x0: number, y0: number, totalLen: number): Pt[] {
  const pts: Pt[] = [[x0, y0]]
  let x = x0
  let y = y0
  while (x - x0 < totalLen) {
    x += range(8, 26)
    pts.push([x, y])
    if (chance(0.55)) {
      const drift = y - y0
      const dir = drift > 4 ? -1 : drift < -4 ? 1 : chance(0.5) ? 1 : -1
      y = Math.max(1, y + dir * range(2, 4))
      pts.push([x, y])
    }
  }
  return pts
}

/** Vertical bus: long y-runs with shared horizontal jogs, lane-clamped. */
function vPath(x0: number, y0: number, totalLen: number): Pt[] {
  const pts: Pt[] = [[x0, y0]]
  let x = x0
  let y = y0
  while (y - y0 < totalLen) {
    y += range(7, 20)
    pts.push([x, y])
    if (chance(0.5)) {
      const drift = x - x0
      const dir = drift > 4 ? -1 : drift < -4 ? 1 : chance(0.5) ? 1 : -1
      x = Math.max(1, x + dir * range(2, 4))
      pts.push([x, y])
    }
  }
  return pts
}

/** 45° run toward the octagon corner, with small h/v jogs. */
function dPath(x0: number, y0: number, totalLen: number): Pt[] {
  const pts: Pt[] = [[x0, y0]]
  let x = x0
  let y = y0
  let walked = 0
  while (walked < totalLen) {
    const d = range(6, 18)
    x += d
    y += d
    walked += d
    pts.push([x, y])
    if (chance(0.45)) {
      if (chance(0.5)) x += range(2, 4)
      else y += range(2, 4)
      pts.push([x, y])
    }
  }
  return pts
}

/**
 * Replicate a base path into parallel offset copies with staggered ends —
 * the bundles-of-traces-that-jog-together look of the artwork.
 */
function bundle(
  base: Pt[],
  count: number,
  gap: number,
  axis: 'x' | 'y',
  startT: number,
  out: GlyphEvent[],
) {
  for (let i = 0; i < count; i++) {
    const off = i * gap
    let pts = base.map(([px, py]) => (axis === 'x' ? [px + off, py] : [px, py + off]) as Pt)
    const lead = rand(4)
    const tail = rand(4)
    pts = pts.slice(lead, pts.length - tail)
    if (pts.length >= 2) pathEvents(pts, startT + i * 0.012, out)
  }
}

/** Base line with a row of short perpendicular teeth — IC pin combs. */
function comb(
  x0: number,
  y0: number,
  dir: 'h' | 'v',
  len: number,
  teeth: number,
  startT: number,
  out: GlyphEvent[],
) {
  const end: Pt = dir === 'h' ? [x0 + len, y0] : [x0, y0 + len]
  pathEvents([[x0, y0], end], startT, out)
  const sign = chance(0.5) ? 1 : -1
  for (let d = 2; d < len - 1; d += 3) {
    const [tx, ty]: Pt = dir === 'h' ? [x0 + d, y0] : [x0, y0 + d]
    const tip: Pt = dir === 'h' ? [tx, ty + sign * teeth] : [tx + sign * teeth, ty]
    pathEvents([[tx, ty], tip], startT, out)
  }
}

function box(x: number, y: number, w: number, h: number, startT: number, out: GlyphEvent[]) {
  pathEvents(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ],
    startT,
    out,
  )
}

export function generateGlyph(): GlyphEvent[] {
  const out: GlyphEvent[] = []

  // Vertical spine bundles in x-banded lanes, center-out, growing first.
  // Runs go long — the octagon clip trims them into the silhouette.
  let xBand = 2 + rand(2)
  for (let i = 0; i < 3; i++) {
    const count = 3 + rand(3)
    // The innermost lane is the full-height spine; outer lanes start deeper
    bundle(vPath(xBand, i === 0 ? range(2, 6) : range(4, 22), QUAD_H * range(0.85, 1)), count, 2.8, 'x', i * 0.08, out)
    xBand += count * 2.8 + range(4, 8)
  }

  // Horizontal buses in y-banded lanes across the east sector, starting at
  // varying distances from the axis so the center stays open
  let yBand = 2 + rand(2)
  for (let i = 0; i < 4; i++) {
    const count = 3 + rand(4)
    bundle(
      hPath(range(6, 36), yBand, QUAD_W * range(0.85, 1)),
      count,
      2.8,
      'y',
      0.12 + i * 0.05,
      out,
    )
    yBand += count * 2.8 + range(4, 8)
  }

  // 45° hatch through the corner sector, x-banded
  let dBand = range(2, 8)
  for (let i = 0; i < 4; i++) {
    const count = 3 + rand(3)
    bundle(dPath(dBand, range(6, 24), 95), count, 3, 'x', 0.22 + i * 0.05, out)
    dBand += count * 3 + range(4, 9)
  }

  // Pin combs along the buses
  comb(range(10, 40), range(4, 16), 'h', range(18, 34), range(4, 7), 0.38, out)
  comb(range(4, 14), range(20, 40), 'v', range(14, 26), range(4, 6), 0.46, out)
  if (chance(0.7)) comb(range(35, 60), range(16, 32), 'h', range(12, 24), range(3, 6), 0.55, out)

  // Outlined boxes, some concentric
  for (let i = 0; i < 14; i++) {
    const x = range(6, QUAD_W * 0.85)
    const y = range(4, QUAD_H * 0.8)
    const w = range(4, 12)
    const h = range(3, 9)
    if (!inside(x + w, y + h)) continue
    box(x, y, w, h, 0.2 + Math.random() * 0.55, out)
    if (chance(0.4) && w > 6 && h > 5) box(x + 2, y + 2, w - 4, h - 4, 0.25 + Math.random() * 0.55, out)
  }

  // Small solid pads
  for (let i = 0; i < 7; i++) {
    const x = range(4, QUAD_W * 0.85)
    const y = range(3, QUAD_H * 0.8)
    if (!inside(x + 3, y + 3)) continue
    out.push({ kind: 'fill', t: birth(x, y, 0.2 + Math.random() * 0.5), x, y, w: range(2, 3.5), h: range(2, 3.5) })
  }

  // L-shaped connectors scattered through the sectors
  for (let i = 0; i < 40; i++) {
    const x = range(4, QUAD_W * 0.9)
    const y = range(3, QUAD_H * 0.85)
    if (!inside(x, y)) continue
    const mid: Pt = chance(0.5) ? [x + range(4, 14), y] : [x, y + range(3, 10)]
    const end: Pt = chance(0.5) ? [mid[0], mid[1] + range(3, 10)] : [mid[0] + range(4, 14), mid[1]]
    pathEvents([[x, y], mid, end], 0.25 + Math.random() * 0.55, out)
  }

  return out.sort((a, b) => a.t - b.t)
}
