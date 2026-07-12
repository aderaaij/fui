import {
  BufferAttribute,
  BufferGeometry,
  Vector2,
  ShapeUtils,
} from 'three'

/**
 * The baked city (scripts/bake-manhattan.mjs): building footprints and
 * heights from OpenStreetMap, flat-packed in integer meters around a local
 * origin between the Twin Towers. x = east, y = north.
 */
export interface CityData {
  v: number
  origin: [number, number]
  heights: number[]
  /** verts index (in points) where building i's ring starts; length N+1 */
  ringStart: number[]
  /** flat x,y ring points for all buildings */
  verts: number[]
  /** shoreline + pier polylines, same packing */
  shore: number[][]
}

/**
 * The film dressed a black miniature in reflective tape: faces swallow
 * light, edges return it. Same trick here — solid black extrusions that
 * only occlude, and a LineSegments pass carrying every taped edge (roof
 * outline + vertical corners + shoreline), with per-building brightness
 * scatter so the "tape" reads hand-laid rather than computed.
 */
export interface TapeTile {
  /** flat segment endpoints [x0,y0,z0, x1,y1,z1, …] for LineSegmentsGeometry */
  positions: Float32Array
  /** rgb per endpoint, same layout — grayscale tape-brightness scatter */
  colors: Float32Array
}

/** Fat-line vertex work is the frame budget here; tiles frustum-cull it */
const TILE = 500
/** Sheds and rowhouse backs read as roof outlines in the film — no verticals */
const MIN_VERTICAL_H = 10

export function buildCity(data: CityData): {
  tiles: TapeTile[]
  solids: BufferGeometry
} {
  const { heights, ringStart, verts, shore } = data
  const n = heights.length

  // deterministic per-building scatter — stable across rebuilds
  const rand = (i: number) => {
    let t = (i + 1) * 0x6d2b79f5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // --- edges: roof ring + tall verticals, bucketed into cullable tiles ----
  // (segments land in the tile under their midpoint; bounding spheres are
  // computed from the real endpoints, so straddlers still cull correctly)
  const buckets = new Map<string, number[][]>()
  const seg = (
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    c0: number,
    c1 = c0,
  ) => {
    const key = `${Math.floor((x0 + x1) / 2 / TILE)},${Math.floor((z0 + z1) / 2 / TILE)}`
    let b = buckets.get(key)
    if (!b) {
      b = [[], []]
      buckets.set(key, b)
    }
    b[0].push(x0, y0, z0, x1, y1, z1)
    b[1].push(c0, c0, c0, c1, c1, c1)
  }

  // The model's tape was laid by hand under UV light that fell off toward
  // the streets: verticals fade as they descend, many stop partway, and
  // every strip has its own joint-to-joint unevenness. Same treatment —
  // through Bloom a dimming line also reads thinner, which stands in for
  // the taper the line renderer can't do per segment.
  const VERTICAL_STOP_CHANCE = 0.45
  for (let i = 0; i < n; i++) {
    const h = heights[i]
    const start = ringStart[i]
    const end = ringStart[i + 1]
    // the Twin Towers are the landing target — full tape, no fade lottery
    const hero = h > 400
    const bright = hero ? 1.15 : 0.45 + rand(i) * 0.75
    for (let v = start; v < end; v++) {
      const w = v + 1 === end ? start : v + 1
      const x0 = verts[v * 2]
      const z0 = -verts[v * 2 + 1]
      const x1 = verts[w * 2]
      const z1 = -verts[w * 2 + 1]
      // roof outline — the brightest tape, uneven strip to strip
      seg(x0, h, z0, x1, h, z1, bright * (0.85 + rand(v * 7 + 1) * 0.3))
      // vertical corner: dimmer, fading toward the street, often short
      if (h >= MIN_VERTICAL_H) {
        const r = rand(v * 13 + 5)
        const stop = !hero && r < VERTICAL_STOP_CHANCE ? h * (0.15 + r * 0.8) : 0
        const fade = hero ? 0.85 : 0.25 + rand(v * 29 + 11) * 0.45
        const top = bright * 0.8
        seg(x0, stop, z0, x0, h, z0, top * fade, top)
      }
    }
  }
  for (const line of shore) {
    for (let p = 0; p + 3 < line.length; p += 2) {
      seg(line[p], 1.5, -line[p + 1], line[p + 2], 1.5, -line[p + 3], 0.85)
    }
  }

  const tiles: TapeTile[] = [...buckets.values()].map((b) => ({
    positions: new Float32Array(b[0]),
    colors: new Float32Array(b[1]),
  }))

  // --- solids: walls + roof caps, pure occluders ---------------------------
  // count cap triangles first so the buffers allocate once
  const ringVerts = verts.length / 2
  const capTris: number[][] = []
  const rings: Vector2[][] = []
  let capTriCount = 0
  for (let i = 0; i < n; i++) {
    const ring: Vector2[] = []
    for (let v = ringStart[i]; v < ringStart[i + 1]; v++)
      ring.push(new Vector2(verts[v * 2], -verts[v * 2 + 1]))
    // triangulateShape wants CCW contours; earcut inside copes either way
    const tris = ShapeUtils.triangulateShape(ring, [])
    rings.push(ring)
    capTris.push(tris.flat())
    capTriCount += tris.length
  }

  const wallVertCount = ringVerts * 4
  const capVertCount = ringVerts
  const sPos = new Float32Array((wallVertCount + capVertCount) * 3)
  const idx = new Uint32Array(ringVerts * 6 + capTriCount * 3)
  let sv = 0
  let si = 0
  const putSolid = (x: number, y: number, z: number) => {
    sPos[sv * 3] = x
    sPos[sv * 3 + 1] = y
    sPos[sv * 3 + 2] = z
    return sv++
  }

  for (let i = 0; i < n; i++) {
    const h = heights[i]
    const ring = rings[i]
    const len = ring.length
    for (let v = 0; v < len; v++) {
      const a = ring[v]
      const b = ring[(v + 1) % len]
      const a0 = putSolid(a.x, 0, a.y)
      const b0 = putSolid(b.x, 0, b.y)
      const b1 = putSolid(b.x, h, b.y)
      const a1 = putSolid(a.x, h, a.y)
      idx[si++] = a0
      idx[si++] = b0
      idx[si++] = b1
      idx[si++] = a0
      idx[si++] = b1
      idx[si++] = a1
    }
    const capBase = sv
    for (const p of ring) putSolid(p.x, h, p.y)
    for (const t of capTris[i]) idx[si++] = capBase + t
  }

  const solids = new BufferGeometry()
  solids.setAttribute('position', new BufferAttribute(sPos, 3))
  solids.setIndex(new BufferAttribute(idx, 1))

  if (import.meta.env.DEV) {
    const holes = capTris.filter((t) => t.length === 0).length
    if (holes > 0)
      console.warn(`buildCity: ${holes} roof caps failed to triangulate`)
  }

  return { tiles, solids }
}
