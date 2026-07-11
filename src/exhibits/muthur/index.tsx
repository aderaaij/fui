import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { AdditiveBlending } from 'three'
import { CRT } from '@/lib/crt/CRT'
import { HorizontalSmear } from '@/lib/crt/HorizontalSmear'
import { useCRTParams, useSmearParams } from '@/lib/crt/useCRTParams'
import { useBlink } from '@/lib/terminal/useBlink'
import { useBootSequence } from '@/lib/terminal/useBootSequence'
import fontUrl from '@/assets/fonts/graduate/Graduate-Regular.ttf'
import { CircuitGlyph } from './CircuitGlyph'
import {
  CHARSET,
  COLS,
  COLUMN_OFFSETS,
  MATRIX_ROWS,
  MATRIX_START_ROW,
  ROWS,
  TITLE,
  TITLE_ROW,
} from './matrix'
import { INTERFACE_SCRIPT, respond } from './muthur'
import {
  useMuthurBoot,
  type MatrixReveal,
  type StormFragment,
  type Streak,
} from './useMuthurBoot'

const MAX_ROWS = 16
const MAX_INPUT = 42
const REPLY_DELAY_MS = 650

export default function MuthurExhibit() {
  return (
    <Canvas flat dpr={[1, 2]} gl={{ antialias: false }}>
      <color attach="background" args={['#040604']} />
      <Suspense fallback={null}>
        <Terminal />
      </Suspense>
      <Effects />
    </Canvas>
  )
}

function Effects() {
  const crt = useCRTParams('greenPhosphor')
  const smear = useSmearParams()
  return (
    <EffectComposer>
      {/* Threshold sits above the glyph's midtone linework (~0.55 luminance)
          so only text, pads and HDR streaks glow — keeps the mandala crisp */}
      <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.5} luminanceSmoothing={0.3} />
      <HorizontalSmear {...smear} />
      <CRT {...crt} />
    </EffectComposer>
  )
}

function Terminal() {
  const boot = useMuthurBoot()
  const ready = boot.phase === 'ready'
  const { lines: introLines, done: online } = useBootSequence(INTERFACE_SCRIPT, ready)
  const [session, setSession] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  // The listener must stay attached across keystrokes (re-binding per input
  // change drops/duplicates fast typing), so it reads live values from refs.
  const inputRef = useRef('')
  const pendingRef = useRef(false)
  const replyTimeout = useRef(0)
  const cursorOn = useBlink()

  useEffect(() => () => window.clearTimeout(replyTimeout.current), [])

  useEffect(() => {
    if (!online) return
    const editInput = (edit: (v: string) => string) => {
      inputRef.current = edit(inputRef.current)
      setInput(inputRef.current)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || pendingRef.current) return
      if (e.key === 'Enter') {
        const inquiry = inputRef.current
        if (!inquiry.trim()) return
        setSession((s) => [...s, `> ${inquiry}`])
        editInput(() => '')
        pendingRef.current = true
        setPending(true)
        replyTimeout.current = window.setTimeout(() => {
          setSession((s) => [...s, ...respond(inquiry), ''])
          pendingRef.current = false
          setPending(false)
        }, REPLY_DELAY_MS)
      } else if (e.key === 'Backspace') {
        editInput((i) => i.slice(0, -1))
      } else if (e.key.length === 1) {
        editInput((i) => (i.length < MAX_INPUT ? i + e.key.toUpperCase() : i))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [online])

  if (boot.phase === 'glyph') {
    return (
      <>
        <CircuitGlyph progress={boot.glyphProgress} />
        {/* Warm the SDF atlas while the glyph plays, so the storm renders
            from its first tick on cold loads. Own boundary so the font load
            never hides the glyph. */}
        <Suspense fallback={null}>
          <Text font={fontUrl} fontSize={0.001} fillOpacity={0} position={[0, 0, -1]}>
            {CHARSET}
          </Text>
        </Suspense>
      </>
    )
  }

  // Each screen gets its own suspense boundary: if the font is still loading,
  // only that screen waits — suspending the top boundary would pause the
  // whole R3F frameloop (no CRT pass, black tube)
  if ((boot.phase === 'resolve' || boot.phase === 'stable') && boot.matrix) {
    return (
      <>
        <Suspense fallback={null}>
          <MatrixScreen reveal={boot.matrix} />
        </Suspense>
        <Streaks streaks={boot.streaks} />
      </>
    )
  }

  if (!ready) {
    return (
      <>
        <Suspense fallback={null}>
          <StormScreen fragments={boot.storm} />
        </Suspense>
        <Streaks streaks={boot.streaks} />
      </>
    )
  }

  const rows = [...introLines, ...session].slice(-MAX_ROWS)
  const prompt = online && !pending ? `> ${input}` : null
  return (
    <Suspense fallback={null}>
      <TerminalScreen lines={rows} prompt={prompt} cursorOn={cursorOn} />
    </Suspense>
  )
}

// Column x positions as fractions of content width, measured from frame 48
const COLUMN_FRACS = [0, 0.29, 0.55, 0.85]
// The film's screens use City Light "optically stretched" — same trick here
const STRETCH = 1.2

/** Shared type treatment for every screen on MU/TH/UR's tube. */
const screenText = (fontSize: number) =>
  ({
    font: fontUrl,
    fontSize,
    color: '#ffffff',
    anchorX: 'left',
    anchorY: 'top',
    lineHeight: 1.42,
    letterSpacing: 0.08,
    whiteSpace: 'nowrap',
  }) as const

/**
 * The OVERMONITORING ADDRESS MATRIX in Graduate (stand-in for the film's
 * stretched City Light). Graduate is proportional, so the matrix renders as
 * four positioned columns instead of relying on monospace padding; the
 * reveal still types left-to-right across the whole padded line.
 */
function MatrixScreen({ reveal }: { reveal: MatrixReveal }) {
  const viewport = useThree((s) => s.viewport)
  const availW = viewport.width * 0.88
  const availH = viewport.height * 0.88
  const fontSize = availH / (ROWS * 1.42)
  const rowH = fontSize * 1.42
  const contentW = availW / STRETCH
  const textProps = screenText(fontSize)

  const columns = COLUMN_OFFSETS.map((offset, k) =>
    MATRIX_ROWS.map((row, i) => {
      const cell = row[k]
      const revealed = Math.max(0, Math.min(cell.length, reveal.lineChars[i] - offset))
      return cell.slice(0, revealed)
    }).join('\n'),
  )

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      <Text {...textProps} position={[0, -rowH * TITLE_ROW, 0]}>
        {TITLE.slice(0, reveal.titleChars)}
      </Text>
      {columns.map((column, k) => (
        <Text key={k} {...textProps} position={[contentW * COLUMN_FRACS[k], -rowH * MATRIX_START_ROW, 0]}>
          {column}
        </Text>
      ))}
    </group>
  )
}

/**
 * The raster-noise storm. Each fragment sits on the 64-column grid at its
 * own position; the hot blocks are quads since Graduate has no █ glyph.
 */
function StormScreen({ fragments }: { fragments: StormFragment[] }) {
  const viewport = useThree((s) => s.viewport)
  const availW = viewport.width * 0.9
  const availH = viewport.height * 0.9
  const contentW = availW / STRETCH
  const cellW = contentW / COLS
  const rowH = availH / ROWS
  // Average Graduate cap advance is ~0.66em + 0.08 tracking → one cell
  const fontSize = Math.min(rowH / 1.2, cellW / 0.74)
  const textProps = screenText(fontSize)

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      {fragments.map((f) =>
        f.block ? (
          <mesh key={f.id} position={[(f.col + 0.75) * cellW, -(f.row + 0.5) * rowH, 0]}>
            <planeGeometry args={[cellW * 1.5, fontSize * 0.85]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        ) : (
          <Text key={f.id} {...textProps} position={[f.col * cellW, -f.row * rowH, 0]}>
            {f.text}
          </Text>
        ),
      )}
    </group>
  )
}

/**
 * Interface 2037 — the inquiry terminal, in the same stretched Graduate.
 * The block cursor is a quad placed after the prompt's measured text width
 * (troika reports it via onSync; Graduate has no █ glyph to type).
 */
function TerminalScreen({
  lines,
  prompt,
  cursorOn,
}: {
  lines: string[]
  prompt: string | null
  cursorOn: boolean
}) {
  const viewport = useThree((s) => s.viewport)
  const [caretX, setCaretX] = useState(0)
  const availW = viewport.width * 0.9
  const availH = viewport.height * 0.9
  const contentW = availW / STRETCH
  // Fit ROWS lines tall, and the widest script line (crew roster) across
  const fontSize = Math.min(availH / (ROWS * 1.42), contentW / 38)
  const rowH = fontSize * 1.42
  const promptY = -rowH * lines.length
  const textProps = screenText(fontSize)

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      <Text {...textProps}>{lines.join('\n')}</Text>
      {prompt !== null && (
        <>
          <Text
            {...textProps}
            position={[0, promptY, 0]}
            onSync={(t) => setCaretX(t.textRenderInfo.blockBounds[2])}
          >
            {prompt}
          </Text>
          <mesh position={[caretX + fontSize * 0.5, promptY - fontSize * 0.62, 0]} visible={cursorOn}>
            <planeGeometry args={[fontSize * 0.6, fontSize * 0.82]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  )
}

const STREAK_COLORS: Record<Streak['kind'], [number, number, number]> = {
  hair: [2.5, 2.5, 2.5],
  glow: [0.4, 3, 1.1],
  hot: [5, 5, 5],
}

const STREAK_HEIGHTS: Record<Streak['kind'], number> = {
  hair: 0.004,
  glow: 0.012,
  hot: 0.018,
}

/** The film's horizontal phosphor smears — bright quads fed to Bloom. */
function Streaks({ streaks }: { streaks: Streak[] }) {
  const viewport = useThree((s) => s.viewport)
  return (
    <group>
      {streaks.map((s) => (
        <mesh
          key={s.id}
          position={[
            (s.x + s.w / 2 - 0.5) * viewport.width,
            (0.5 - s.y) * viewport.height,
            0.1,
          ]}
        >
          <planeGeometry args={[s.w * viewport.width, STREAK_HEIGHTS[s.kind] * viewport.height]} />
          <meshBasicMaterial
            color={STREAK_COLORS[s.kind]}
            toneMapped={false}
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
