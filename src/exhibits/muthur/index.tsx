import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  Color,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { CRT } from "@/lib/crt/CRT";
import { HorizontalSmear } from "@/lib/crt/HorizontalSmear";
import { useCRTParams, useSmearParams } from "@/lib/crt/useCRTParams";
import { useBlink } from "@/lib/terminal/useBlink";
import fontUrl from "@/assets/fonts/graduate/Graduate-Regular.ttf";
import { CircuitGlyph } from "./CircuitGlyph";
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
} from "./matrix";
import { isMuted } from "@/lib/sound";
import {
  disposeMuthurAudio,
  initMuthurAudio,
  playSfx,
  playTypeLine,
} from "./audio";
import { INTERFACE_TITLE, respond } from "./muthur";
import "./boot-gate.css";
import {
  useMuthurBoot,
  type BootPhase,
  type MatrixReveal,
  type StormFragment,
  type Streak,
} from "./useMuthurBoot";

const MAX_ROWS = 16;
const MAX_INPUT = 42;
const REPLY_DELAY_MS = 650;
/** Reply type-in speed, matched to the muthur-type-animation frames */
const TYPE_MS = 28;
/** Beat between a line completing (rule lands) and the next one starting */
const LINE_HOLD_MS = 140;
// Every printed line is announced by a hot full-width bar at its row that
// collapses back into the left margin before type-in starts (frames 14-17)
const PRINT_FLASH_MS = 90;
const PRINT_COLLAPSE_MS = 120;
const PRINT_LEAD_MS = PRINT_FLASH_MS + PRINT_COLLAPSE_MS;

// Direct visits carry no user activation, so the boot would play silent —
// hold it behind a power switch instead. Arrivals from the archive index
// already clicked, muted visitors chose silence, dev pins skip the boot:
// all three power on unprompted.
function needsBootGate() {
  if (isMuted()) return false;
  if (new URLSearchParams(window.location.search).has("boot")) return false;
  return !(navigator.userActivation?.hasBeenActive ?? true);
}

export default function MuthurExhibit() {
  const [gated, setGated] = useState(needsBootGate);
  return (
    <>
      {/* depth/stencil off: the default framebuffer only ever receives the
          composer's final fullscreen quad — the scene renders into the
          composer's own targets, which carry their own depth */}
      <Canvas
        flat
        dpr={[1, 2]}
        gl={{ antialias: false, depth: false, stencil: false }}
      >
        <color attach="background" args={["#040604"]} />
        <Suspense fallback={null}>
          <Terminal hold={gated} />
        </Suspense>
        <Effects />
      </Canvas>
      {gated && (
        <div className="muthur-boot-gate">
          <button
            type="button"
            autoFocus
            onClick={(e) => {
              // Return focus to the exhibit — terminals listen on window.
              // The terminal already initialized audio (suspended); this
              // click's pointerdown resumed it via the unlock listener.
              // init here only covers the terminal not having mounted yet.
              e.currentTarget.blur();
              initMuthurAudio();
              setGated(false);
            }}
          >
            POWER ON
          </button>
        </div>
      )}
    </>
  );
}

function Effects() {
  const crt = useCRTParams("greenPhosphor");
  const smear = useSmearParams();
  return (
    // multisampling defaults to 8x MSAA — pure cost here: the scene is SDF
    // text and axis-aligned quads, and the CRT pass resamples the whole
    // buffer through barrel distortion anyway
    <EffectComposer multisampling={0}>
      {/* Threshold sits above the glyph's midtone linework (~0.55 luminance)
          so only text, pads and HDR streaks glow — keeps the mandala crisp */}
      <Bloom
        mipmapBlur
        intensity={0.9}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.3}
      />
      <HorizontalSmear {...smear} />
      <CRT {...crt} />
    </EffectComposer>
  );
}

/** A completed line on the inquiry screen; ruled underneath like the film's */
interface TermLine {
  text: string;
  rule: boolean;
}

interface Typing {
  text: string;
  shown: number;
  /** Type-in starts once the print bar has collapsed (performance.now ms) */
  holdUntil: number;
}

function Terminal({ hold }: { hold: boolean }) {
  const boot = useMuthurBoot(hold);
  const { phase, chooseInterface } = boot;
  const ready = phase === "ready";
  const cursorOn = useBlink();

  useEffect(() => {
    initMuthurAudio();
    return disposeMuthurAudio;
  }, []);

  // The film's own audio, cut from the clips the phase lengths were timed
  // against — each cue runs exactly its phase (see ./audio.ts). Behind the
  // power switch the phase idles at 'glyph', so the cue must wait for the
  // hold to lift — at mount it would fire early and go stale by the click.
  useEffect(() => {
    if (hold) return;
    if (phase === "glyph") playSfx("bootGlyph", 0.7);
    else if (phase === "storm") playSfx("bootMatrix", 0.7);
    else if (phase === "chosen") playSfx("selectConfirm", 0.7);
  }, [phase, hold]);

  // --- matrix selection ---------------------------------------------------
  // The rule walks the left address column first, then continues down the
  // right one; INTERFACE 2037 (left column) is the only live address
  const [selIndex, setSelIndex] = useState(0);
  const selRef = useRef(0);

  useEffect(() => {
    if (phase !== "select") return;
    const count = MATRIX_ROWS.length * 2;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : count - 1;
        selRef.current = (selRef.current + step) % count;
        setSelIndex(selRef.current);
        playSfx("selectMove", 0.4);
      } else if (e.key === "Enter" && selRef.current === INTERFACE_ROW) {
        chooseInterface();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, chooseInterface]);

  // --- inquiry session ----------------------------------------------------
  // Lines land via a typewriter: queued replies reveal char by char behind a
  // hot write-head, and each completed statement gets ruled underneath —
  // per the muthur-type-animation reference frames.
  const [lines, setLines] = useState<TermLine[]>([]);
  const [typing, setTyping] = useState<Typing | null>(null);
  const [input, setInput] = useState("");
  const [locked, setLocked] = useState(true);
  const [kick, setKick] = useState(0);
  const [pulse, setPulse] = useState(0);
  const queueRef = useRef<string[]>([]);
  const inputRef = useRef("");
  const lockedRef = useRef(true);
  const replyTimeout = useRef(0);

  useEffect(() => () => window.clearTimeout(replyTimeout.current), []);

  // Opening the record types the title in, then unlocks the prompt
  useEffect(() => {
    if (!ready) return;
    queueRef.current = [INTERFACE_TITLE, ""];
    setLines([]);
    setTyping(null);
    setKick((k) => k + 1);
  }, [ready]);

  // Queue driver: start the next line, or unlock input when drained
  useEffect(() => {
    if (!ready || typing) return;
    const next = queueRef.current.shift();
    if (next === undefined) {
      setLocked(false);
      lockedRef.current = false;
    } else if (next === "") {
      setLines((l) => [...l, { text: "", rule: false }]);
      setKick((k) => k + 1);
    } else {
      // Claim the slot synchronously — a deferred setTyping leaves a window
      // where a re-entrant run (kick bumps) drains the queue early. The
      // reveal interval sits out the hold while the print bar plays.
      setTyping({
        text: next,
        shown: 0,
        holdUntil: performance.now() + PRINT_LEAD_MS,
      });
      playTypeLine(0.55);
    }
  }, [ready, typing, kick]);

  // Reveal the typing line char by char, once the print bar has collapsed
  const typingText = typing?.text;
  useEffect(() => {
    if (typingText === undefined) return;
    const id = window.setInterval(() => {
      setTyping((t) =>
        t && t.shown < t.text.length && performance.now() >= t.holdUntil
          ? { ...t, shown: t.shown + 1 }
          : t,
      );
    }, TYPE_MS);
    return () => window.clearInterval(id);
  }, [typingText]);

  // A finished line holds a beat, then lands and the queue advances. Only
  // the last line of a statement gets ruled — the film leaves wrap lines
  // bare ("REQUEST CLARIFICATION ON" never gains one)
  useEffect(() => {
    if (!typing || typing.shown < typing.text.length) return;
    const id = window.setTimeout(() => {
      const rule = queueRef.current.length === 0 || queueRef.current[0] === "";
      setLines((l) => [...l, { text: typing.text, rule }]);
      setTyping(null);
    }, LINE_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [typing]);

  // The listener must stay attached across keystrokes (re-binding per input
  // change drops/duplicates fast typing), so it reads live values from refs.
  useEffect(() => {
    if (locked) return;
    const editInput = (edit: (v: string) => string) => {
      inputRef.current = edit(inputRef.current);
      setInput(inputRef.current);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || lockedRef.current) return;
      if (e.key === "Enter") {
        const inquiry = inputRef.current;
        if (!inquiry.trim()) return;
        setLines((l) => [...l, { text: inquiry, rule: true }]);
        editInput(() => "");
        setLocked(true);
        lockedRef.current = true;
        // Scripted answers land on the film's reply beat; model answers
        // land when the Worker returns (the beat is the minimum hold)
        const asked = performance.now();
        void respond(inquiry).then((reply) => {
          const wait = Math.max(0, REPLY_DELAY_MS - (performance.now() - asked));
          replyTimeout.current = window.setTimeout(() => {
            // Blank row between inquiry and answer, as in the film
            queueRef.current.push("", ...reply, "");
            setKick((k) => k + 1);
          }, wait);
        });
      } else if (e.key === "Backspace") {
        editInput((i) => i.slice(0, -1));
        setPulse((p) => p + 1);
        playSfx("selectMove", 0.18);
      } else if (e.key.length === 1) {
        editInput((i) => (i.length < MAX_INPUT ? i + e.key.toUpperCase() : i));
        setPulse((p) => p + 1);
        playSfx("selectMove", 0.18);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked]);

  // --- screens --------------------------------------------------------------

  if (phase === "glyph") {
    return (
      <>
        <CircuitGlyph progress={boot.glyphProgress} />
        {/* Warm the SDF atlas while the glyph plays, so the storm renders
            from its first tick on cold loads. Own boundary so the font load
            never hides the glyph. */}
        <Suspense fallback={null}>
          <Text
            font={fontUrl}
            fontSize={0.001}
            fillOpacity={0}
            position={[0, 0, -1]}
          >
            {CHARSET}
          </Text>
        </Suspense>
      </>
    );
  }

  // Each screen gets its own suspense boundary: if the font is still loading,
  // only that screen waits — suspending the top boundary would pause the
  // whole R3F frameloop (no CRT pass, black tube)
  if (
    (phase === "resolve" ||
      phase === "stable" ||
      phase === "select" ||
      phase === "chosen" ||
      phase === "solo") &&
    boot.matrix
  ) {
    return (
      <>
        <Suspense fallback={null}>
          <MatrixScreen
            reveal={boot.matrix}
            phase={phase}
            selIndex={selIndex}
          />
        </Suspense>
        <Streaks streaks={boot.streaks} />
      </>
    );
  }

  if (!ready) {
    return (
      <>
        <Suspense fallback={null}>
          <StormScreen fragments={boot.storm} />
        </Suspense>
        <Streaks streaks={boot.streaks} />
      </>
    );
  }

  const visible = lines.slice(-MAX_ROWS);
  const active = typing
    ? typing.text.slice(0, typing.shown)
    : locked
      ? null
      : input;
  const activeKind: "typing" | "input" | null = typing
    ? "typing"
    : locked
      ? null
      : "input";
  return (
    <Suspense fallback={null}>
      <TerminalScreen
        lines={visible}
        active={active}
        activeKind={activeKind}
        cursorOn={cursorOn}
        pulse={pulse}
      />
    </Suspense>
  );
}

// Column x positions as fractions of content width, measured from frame 48
const COLUMN_FRACS = [0, 0.29, 0.55, 0.85];
// The film's screens use City Light "optically stretched" — same trick here
const STRETCH = 1.2;
// Average Graduate cap advance is ~0.66em + 0.08 tracking
const CHAR_W = 0.74;

// Pure red is the CRT pass's marker ink: it prints as clean white with no
// bloom or smear — the selection rule stays a crisp straight line
const RULE_COLOR = new Color(1, 0, 0);
// The chosen pair burns brighter than the surrounding green
const HOT_TEXT = new Color(1.9, 1.9, 1.9);

/** Shared type treatment for every screen on MU/TH/UR's tube. */
const screenText = (fontSize: number) =>
  ({
    font: fontUrl,
    fontSize,
    color: "#ffffff",
    anchorX: "left",
    anchorY: "top",
    lineHeight: 1.42,
    letterSpacing: 0.08,
    whiteSpace: "nowrap",
  }) as const;

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
  reveal: MatrixReveal;
  phase: Extract<
    BootPhase,
    "resolve" | "stable" | "select" | "chosen" | "solo"
  >;
  selIndex: number;
}) {
  const viewport = useThree((s) => s.viewport);
  const availW = viewport.width * 0.88;
  const availH = viewport.height * 0.88;
  const fontSize = availH / (ROWS * 1.42);
  const rowH = fontSize * 1.42;
  const contentW = availW / STRETCH;
  const textProps = screenText(fontSize);
  const rowY = (i: number) => -rowH * (MATRIX_START_ROW + i);

  const columns = COLUMN_OFFSETS.map((offset, k) =>
    MATRIX_ROWS.map((row, i) => {
      // The chosen pair renders separately (bright), so blank it here
      if (phase === "chosen" && i === INTERFACE_ROW && k < 2) return "";
      const cell = row[k];
      const revealed = Math.max(
        0,
        Math.min(cell.length, reveal.lineChars[i] - offset),
      );
      return cell.slice(0, revealed);
    }).join("\n"),
  );

  // Rule geometry: label start through value end of the selected pair,
  // in whichever address column the selection has walked into
  const selRow = selIndex % MATRIX_ROWS.length;
  const labelCol = selIndex < MATRIX_ROWS.length ? 0 : 2;
  const sel = MATRIX_ROWS[selRow];
  const ruleX = contentW * COLUMN_FRACS[labelCol];
  const ruleEnd = sel[labelCol + 1]
    ? contentW * COLUMN_FRACS[labelCol + 1] +
      sel[labelCol + 1].length * fontSize * CHAR_W
    : ruleX + sel[labelCol].length * fontSize * CHAR_W;
  const ruleW = ruleEnd - ruleX;

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      {phase !== "solo" && (
        <>
          <Text {...textProps} position={[0, -rowH * TITLE_ROW, 0]}>
            {TITLE.slice(0, reveal.titleChars)}
          </Text>
          {columns.map((column, k) => (
            <Text
              key={k}
              {...textProps}
              position={[
                contentW * COLUMN_FRACS[k],
                -rowH * MATRIX_START_ROW,
                0,
              ]}
            >
              {column}
            </Text>
          ))}
        </>
      )}
      {phase === "select" && (
        <mesh
          position={[ruleX + ruleW / 2, rowY(selRow) - fontSize * 1.16, 0.05]}
          scale={[ruleW, 1, 1]}
        >
          <planeGeometry args={[1, fontSize * 0.09]} />
          <meshBasicMaterial color={RULE_COLOR} toneMapped={false} />
        </mesh>
      )}
      {(phase === "chosen" || phase === "solo") && (
        <>
          <Text
            {...textProps}
            color={phase === "chosen" ? HOT_TEXT : "#ffffff"}
            position={[0, rowY(INTERFACE_ROW), 0]}
          >
            {MATRIX_ROWS[INTERFACE_ROW][0]}
          </Text>
          <Text
            {...textProps}
            color={phase === "chosen" ? HOT_TEXT : "#ffffff"}
            position={[contentW * COLUMN_FRACS[1], rowY(INTERFACE_ROW), 0]}
          >
            {MATRIX_ROWS[INTERFACE_ROW][1]}
          </Text>
        </>
      )}
    </group>
  );
}

// Fixed pools with stable keys: the storm re-rolls every 85ms tick, and
// remounting ~40 troika Texts per tick (each with fresh geometry/material)
// visibly stutters. Slots persist across ticks; only string/position change.
const TEXT_SLOTS = 46; // max bursts (23), each doubled by an interlace ghost
const BLOCK_SLOTS = 6;

/**
 * The raster-noise storm. Each fragment sits on the 64-column grid at its
 * own position; the hot blocks are quads since Graduate has no █ glyph.
 */
function StormScreen({ fragments }: { fragments: StormFragment[] }) {
  const viewport = useThree((s) => s.viewport);
  const availW = viewport.width * 0.9;
  const availH = viewport.height * 0.9;
  const contentW = availW / STRETCH;
  const cellW = contentW / COLS;
  const rowH = availH / ROWS;
  const fontSize = Math.min(rowH / 1.2, cellW / CHAR_W);
  const textProps = screenText(fontSize);

  const texts: StormFragment[] = [];
  const blocks: StormFragment[] = [];
  for (const f of fragments) (f.block ? blocks : texts).push(f);

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      {Array.from({ length: TEXT_SLOTS }, (_, i) => {
        const f = texts[i];
        return (
          <Text
            key={i}
            {...textProps}
            visible={f !== undefined}
            position={f ? [f.col * cellW, -f.row * rowH, 0] : [0, 0, 0]}
          >
            {f?.text ?? ""}
          </Text>
        );
      })}
      {Array.from({ length: BLOCK_SLOTS }, (_, i) => {
        const b = blocks[i];
        return (
          <mesh
            key={i}
            visible={b !== undefined}
            position={
              b ? [(b.col + 0.75) * cellW, -(b.row + 0.5) * rowH, 0] : [0, 0, 0]
            }
          >
            <planeGeometry args={[cellW * 1.5, fontSize * 0.85]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
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
  text: string;
  rule: boolean;
  y: number;
  fontSize: number;
  onWidth?: (w: number) => void;
}) {
  const [w, setW] = useState(0);
  const textProps = screenText(fontSize);
  return (
    <>
      <Text
        {...textProps}
        position={[0, y, 0]}
        onSync={(t: { textRenderInfo?: { blockBounds: number[] } }) => {
          const bw = t.textRenderInfo ? t.textRenderInfo.blockBounds[2] : 0;
          setW(bw);
          onWidth?.(bw);
        }}
      >
        {text}
      </Text>
      <mesh
        visible={rule && w > 0}
        position={[w / 2, y - fontSize * 1.26, 0.05]}
        scale={[Math.max(w, 0.0001), 1, 1]}
      >
        <planeGeometry args={[1, fontSize * 0.07]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </>
  );
}

// The write-head flickers through garbage while it prints — wrong letters,
// stacked bars, solid blocks (frames 9/17/20/22) — overdriven past the CRT's
// bleach knee so it burns yellow-white while settled text stays green
const HEAD_GLYPHS = "MNEWKXVZH08";
const HEAD_TICK_MS = 48;
/** How long a keystroke keeps the input cursor burning as garbage */
const PULSE_MS = 130;
// Hot enough to punch through the phosphor tint (CRT overdrive), with the
// blue crushed so what burns through is the film's yellow
const HEAD_COLOR = new Color(3.4, 3.3, 0.5);

type HeadShape =
  | { kind: "letter"; char: string }
  | { kind: "bars" }
  | { kind: "block" };

function rollHead(): HeadShape {
  const roll = Math.random();
  if (roll < 0.45)
    return {
      kind: "letter",
      char: HEAD_GLYPHS[Math.floor(Math.random() * HEAD_GLYPHS.length)],
    };
  return roll < 0.75 ? { kind: "bars" } : { kind: "block" };
}

/**
 * The cursor at the end of the active line. While MU/TH/UR prints (`hot`)
 * it mutates through overdriven garbage shapes every tick; for user input
 * it blinks as a steady block, flaring back into garbage per keystroke.
 */
function WriteHead({
  x,
  y,
  fontSize,
  hot,
  pulse,
  blinkOn,
}: {
  x: number;
  y: number;
  fontSize: number;
  hot: boolean;
  pulse: number;
  blinkOn: boolean;
}) {
  const [shape, setShape] = useState<HeadShape>({ kind: "block" });
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (!hot) return;
    setShape(rollHead());
    const id = window.setInterval(() => setShape(rollHead()), HEAD_TICK_MS);
    return () => window.clearInterval(id);
  }, [hot]);

  useEffect(() => {
    if (!pulse) return;
    setPulsing(true);
    setShape(rollHead());
    const id = window.setTimeout(() => setPulsing(false), PULSE_MS);
    return () => window.clearTimeout(id);
  }, [pulse]);

  const garbage = hot || pulsing;
  const cx = x + fontSize * 0.45;
  const cy = y - fontSize * 0.62;
  const textProps = screenText(fontSize);
  return (
    <group>
      <Text
        {...textProps}
        color={HEAD_COLOR}
        visible={garbage && shape.kind === "letter"}
        position={[x + fontSize * 0.12, y, 0]}
      >
        {shape.kind === "letter" ? shape.char : HEAD_GLYPHS[0]}
      </Text>
      {[-1, 0, 1].map((k) => (
        <mesh
          key={k}
          visible={garbage && shape.kind === "bars"}
          position={[cx, cy + k * fontSize * 0.3, 0]}
        >
          <planeGeometry args={[fontSize * 0.72, fontSize * 0.14]} />
          <meshBasicMaterial color={HEAD_COLOR} toneMapped={false} />
        </mesh>
      ))}
      <mesh
        visible={garbage ? shape.kind === "block" : blinkOn}
        position={[cx, cy, 0]}
      >
        <planeGeometry args={[fontSize * 0.66, fontSize * 0.82]} />
        <meshBasicMaterial
          color={garbage ? HEAD_COLOR : "#ffffff"}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// HDR far past the bleach knee: prints as the film's white core, and Bloom +
// HorizontalSmear supply the green halo around it (frames 15/16/60)
const BAR_COLOR = new Color(4.5, 4.0, 3.3);

/**
 * The print bar that announces each line: one beat at full width, then it
 * collapses back into the left margin as type-in takes over. Animated in
 * useFrame — remounts per line (key), no per-frame React state.
 */
function PrintBar({
  y,
  width,
  fontSize,
}: {
  y: number;
  width: number;
  fontSize: number;
}) {
  const mesh = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  // Anchored to mount (when the line claims the typing slot), not to the
  // first rendered frame: wall-clock keeps the collapse in step with the
  // typing hold even when rAF stalls (occluded window)
  const start = useRef(performance.now());
  useFrame(() => {
    if (!mesh.current || !mat.current) return;
    const t = performance.now() - start.current;
    if (t >= PRINT_LEAD_MS) {
      mesh.current.visible = false;
      return;
    }
    mesh.current.visible = true;
    const c = Math.min(
      1,
      Math.max(0, (t - PRINT_FLASH_MS) / PRINT_COLLAPSE_MS),
    );
    const frac = 1 - c * c * 0.94;
    mesh.current.scale.x = width * frac;
    mesh.current.position.x = (width * frac) / 2;
    mat.current.opacity = 1 - c * 0.75;
  });
  return (
    <mesh ref={mesh} visible={false} position={[0, y - fontSize * 0.62, 0.05]}>
      <planeGeometry args={[1, fontSize * 0.5]} />
      <meshBasicMaterial
        ref={mat}
        color={BAR_COLOR}
        toneMapped={false}
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Interface 2037 — the inquiry screen, styled from the muthur-type-animation
 * frames: small stretched type anchored top-left, statements ruled when they
 * land, each line announced by the print bar, and the garbage write-head
 * trailing the type-in (Graduate has no █ glyph, so blocks are quads).
 */
function TerminalScreen({
  lines,
  active,
  activeKind,
  cursorOn,
  pulse,
}: {
  lines: TermLine[];
  active: string | null;
  activeKind: "typing" | "input" | null;
  cursorOn: boolean;
  pulse: number;
}) {
  const viewport = useThree((s) => s.viewport);
  const [activeW, setActiveW] = useState(0);
  const availW = viewport.width * 0.9;
  const availH = viewport.height * 0.9;
  const contentW = availW / STRETCH;
  const fontSize = Math.min(availH / (ROWS * 1.42), contentW / 43);
  const rowH = fontSize * 1.42;
  // Headroom above the session, like the film's — also clears the HUD
  const topPad = rowH * 1.6;
  const activeY = -topPad - rowH * lines.length;

  return (
    <group position={[-availW / 2, availH / 2, 0]} scale={[STRETCH, 1, 1]}>
      {Array.from({ length: MAX_ROWS }, (_, i) => (
        <LineSlot
          key={i}
          text={lines[i]?.text ?? ""}
          rule={lines[i]?.rule ?? false}
          y={-topPad - rowH * i}
          fontSize={fontSize}
        />
      ))}
      <LineSlot
        key="active"
        text={active ?? ""}
        rule={false}
        y={activeY}
        fontSize={fontSize}
        onWidth={setActiveW}
      />
      {activeKind === "typing" && (
        <PrintBar
          key={lines.length}
          y={activeY}
          width={contentW}
          fontSize={fontSize}
        />
      )}
      {/* No head while the print bar plays — it appears with the first char */}
      {(activeKind === "input" || (active !== null && active.length > 0)) && (
        <WriteHead
          x={active ? activeW : 0}
          y={activeY}
          fontSize={fontSize}
          hot={activeKind === "typing"}
          pulse={pulse}
          blinkOn={cursorOn}
        />
      )}
    </group>
  );
}

const STREAK_COLORS: Record<Streak["kind"], [number, number, number]> = {
  hair: [2.5, 2.5, 2.5],
  glow: [0.4, 3, 1.1],
  hot: [5, 5, 5],
};

const STREAK_HEIGHTS: Record<Streak["kind"], number> = {
  hair: 0.004,
  glow: 0.012,
  hot: 0.018,
};

/** The film's horizontal phosphor smears — bright quads fed to Bloom. */
function Streaks({ streaks }: { streaks: Streak[] }) {
  const viewport = useThree((s) => s.viewport);
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
          <planeGeometry
            args={[
              s.w * viewport.width,
              STREAK_HEIGHTS[s.kind] * viewport.height,
            ]}
          />
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
  );
}
