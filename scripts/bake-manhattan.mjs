#!/usr/bin/env node
// Bake Lower Manhattan into the Gullfire nav's city asset.
//
// One-time (re-runnable) extract from OpenStreetMap via Overpass: building
// footprints + heights (NYC's own building data lives in OSM via the DoITT
// import), the island shoreline, and the piers. Projected to local meters
// around the World Trade Center, simplified, quantized, and written as
// flat arrays to src/exhibits/gullfire-nav/manhattan.json.
//
// The film is 1981, the data is today: buildings on the modern WTC
// superblock are deleted and the Twin Towers reinstated by hand.
//
//   node scripts/bake-manhattan.mjs
import { writeFile } from 'node:fs/promises'

// Battery to ~14th St, river to river. Buildings are filtered to the
// Manhattan borough area, so the bbox only trims the island.
const BBOX = [40.699, -74.03, 40.742, -73.962]
// Local origin: between the Twin Towers — the landing target.
const ORIGIN = { lon: -74.0128, lat: 40.7113 }

// Modern WTC superblock (One WTC, 3/4/7 WTC, Oculus, …) — cleared for 1981
const WTC_SITE = { s: 40.7086, w: -74.0151, n: 40.7157, e: -74.0092 }

// The Twin Towers: 63.4 m square plans centered on the memorial pools,
// 110 floors. Heights are structural (roof) height in meters.
const TOWER_SIDE = 63.4
const TWIN_TOWERS = [
  { lat: 40.7117, lon: -74.0131, h: 417 }, // 1 WTC (north)
  { lat: 40.7108, lon: -74.0124, h: 415 }, // 2 WTC (south)
]

const M_PER_DEG_LAT = 110_574
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180)
const toXY = (lon, lat) => [
  (lon - ORIGIN.lon) * M_PER_DEG_LON,
  (lat - ORIGIN.lat) * M_PER_DEG_LAT,
]

const QUERY = `
[out:json][timeout:180];
area["wikidata"="Q11299"]->.manhattan;
(
  way["building"](area.manhattan)(${BBOX});
);
out geom;
way["natural"="coastline"](${BBOX});
out geom;
way["man_made"="pier"](${BBOX});
out geom;
`

async function fetchOverpass() {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'fui-archive-bake/1.0 (one-time reference extract)',
    },
    body: 'data=' + encodeURIComponent(QUERY),
  })
  if (!res.ok) throw new Error(`overpass ${res.status}: ${await res.text()}`)
  return res.json()
}

/** meters, from OSM's assorted spellings; NaN when absent/unparsable */
function parseHeight(tags) {
  const raw = tags.height ?? tags['building:height']
  if (raw) {
    const m = /^([\d.]+)\s*(m|ft)?/.exec(raw.trim())
    if (m) return m[2] === 'ft' ? parseFloat(m[1]) * 0.3048 : parseFloat(m[1])
  }
  const levels = parseFloat(tags['building:levels'])
  if (Number.isFinite(levels)) return levels * 3.2 + 3
  return NaN
}

/** Drop sub-tolerance segments and near-collinear vertices (open or ring) */
function simplify(pts, tol = 1.5) {
  const kept = [pts[0]]
  for (const p of pts.slice(1)) {
    const last = kept[kept.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= tol) kept.push(p)
  }
  const out = []
  for (let i = 0; i < kept.length; i++) {
    const a = kept[(i - 1 + kept.length) % kept.length]
    const b = kept[i]
    const c = kept[(i + 1) % kept.length]
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    const len = Math.hypot(c[0] - a[0], c[1] - a[1])
    if (len === 0 || Math.abs(cross / len) > 0.6) out.push(b)
  }
  return out.length >= 3 ? out : kept
}

const data = await fetchOverpass()
const ways = data.elements.filter((e) => e.type === 'way' && e.geometry)

const buildings = []
const shore = []
const inWTC = (lat, lon) =>
  lat > WTC_SITE.s && lat < WTC_SITE.n && lon > WTC_SITE.w && lon < WTC_SITE.e

let noHeight = 0
for (const way of ways) {
  const tags = way.tags ?? {}
  if (tags.building) {
    const cLat = way.geometry.reduce((s, p) => s + p.lat, 0) / way.geometry.length
    const cLon = way.geometry.reduce((s, p) => s + p.lon, 0) / way.geometry.length
    if (inWTC(cLat, cLon)) continue
    let h = parseHeight(tags)
    if (!Number.isFinite(h)) {
      noHeight++
      h = 12
    }
    // closed way repeats its first node — drop the duplicate before simplify
    const ring = simplify(way.geometry.slice(0, -1).map((p) => toXY(p.lon, p.lat)))
    if (ring.length >= 3) buildings.push({ h, ring })
  } else {
    // shoreline / pier — keep polylines near the island, not the far banks
    shore.push(way.geometry.map((p) => toXY(p.lon, p.lat)))
  }
}

// Reinstate the Twin Towers
for (const t of TWIN_TOWERS) {
  const [cx, cy] = toXY(t.lon, t.lat)
  const s = TOWER_SIDE / 2
  buildings.push({
    h: t.h,
    ring: [
      [cx - s, cy - s],
      [cx + s, cy - s],
      [cx + s, cy + s],
      [cx - s, cy + s],
    ],
  })
}

// Keep shore points within reach of the island's buildings (drops the
// Brooklyn and Jersey banks that the bbox clips). Coarse grid over building
// centroids, exact distance check against nearby cells.
const CELL = 250
const NEAR = 450
const grid = new Map()
for (const b of buildings) {
  const cx = b.ring.reduce((s, p) => s + p[0], 0) / b.ring.length
  const cy = b.ring.reduce((s, p) => s + p[1], 0) / b.ring.length
  const key = `${Math.floor(cx / CELL)},${Math.floor(cy / CELL)}`
  if (!grid.has(key)) grid.set(key, [])
  grid.get(key).push([cx, cy])
}
const nearIsland = ([x, y]) => {
  const gx = Math.floor(x / CELL)
  const gy = Math.floor(y / CELL)
  const r = Math.ceil(NEAR / CELL)
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++)
      for (const [cx, cy] of grid.get(`${gx + dx},${gy + dy}`) ?? [])
        if (Math.hypot(x - cx, y - cy) < NEAR) return true
  return false
}

const shoreLines = []
for (const line of shore) {
  // split each way into runs of near-island points, simplified like rings
  let run = []
  for (const p of line) {
    if (nearIsland(p)) {
      run.push(p)
    } else {
      if (run.length > 1) shoreLines.push(run)
      run = []
    }
  }
  if (run.length > 1) shoreLines.push(run)
}

// --- pack: flat arrays, integer meters ------------------------------------
const heights = []
const ringStart = [0]
const verts = []
for (const b of buildings) {
  heights.push(Math.max(3, Math.round(b.h)))
  for (const [x, y] of b.ring) verts.push(Math.round(x), Math.round(y))
  ringStart.push(verts.length / 2)
}
const shorePacked = shoreLines.map((line) =>
  line.flatMap(([x, y]) => [Math.round(x), Math.round(y)]),
)

const out = {
  v: 1,
  origin: [ORIGIN.lon, ORIGIN.lat],
  heights,
  ringStart,
  verts,
  shore: shorePacked,
}

const path = new URL('../src/exhibits/gullfire-nav/manhattan.json', import.meta.url)
await writeFile(path, JSON.stringify(out))

const bytes = JSON.stringify(out).length
console.log(`buildings: ${buildings.length} (${noHeight} defaulted to 12m)`)
console.log(`ring vertices: ${verts.length / 2}`)
console.log(`shore polylines: ${shoreLines.length} (${shorePacked.reduce((s, l) => s + l.length / 2, 0)} pts)`)
console.log(`tallest: ${Math.max(...heights)}m`)
console.log(`wrote ${(bytes / 1024).toFixed(0)} KB → src/exhibits/gullfire-nav/manhattan.json`)
