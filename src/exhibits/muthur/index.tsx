import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { CRT } from '@/lib/crt/CRT'
import { useCRTParams } from '@/lib/crt/useCRTParams'
import { useBlink } from '@/lib/terminal/useBlink'
import { useBootSequence } from '@/lib/terminal/useBootSequence'
import fontUrl from '@/assets/fonts/VT323-Regular.ttf'
import { BOOT_SCRIPT, respond } from './muthur'

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
  return (
    <EffectComposer>
      <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.18} luminanceSmoothing={0.35} />
      <CRT {...crt} />
    </EffectComposer>
  )
}

function Terminal() {
  const { lines: bootLines, done: booted } = useBootSequence(BOOT_SCRIPT)
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
    if (!booted) return
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
  }, [booted])

  const rows = [...bootLines, ...session].slice(-MAX_ROWS)
  const promptRow = booted && !pending ? `\n> ${input}${cursorOn ? '█' : ' '}` : ''
  return <Screen text={rows.join('\n') + promptRow} />
}

function Screen({ text }: { text: string }) {
  const viewport = useThree((s) => s.viewport)
  const fontSize = viewport.height / 21
  const margin = fontSize * 1.2
  return (
    <Text
      font={fontUrl}
      fontSize={fontSize}
      color="#ffffff"
      anchorX="left"
      anchorY="top"
      lineHeight={1.1}
      letterSpacing={0.02}
      maxWidth={viewport.width - margin * 2}
      overflowWrap="break-word"
      position={[-viewport.width / 2 + margin, viewport.height / 2 - margin, 0]}
    >
      {text}
    </Text>
  )
}
