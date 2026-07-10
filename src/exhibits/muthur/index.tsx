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
import fontUrl from '@/assets/fonts/VT323-Regular.ttf'
import { CircuitGlyph } from './CircuitGlyph'
import { CHARSET, COLS, ROWS } from './matrix'
import { INTERFACE_SCRIPT, respond } from './muthur'
import { useMuthurBoot, type Streak } from './useMuthurBoot'

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
      <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.18} luminanceSmoothing={0.35} />
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
        {/* Warm the SDF atlas while the glyph plays, so the storm's text
            renders from its first tick on cold loads. Own boundary so its
            font load never hides the glyph. */}
        <Suspense fallback={null}>
          <Text font={fontUrl} fontSize={0.001} fillOpacity={0} position={[0, 0, -1]}>
            {CHARSET}
          </Text>
        </Suspense>
      </>
    )
  }

  if (!ready) {
    return (
      <>
        <Screen text={boot.text} />
        <Streaks streaks={boot.streaks} />
      </>
    )
  }

  const rows = [...introLines, ...session].slice(-MAX_ROWS)
  const promptRow = online && !pending ? `\n> ${input}${cursorOn ? '█' : ' '}` : ''
  return <Screen text={rows.join('\n') + promptRow} />
}

function Screen({ text }: { text: string }) {
  const viewport = useThree((s) => s.viewport)
  const margin = viewport.width * 0.05
  const availW = viewport.width - margin * 2
  const availH = viewport.height - margin * 2
  // Fit the boot grid: ROWS lines tall, COLS monospace cells wide
  const fontSize = Math.min(availH / (ROWS * 1.32), availW / (COLS * 0.58))
  return (
    <Text
      font={fontUrl}
      fontSize={fontSize}
      color="#ffffff"
      anchorX="left"
      anchorY="top"
      lineHeight={1.32}
      letterSpacing={0.06}
      whiteSpace="nowrap"
      position={[-availW / 2, availH / 2, 0]}
    >
      {text}
    </Text>
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
