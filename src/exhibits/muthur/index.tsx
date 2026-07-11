import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { AdditiveBlending, Color } from 'three'
import { CRT } from '@/lib/crt/CRT'
import { HorizontalSmear } from '@/lib/crt/HorizontalSmear'
import { useCRTParams, useSmearParams } from '@/lib/crt/useCRTParams'
import { useBlink } from '@/lib/terminal/useBlink'
import fontUrl from '@/assets/fonts/graduate/Graduate-Regular.ttf'
import { CircuitGlyph } from './CircuitGlyph'
import {
  CHARSET,
  COLS,
  COLUMN_OFFSETS,
  INTERFACE_ROW,
  MATRIX_ROWS,
  MATRIX_START_ROW,
  ROWS,
  TITLE,
  TITLE_ROW,
} from './matrix'
import { INTERFACE_TITLE, respond } from './muthur'
import {
  useMuthurBoot,
  type BootPhase,
  type MatrixReveal,
  type StormFragment,
  type Streak,
} from './useMuthurBoot'

const MAX_ROWS = 16
const MAX_INPUT = 42
const REPLY_DELAY_MS = 650
/** Reply type-in speed, matched to the muthur-type-animation frames */
const TYPE_MS = 28
/** Beat between a line completing (rule lands) and the next one starting */
const LINE_HOLD_MS = 140

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

/** A completed line on the inquiry screen; ruled underneath like the film's */
interface TermLine {
  text: string
  rule: boolean
}

interface Typing {
  text: string
  shown: number
}

function Terminal() {
  const boot = useMuthurBoot()
  const { phase, chooseInterface } = boot
  const ready = phase === 'ready'
  const cursorOn = useBlink()

  // --- matrix selection ---------------------------------------------------
  // The rule walks the left address column first, then continues down the
  // right one; INTERFACE 2037 (left column) is the only live address
  const [selIndex, setSelIndex] = useState(0)
  const selRef = useRef(0)

  useEffect(() => {
    if (phase !== 'select') return
    const count = MATRIX_ROWS.length * 2
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : count - 1
        selRef.current = (selRef.current + step) % count
        setSelIndex(selRef.current)
      } else if (e.key === 'Enter' && selRef.current === INTERFACE_ROW) {
        chooseInterface()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, chooseInterface])

  // --- inquiry session ----------------------------------------------------
  // Lines land via a typewriter: queued replies reveal char by char behind a
  // hot write-head, and each completed statement gets ruled underneath —
  // per the muthur-type-animation reference frames.
  const [lines, setLines] = useState<TermLine[]>([])
  const [typing, setTyping] = useState<Typing | null>(null)
  const [input, setInput] = useState('')
  const [locked, setLocked] = useState(true)
  const [kick, setKick] = useState(0)
  const queueRef = useRef<string[]>([])
  const inputRef = useRef('')
  const lockedRef = useRef(true)
  const replyTimeout = useRef(0)

  useEffect(() => () => window.clearTimeout(replyTimeout.current), [])

  // Opening the record types the title in, then unlocks the prompt
  useEffect(() => {
    if (!ready) return
    queueRef.current = [INTERFACE_TITLE, '']
    setLines([])
    setTyping(null)
    setKick((k) => k + 1)
  }, [ready])

  // Queue driver: start the next line, or unlock input when drained
  useEffect(() => {
    if (!ready || typing) return
    const next = queueRef.current.shift()
    if (next === undefined) {
      setLocked(false)
      lockedRef.current = false
    } else if (next === '') {
      setLines((l) => [...l, { text: '', rule: false }])
      setKick((k) => k + 1)
    } else {
      setTyping({ text: next, shown: 0 })
    }
  }, [ready, typing, kick])

  // Reveal the typing line char by char
  const typingText = typing?.text
  useEffect(() => {
    if (typingText === undefined) return
    const id = window.setInterval(() => {
      setTyping((t) => (t && t.shown < t.text.length ? { ...t, shown: t.shown + 1 } : t))
    }, TYPE_MS)
    return () => window.clearInterval(id)
  }, [typingText])

  // A finished line holds a beat, then lands ruled and the queue advances
  useEffect(() => {
    if (!typing || typing.shown < typing.text.length) return
    const id = window.setTimeout(() => {
      setLines((l) => [...l, { text: typing.text, rule: true }])
      setTyping(null)
    }, LINE_HOLD_MS)
    return () => window.clearTimeout(id)
  }, [typing])

  // The listener must stay attached across keystrokes (re-binding per input
  // change drops/duplicates fast typing), so it reads live values from refs.
  useEffect(() => {
    if (locked) return
    const editInput = (edit: (v: string) => string) => {
      inputRef.current = edit(inputRef.current)
      setInput(inputRef.current)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || lockedRef.current) return
      if (e.key === 'Enter') {
        const inquiry = inputRef.current
        if (!inquiry.trim()) return
        setLines((l) => [...l, { text: inquiry, rule: true }])
        editInput(() => '')
        setLocked(true)
        lockedRef.current = true
        replyTimeout.current = window.setTimeout(() => {
          queueRef.current.push(...respond(inquiry), '')
          setKick((k) => k + 1)
        }, REPLY_DELAY_MS)
      } else if (e.key === 'Backspace') {
        editInput((i) => i.slice(0, -1))
      } else if (e.key.length === 1) {
        editInput((i) => (i.length < MAX_INPUT ? i + e.key.toUpperCase() : i))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [locked])

  // --- screens --------------------------------------------------------------

  if (phase === 'glyph') {
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
  if (
    (phase === 'resolve' ||
      phase === 'stable' ||
      phase === 'select' ||
      phase === 'chosen' ||
      phase === 'solo') &&
    boot.matrix
  ) {
    return (
      <>
        <Suspense fallback={null}>
          <MatrixScreen reveal={boot.matrix} phase={phase} selIndex={selIndex} />
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

  const visible = lines.slice(-MAX_ROWS)
  const active = typing ? typing.text.slice(0, typing.shown) : locked ? null : input
  const activeKind: 'typing' | 'input' | null = typing ? 'typing' : locked ? null : 'input'
  return (
    <Suspense fallback={null}>
      <TerminalScreen lines={visible} active={active} activeKind={activeKind} cursorOn={cursorOn} />
    </Suspense>
  )
}

// Column x positions as fractions of content width, measured from frame 48
const COLUMN_FRACS = [0, 0.29, 0.55, 0.85]
// The film's screens use City Light "optically stretched" — same trick here
const STRETCH = 1.2
// Average Graduate cap advance is ~0.66em + 0.08 tracking
const CHAR_W = 0.74

// Pure red is the CRT pass's marker ink: it prints as clean white with no
// bloom or smear — the selection rule stays a crisp straight line
const RULE_COLOR = new Color(1, 0, 0)
// The chosen pair burns brighter than the surrounding green
const HOT_TEXT = new Color(1.9, 1.9, 1.9)

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
 *
 * After the boot it stays up for selection: a white-hot rule under the
 * chosen address row ('select'), the pair burning bright ('chosen'), then
 * alone on the dark tube ('solo') — per muthur-matrix-selection frames.
 */
function MatrixScreen({
  reveal,
  phase,
  selIndex,
}: {
  reveal: MatrixReveal
  phase: Extract<BootPhase, 'resolve' | 'stable' | 'select' | 'chosen' | 'solo'>
  selIndex: number
}) {
  const viewport = useThree((s) => s.viewport)
  const availW = viewport.width * 0.88
  const availH = viewport.height * 0.88
  const fontSize = availH / (ROWS * 1.42)
  const rowH = fontSize * 1.42
  const contentW = availW / STRETCH
  const textProps = screenText(fontSize)
  const rowY = (i: number) => -rowH * (MATRIX_START_ROW + i)

  const columns = COLUMN_OFFSETS.map((offset, k) =>
    MATRIX_ROWS.map((row, i) => {
      // The chosen pair renders separately (bright), so blank it here
      if (phase === 'chosen' && i === INTERFACE_ROW && k < 2) return ''
      const cell = row[k]
      const revealed = Math.max(0, Math.min(cell.length, reveal.lineChars[i] - offset))
      return cell.slice(0, revealed)
    }).join('\n'),
  )

  // Rule geometry: label start through value end of the selected pair,
  // in whichever address column the selection has walked into
  const selRow = selIndex % MATRIX_ROWS.length
  const labelCol = selIndex < MATRIX_ROWS.length ? 0 : 2
  const sel = MATRIX_ROWS[selRow]
  const ruleX = contentW * COLUMN_FRACS[labelCol]
  const ruleEnd = sel[labelCol + 1]
    ? contentW * COLUMN_FRACS[labelCol + 1] + sel[labelCol + 1].length * fontSize * CHAR_W
    : ruleX + sel[labelCol].length * fontSize * CHAR_W
  const ruleW = ruleEnd - ruleX

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      {phase !== 'solo' && (
        <>
          <Text {...textProps} position={[0, -rowH * TITLE_ROW, 0]}>
            {TITLE.slice(0, reveal.titleChars)}
          </Text>
          {columns.map((column, k) => (
            <Text
              key={k}
              {...textProps}
              position={[contentW * COLUMN_FRACS[k], -rowH * MATRIX_START_ROW, 0]}
            >
              {column}
            </Text>
          ))}
        </>
      )}
      {phase === 'select' && (
        <mesh
          position={[ruleX + ruleW / 2, rowY(selRow) - fontSize * 1.16, 0.05]}
          scale={[ruleW, 1, 1]}
        >
          <planeGeometry args={[1, fontSize * 0.09]} />
          <meshBasicMaterial color={RULE_COLOR} toneMapped={false} />
        </mesh>
      )}
      {(phase === 'chosen' || phase === 'solo') && (
        <>
          <Text
            {...textProps}
            color={phase === 'chosen' ? HOT_TEXT : '#ffffff'}
            position={[0, rowY(INTERFACE_ROW), 0]}
          >
            {MATRIX_ROWS[INTERFACE_ROW][0]}
          </Text>
          <Text
            {...textProps}
            color={phase === 'chosen' ? HOT_TEXT : '#ffffff'}
            position={[contentW * COLUMN_FRACS[1], rowY(INTERFACE_ROW), 0]}
          >
            {MATRIX_ROWS[INTERFACE_ROW][1]}
          </Text>
        </>
      )}
    </group>
  )
}

// Fixed pools with stable keys: the storm re-rolls every 85ms tick, and
// remounting ~40 troika Texts per tick (each with fresh geometry/material)
// visibly stutters. Slots persist across ticks; only string/position change.
const TEXT_SLOTS = 46 // max bursts (23), each doubled by an interlace ghost
const BLOCK_SLOTS = 6

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
  const fontSize = Math.min(rowH / 1.2, cellW / CHAR_W)
  const textProps = screenText(fontSize)

  const texts: StormFragment[] = []
  const blocks: StormFragment[] = []
  for (const f of fragments) (f.block ? blocks : texts).push(f)

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      {Array.from({ length: TEXT_SLOTS }, (_, i) => {
        const f = texts[i]
        return (
          <Text
            key={i}
            {...textProps}
            visible={f !== undefined}
            position={f ? [f.col * cellW, -f.row * rowH, 0] : [0, 0, 0]}
          >
            {f?.text ?? ''}
          </Text>
        )
      })}
      {Array.from({ length: BLOCK_SLOTS }, (_, i) => {
        const b = blocks[i]
        return (
          <mesh
            key={i}
            visible={b !== undefined}
            position={b ? [(b.col + 0.75) * cellW, -(b.row + 0.5) * rowH, 0] : [0, 0, 0]}
          >
            <planeGeometry args={[cellW * 1.5, fontSize * 0.85]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * One inquiry-screen line: text plus the film's rule underneath completed
 * statements, sized to the measured text width (troika reports it on sync).
 */
function LineSlot({
  text,
  rule,
  y,
  fontSize,
  onWidth,
}: {
  text: string
  rule: boolean
  y: number
  fontSize: number
  onWidth?: (w: number) => void
}) {
  const [w, setW] = useState(0)
  const textProps = screenText(fontSize)
  return (
    <>
      <Text
        {...textProps}
        position={[0, y, 0]}
        onSync={(t: { textRenderInfo?: { blockBounds: number[] } }) => {
          const bw = t.textRenderInfo ? t.textRenderInfo.blockBounds[2] : 0
          setW(bw)
          onWidth?.(bw)
        }}
      >
        {text}
      </Text>
      <mesh
        visible={rule && w > 0}
        position={[w / 2, y - fontSize * 1.14, 0.05]}
        scale={[Math.max(w, 0.0001), 1, 1]}
      >
        <planeGeometry args={[1, fontSize * 0.07]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </>
  )
}

/**
 * Interface 2037 — the inquiry screen, styled from the muthur-type-animation
 * frames: small stretched type anchored top-left, completed lines ruled,
 * and a hot write-head block that trails the typing (or blinks for input;
 * Graduate has no █ glyph to type, so the cursor is a quad).
 */
function TerminalScreen({
  lines,
  active,
  activeKind,
  cursorOn,
}: {
  lines: TermLine[]
  active: string | null
  activeKind: 'typing' | 'input' | null
  cursorOn: boolean
}) {
  const viewport = useThree((s) => s.viewport)
  const [activeW, setActiveW] = useState(0)
  const availW = viewport.width * 0.9
  const availH = viewport.height * 0.9
  const contentW = availW / STRETCH
  const fontSize = Math.min(availH / (ROWS * 1.42), contentW / 43)
  const rowH = fontSize * 1.42
  // Headroom above the session, like the film's — also clears the HUD
  const topPad = rowH * 1.6
  const activeY = -topPad - rowH * lines.length
  const cursorVisible = active !== null && (activeKind === 'typing' || cursorOn)

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      {Array.from({ length: MAX_ROWS }, (_, i) => (
        <LineSlot
          key={i}
          text={lines[i]?.text ?? ''}
          rule={lines[i]?.rule ?? false}
          y={-topPad - rowH * i}
          fontSize={fontSize}
        />
      ))}
      <LineSlot key="active" text={active ?? ''} rule={false} y={activeY} fontSize={fontSize} onWidth={setActiveW} />
      <mesh
        visible={cursorVisible}
        position={[(active ? activeW : 0) + fontSize * 0.5, activeY - fontSize * 0.62, 0]}
      >
        <planeGeometry args={[fontSize * 0.6, fontSize * 0.82]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
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
