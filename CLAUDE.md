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

Conventions:

- pnpm. `pnpm dev` / `pnpm build` (runs tsc first) / `pnpm lint` (oxlint).
- Plain CSS in `src/styles/global.css` for chrome; exhibits style themselves.
- Shaders live next to their exhibit or lib as `.frag`/`.vert` files
  (vite-plugin-glsl). Do not re-declare `inputBuffer`/`resolution`/`time` in
  postprocessing effect shaders.
- In-scene text uses drei `<Text>` with the self-hosted VT323 font
  (`src/assets/fonts/`).
