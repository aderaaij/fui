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
