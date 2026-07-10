import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, NearestFilter } from 'three'
import { generateGlyph, type GlyphEvent } from './glyph'

const CANVAS_W = 1200
const CANVAS_H = 900
/** Canvas px per trace unit */
const S = 4
/** Dead zone along the axes — the dark cross at the mandala's center */
const GAP = 2

const MIRRORS: [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]

function drawEvent(ctx: CanvasRenderingContext2D, e: GlyphEvent) {
  const cx = CANVAS_W / 2
  const cy = CANVAS_H / 2
  for (const [mx, my] of MIRRORS) {
    if (e.kind === 'stroke') {
      ctx.beginPath()
      ctx.moveTo(cx + mx * (e.x1 + GAP) * S, cy - my * (e.y1 + GAP) * S)
      ctx.lineTo(cx + mx * (e.x2 + GAP) * S, cy - my * (e.y2 + GAP) * S)
      ctx.stroke()
    } else {
      const xa = cx + mx * (e.x + GAP) * S
      const xb = cx + mx * (e.x + GAP + e.w) * S
      const ya = cy - my * (e.y + GAP) * S
      const yb = cy - my * (e.y + GAP + e.h) * S
      ctx.fillRect(Math.min(xa, xb), Math.min(ya, yb), Math.abs(xb - xa), Math.abs(yb - ya))
    }
  }
}

/** The wake-up circuit-mandala, drawn cumulatively onto a canvas texture. */
export function CircuitGlyph({ progress }: { progress: number }) {
  const viewport = useThree((s) => s.viewport)

  const state = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2
    ctx.lineCap = 'square'
    ctx.strokeStyle = '#84cba6'
    ctx.fillStyle = '#e2fff0'
    const texture = new CanvasTexture(canvas)
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.generateMipmaps = false
    return { ctx, texture, events: generateGlyph(), drawn: 0 }
  }, [])

  useEffect(() => () => state.texture.dispose(), [state])

  useEffect(() => {
    const { ctx, texture, events } = state
    while (state.drawn < events.length && events[state.drawn].t <= progress) {
      drawEvent(ctx, events[state.drawn++])
    }
    texture.needsUpdate = true
  }, [progress, state])

  return (
    <mesh>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <meshBasicMaterial map={state.texture} transparent toneMapped={false} />
    </mesh>
  )
}
