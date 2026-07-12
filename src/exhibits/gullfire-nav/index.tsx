import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MathUtils,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { useControls } from 'leva'
import { CRT } from '@/lib/crt/CRT'
import { HorizontalSmear } from '@/lib/crt/HorizontalSmear'
import { useCRTParams, useSmearParams } from '@/lib/crt/useCRTParams'
import { disposeGullfireAudio, initGullfireAudio } from './audio'
import fontUrl from '@/assets/fonts/dseg14/DSEG14Classic-Regular.ttf'
import cityUrl from './manhattan.json?url'
import { buildCity, type CityData, type TapeTile } from './city'

// --- the approach -----------------------------------------------------------
// Snake launches from Liberty Island Security Control, so the approach
// rides the Liberty→WTC bearing: in low over black harbor water from the
// southwest, the Battery and its piers resolving out of the dark, the
// towers dead ahead the whole way with the Financial District rising
// behind them. Start is pulled to ~2.3km out so the island glows from
// frame one. Meters; x = east, z = -north, y = up.
const START = new Vector3(-1735, 640, 1585)
const END = new Vector3(-162, 470, 148)
const DURATION = 34
/** How far the pilot can slip the approach line sideways */
const MAX_SLIP = 320

const DIR = END.clone().sub(START).normalize()
const SIDE = new Vector3(-DIR.z, 0, DIR.x).normalize()
const SPEED_MS = START.distanceTo(END) / DURATION

// Gentle nose-down attitude (~28°): over water a steep stare shows nothing,
// so the glass holds the island edge low and the towers high all approach
const LOOK_AHEAD = DIR.clone().multiplyScalar(600).add(new Vector3(0, -280, 0))
// Over the last stretch the nose flares up onto the landing pad — the
// North Tower roof — so the target actually fills the glass on arrival
const TOWER_ROOF = new Vector3(0, 425, 0)
const FLARE_START = 0.8
const FLARE_FULL = 0.97

const CITY_GREEN = '#3fffa0'
const HUD_BLUE = new Color(0.5, 1.0, 2.3)
const HUD_MID = new Color(0.42, 0.85, 1.9)

// The overlay's video bleed, dialed for the HUD: a short, faint drag just
// past the letterforms. The smear taps the post-Bloom buffer, so only the
// HUD (and the very hottest tape clusters) clear the threshold.
const GULLFIRE_SMEAR = { intensity: 0.2, threshold: 1, length: 0.04 }

export default function GullfireExhibit() {
  useEffect(() => {
    initGullfireAudio()
    return disposeGullfireAudio
  }, [])
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ antialias: false, depth: false, stencil: false }}
      camera={{ fov: 55, near: 2, far: 7000, position: START.toArray() }}
      onCreated={(state) => {
        if (import.meta.env.DEV)
          (window as unknown as Record<string, unknown>).__gullfire = state
      }}
    >
      <color attach="background" args={['#020403']} />
      <fog attach="fog" args={['#020403', 700, 3600]} />
      <City />
      <Flight />
      <Effects />
    </Canvas>
  )
}

function Effects() {
  const crt = useCRTParams('colorTube')
  const smear = useSmearParams('gullfire', GULLFIRE_SMEAR)
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={1.05}
        luminanceThreshold={0.4}
        luminanceSmoothing={0.25}
      />
      <HorizontalSmear {...smear} />
      <CRT {...crt} />
    </EffectComposer>
  )
}

/** Black mass + taped edges, straight from the baked survey. */
function City() {
  const [geo, setGeo] = useState<{
    tiles: TapeTile[]
    solids: BufferGeometry
  } | null>(null)
  const size = useThree((s) => s.size)

  // The tape has physical width — near edges render fat, distant ones
  // hairline, like the model's. Meters, live-tunable against the frames.
  const { tapeWidth } = useControls('city', {
    tapeWidth: { value: 1.3, min: 0.2, max: 4, step: 0.05 },
  })

  useEffect(() => {
    let disposed = false
    let solids: BufferGeometry | null = null
    void fetch(cityUrl)
      .then((r) => r.json())
      .then((data: CityData) => {
        if (disposed) return
        const g = buildCity(data)
        solids = g.solids
        setGeo(g)
      })
    return () => {
      disposed = true
      solids?.dispose()
    }
  }, [])

  // One material across all tiles; each tile is its own LineSegments2 so
  // the fat-line vertex shader only runs for tiles inside the frustum —
  // the whole island in one object blew the 8.3ms frame budget.
  const tape = useMemo(() => {
    if (!geo) return null
    const mat = new LineMaterial({
      color: new Color(CITY_GREEN),
      vertexColors: true,
      worldUnits: true,
      linewidth: 1.3,
      fog: true,
    })
    const objects = geo.tiles.map((tile) => {
      const lineGeo = new LineSegmentsGeometry()
      lineGeo.setPositions(tile.positions)
      lineGeo.setColors(tile.colors)
      lineGeo.computeBoundingSphere()
      return new LineSegments2(lineGeo, mat)
    })
    return { mat, objects }
  }, [geo])

  useEffect(
    () => () => {
      if (!tape) return
      for (const o of tape.objects) o.geometry.dispose()
      tape.mat.dispose()
    },
    [tape],
  )

  useEffect(() => {
    if (!tape) return
    tape.mat.linewidth = tapeWidth
    tape.mat.resolution.set(size.width, size.height)
  }, [tape, tapeWidth, size])

  if (!geo || !tape) return null
  return (
    <group>
      {/* faces swallow light — they exist to hide tape behind them.
          DoubleSide: OSM rings arrive in either winding, so single-sided
          caps/walls would cull away on half the buildings and let the
          tape behind show through. */}
      <mesh geometry={geo.solids}>
        <meshBasicMaterial
          color="#000000"
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      {tape.objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  )
}

interface TroikaText {
  text: string
  sync: () => void
}

/**
 * Flies the approach and carries the HUD. Arrow keys slip the glide line
 * sideways — the frame banks into the correction — and the readouts are
 * live flight data, not a transcription.
 */
function Flight() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const slipTarget = useRef(0)
  const slip = useRef(0)
  const altRef = useRef<TroikaText>(null)
  const airRef = useRef<TroikaText>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const step = e.key === 'ArrowLeft' ? -40 : 40
        slipTarget.current = MathUtils.clamp(
          slipTarget.current + step,
          -MAX_SLIP,
          MAX_SLIP,
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pos = useRef(new Vector3())
  const look = useRef(new Vector3())
  useFrame(({ clock }, delta) => {
    const t = (clock.getElapsedTime() % DURATION) / DURATION
    slip.current = MathUtils.damp(slip.current, slipTarget.current, 1.6, delta)

    pos.current.lerpVectors(START, END, t)
    pos.current.addScaledVector(SIDE, slip.current)
    look.current.copy(pos.current).add(LOOK_AHEAD)
    look.current.lerp(TOWER_ROOF, MathUtils.smoothstep(t, FLARE_START, FLARE_FULL))
    // the nose leads the slip a touch, so corrections read as banking
    look.current.addScaledVector(SIDE, (slipTarget.current - slip.current) * 0.4)

    camera.position.copy(pos.current)
    camera.lookAt(look.current)
    camera.rotateZ((slipTarget.current - slip.current) * 0.0011)

    // The film's formats: altitude in thousands of feet ("ALT. 1.95"),
    // airspeed as a bare pair of digits ("AIR..55") — ours read live
    if (altRef.current) {
      const kft = (pos.current.y * 3.2808) / 1000
      const next = `ALT. ${kft.toFixed(2)}`
      if (altRef.current.text !== next) {
        altRef.current.text = next
        altRef.current.sync()
      }
    }
    if (airRef.current) {
      const ms = Math.round(SPEED_MS + Math.sin(clock.getElapsedTime() * 1.3) * 1.5)
      const next = `AIR..${ms}`
      if (airRef.current.text !== next) {
        airRef.current.text = next
        airRef.current.sync()
      }
    }
  })

  return (
    <primitive object={camera}>
      <HUD altRef={altRef} airRef={airRef} />
    </primitive>
  )
}

/** Distance of the HUD plane in front of the lens (> camera near) */
const HUD_D = 3

/**
 * The reticle, transcribed from the film frame. Vertical: long solid runs
 * with pinpoint breaks at each rung; the ends are corner arms — at the top
 * the axis bends right into two marching dashes, mirrored to the left at
 * the bottom — with a medium arm and a small tick between each corner and
 * center. Horizontal: one tall end bar per side, broken just under the
 * crossing, and the dash row leaves the bar immediately — long dashes
 * shrinking to a run of dots through the middle. The frame reads point-
 * symmetric in intent but not in measurement; the raster's asymmetry is
 * kept. Sizes in units of HUD height. Rects as [cx, cy, w, h].
 */
function crosshairRects(h: number): [number, number, number, number][] {
  const t = 0.004 * h
  const rung = 0.005 * h
  const cy = -0.025 * h
  const r: [number, number, number, number][] = []

  // vertical axis: solid segments, gapped where the rungs land
  const segs: [number, number][] = [
    [0.218, 0.15],
    [0.144, 0.092],
    [0.076, -0.052],
    [-0.068, -0.128],
    [-0.142, -0.199],
  ]
  for (const [a, b] of segs) {
    r.push([0, cy + ((a + b) / 2) * h, t, (a - b) * h])
  }

  // corner arms: two dashes level with the axis end, right at the top,
  // left at the bottom
  r.push([0.015 * h, cy + 0.2155 * h, 0.026 * h, rung])
  r.push([0.051 * h, cy + 0.2155 * h, 0.026 * h, rung])
  r.push([-0.015 * h, cy - 0.1965 * h, 0.026 * h, rung])
  r.push([-0.051 * h, cy - 0.1965 * h, 0.026 * h, rung])

  // the ladder between: medium arm, then a small tick nearer center
  r.push([0.0205 * h, cy + 0.149 * h, 0.041 * h, rung])
  r.push([0.012 * h, cy + 0.084 * h, 0.02 * h, rung])
  r.push([-0.012 * h, cy - 0.059 * h, 0.02 * h, rung])
  r.push([-0.019 * h, cy - 0.133 * h, 0.038 * h, rung])

  // end bars: tall, one per side, the raster's break just under the row
  for (const s of [-1, 1]) {
    r.push([s * 0.334 * h, cy + 0.0275 * h, t, 0.063 * h])
    r.push([s * 0.334 * h, cy - 0.034 * h, t, 0.048 * h])
  }

  // dash row: leaves the bar long, shrinks to dots through the middle
  const clear = 0.006 * h
  for (const s of [-1, 1]) {
    let x = 0.33 * h
    let w = 0.054 * h
    while (x - w > clear) {
      r.push([s * (x - w / 2), cy, w, 0.0038 * h])
      x -= w + MathUtils.clamp(w * 0.2, 0.007 * h, 0.01 * h)
      w = Math.max(0.004 * h, w * 0.7)
    }
  }
  return r
}

function buildRectsGeometry(rects: [number, number, number, number][]) {
  const pos = new Float32Array(rects.length * 12)
  const idx = new Uint16Array(rects.length * 6)
  rects.forEach(([cx, cy, w, h], i) => {
    const p = i * 12
    pos.set(
      [
        cx - w / 2, cy - h / 2, 0,
        cx + w / 2, cy - h / 2, 0,
        cx + w / 2, cy + h / 2, 0,
        cx - w / 2, cy + h / 2, 0,
      ],
      p,
    )
    const v = i * 4
    idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6)
  })
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setIndex(new BufferAttribute(idx, 1))
  return geo
}

/**
 * The overlay, laid out from the reference frames: NOSE VIEW up top, a
 * center guide line with a glide bar, live ALT / AIR beneath it. Fixed to
 * the camera so it rides every bank.
 */
function HUD({
  altRef,
  airRef,
}: {
  altRef: React.Ref<TroikaText>
  airRef: React.Ref<TroikaText>
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const h = 2 * Math.tan(MathUtils.degToRad(camera.fov) / 2) * HUD_D

  const cross = useMemo(() => buildRectsGeometry(crosshairRects(h)), [h])
  useEffect(() => () => cross.dispose(), [cross])

  // DSEG14 runs wide and tall for its em — sized down from the VT323 fit.
  // Layout measured off the film frame: title just above the reticle,
  // readouts flanking its foot, everything hung on the screen's midline.
  const text = {
    font: fontUrl,
    anchorX: 'center',
    anchorY: 'middle',
    letterSpacing: 0.08,
  } as const

  return (
    <group position={[0, 0, -HUD_D]}>
      <Suspense fallback={null}>
        <Text
          {...text}
          fontSize={0.05 * h}
          color={HUD_BLUE}
          position={[0, 0.269 * h, 0]}
        >
          NOSE VIEW
        </Text>
        <Text
          ref={altRef}
          {...text}
          fontSize={0.042 * h}
          color={HUD_BLUE}
          position={[-0.19 * h, -0.342 * h, 0]}
        >
          ALT. 0.00
        </Text>
        <Text
          ref={airRef}
          {...text}
          fontSize={0.042 * h}
          color={HUD_BLUE}
          position={[0.19 * h, -0.342 * h, 0]}
        >
          AIR..00
        </Text>
      </Suspense>
      <mesh geometry={cross}>
        <meshBasicMaterial color={HUD_MID} />
      </mesh>
    </group>
  )
}
