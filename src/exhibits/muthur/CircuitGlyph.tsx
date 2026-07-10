import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, NearestFilter } from 'three'
import { generateGlyph, GLYPH_RADIUS, type GlyphRect } from './glyph'

const CANVAS_W = 512
const CANVAS_H = 384
// Cell size chosen so the full glyph fills the middle of the tube like the film
const CELL = Math.floor(CANVAS_H / (GLYPH_RADIUS * 2.4))

function fillMirrored(ctx: CanvasRenderingContext2D, r: GlyphRect) {
  const cx = CANVAS_W / 2
  const cy = CANVAS_H / 2
  const x = r.x * CELL
  const y = r.y * CELL
  const w = r.w * CELL
  const h = r.h * CELL
  ctx.fillRect(cx + x, cy - y - h, w, h)
  ctx.fillRect(cx - x - w, cy - y - h, w, h)
  ctx.fillRect(cx + x, cy + y, w, h)
  ctx.fillRect(cx - x - w, cy + y, w, h)
}

/** The wake-up circuit-mandala, drawn cumulatively onto a canvas texture. */
export function CircuitGlyph({ progress }: { progress: number }) {
  const viewport = useThree((s) => s.viewport)

  const state = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H
    const ctx = canvas.getContext('2d')!
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
      const r = events[state.drawn++]
      ctx.fillStyle = r.bright ? '#eafff4' : 'rgba(150, 240, 200, 0.7)'
      fillMirrored(ctx, r)
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
