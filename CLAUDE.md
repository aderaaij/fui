# FUI ARCHIVE

Collection of interactive, screen-accurate recreations of movie/TV user
interfaces (MU/TH/UR from Alien, Predator HUD, …). See README.md for the full
architecture; the short version:

- `src/exhibits/registry.ts` is the source of truth. One folder per exhibit
  under `src/exhibits/`, lazy-loaded, default-exported fullscreen component.
- `src/lib/crt/` is the shared CRT emulation pass (postprocessing Effect +
  presets). Tune presets with the Leva panel (dev builds only).
- Promote code from an exhibit into `src/lib/` only when a second exhibit
  needs it.
- Every accuracy/usability trade-off gets an entry in the exhibit's
  `accuracyNotes` in the registry — it renders as "restoration notes".

- `worker/` is the Cloudflare Worker behind `/api/*` — MU/TH/UR's live
  inquiry endpoint. The scripted table in `src/exhibits/muthur/muthur.ts`
  answers film inquiries client-side; only unmatched ones hit the Worker,
  which holds the API key, persona, and all caps server-side (per-IP
  rate limit + a Durable Object daily budget; knobs in `wrangler.jsonc`
  vars). The model provider is switchable — `AI_PROVIDER` var picks
  Anthropic or OpenAI; adapters + pricing live in `worker/synthesis.ts`. Every denial answers in-fiction — the client prints whatever lines
  come back. Local dev: `pnpm dev:api` (needs `.dev.vars`, see the example
  file) next to `pnpm dev`; Vite proxies `/api` to it.

Conventions:

- pnpm. `pnpm dev` / `pnpm build` (runs tsc first) / `pnpm lint` (oxlint).
- Plain CSS in `src/styles/global.css` for chrome; exhibits style themselves.
- Shaders live next to their exhibit or lib as `.frag`/`.vert` files
  (vite-plugin-glsl). Do not re-declare `inputBuffer`/`resolution`/`time` in
  postprocessing effect shaders.
- In-scene text uses drei `<Text>` with self-hosted OFL fonts from
  `src/assets/fonts/` (MU/TH/UR screens: Graduate; DOM chrome: VT323).

Performance (exhibits run fullscreen at dpr 2 — the postprocessing chain is
the whole GPU budget, scene geometry is noise):

- Always pass `multisampling={0}` to `<EffectComposer>`. The default is 8x
  MSAA on a half-float target — pure bandwidth here, since scenes are SDF
  text and axis-aligned quads and the CRT pass resamples the buffer through
  barrel distortion anyway. This alone took MU/TH/UR from ~50fps to
  vsync-capped.
- Wide-kernel effects must not tap the full-res frame — a >10px stride
  defeats the texture cache. Render the thresholded/prefiltered source into
  a small internal RT in `Effect.update()` and tap that; the kernel stays
  identical. `HorizontalSmearEffect`'s half-res brightpass is the pattern
  (uses `initialize`/`setSize`/`update`/`dispose` like BloomEffect does).
- R3F's `<Bloom>` blends ADD, so plain 1.0-white text composes above HDR
  thresholds like the smear's 1.25 floor. Don't "optimize" by skipping HDR
  passes on quiet screens — bloomed text feeds them; the image would change.
- `gl={{ depth: false, stencil: false }}` on `<Canvas>`: the default
  framebuffer only receives the composer's final quad.
- Fetch each shader texel once — the CRT pass reuses its center sample for
  both the green channel and marker-ink detection.
- Measuring: use the dev pins (`/muthur?boot=glyph|matrix|ready`) plus an
  rAF-delta sampler in the console. The tab must be focused — rAF stops and
  dpr may read 1 when it isn't — and treat p50/p95 frame time as the metric,
  not fps: displays here are 120Hz ProMotion, so the real budget is 8.3ms.

Audio (exhibit sound is the film's own, cut from the reference material —
`src/exhibits/muthur/audio.ts` is the reference implementation):

- `scripts/grab-audio.sh <name> <url|file> <start> <dur> [noise] [gap]
  [denoise]` → `reference/<name>/audio/`: cached clip.wav, map.png
  (waveform over log spectrogram, 1s gridlines), events.tsv, and each
  silencedetect event cut to wav+m4a with 30ms pads, 6ms fades, peaks at
  -1dBFS. Film beds run hot: nothing splits at the default -35dB until
  `noise` sits ~4-8dB above the clip's volumedetect mean. Note grab-ref's
  local-file cuts are `-an` — only URL-downloaded clips carry audio.
- afftdn only bites when `nf` is raised to the measured bed level; the
  sampled noise profile alone does nothing against a bed far above the
  default -50dB floor (we measured 0.3dB of reduction until nf moved).
  The script's denoise flag handles both: profile from the longest
  event-free gap, nf = gap mean + 4dB.
- Film dialogue sits center in the stereo mix, electronics wide — rebuild
  a cue from the side channel (`pan=1c|c0=0.5*c0+-0.5*c1` on the original
  stereo clip.mp4) to edit a voice out, then de-hiss: the side sits
  ~25dB down. Locate and verify speech with whisper-cli; brew's bundled
  `for-tests-ggml-tiny.bin` is a random-weight stub — fetch a real
  ggml model from HF (ggerganov/whisper.cpp).
- Loops ship as WAV — AAC priming samples click at the seam. Seamless
  recipe: `main = X[f:end]`, `head = X[0:f]`, `acrossfade=d=f`; the tail
  crossfades into material that continues exactly where the loop restarts.
  Too-short beds extend with offset + `areverse` copies crossfaded in
  series (reversed stationary noise is indistinguishable and kills the
  repeat pattern). Verify: `-stream_loop` a copy and spectrogram it (the
  seam must be invisible), and keep first↔last sample delta under the
  signal's own RMS.
- One-shots ship as m4a/aac 160k (Safari plays no ogg). App-side rules,
  all in muthur/audio.ts: every source routes through one master gain
  wired to the `src/lib/sound.ts` mute store; cues that can't start
  within ~0.6s are dropped, never queued (a cold tab must not dump the
  backlog on first keypress); pointerdown/keydown listeners resume the
  context inside the gesture; direct visits gate the boot behind POWER ON
  (`navigator.userActivation.hasBeenActive`) so the sequence plays scored.
  Sound that must match a variable duration is a start/stop loop with
  attack/release ramps (the typing ratchet), not a one-shot.
