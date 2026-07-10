# FUI ARCHIVE

Interfaces recovered from fiction, restored to working order.

A growing collection of user interfaces from film and television — MU/TH/UR
from *Alien*, the wireframe glider nav from *Escape from New York*, the
Predator bio-helmet, T-800 vision, Expanse hand terminals — rebuilt to be as
screen-accurate as possible **and** actually interactive. Where accuracy and
usability conflict, the trade-off is documented in each exhibit's
"restoration notes".

## Stack

- Vite + React + TypeScript
- three / @react-three/fiber / drei
- postprocessing / @react-three/postprocessing (Bloom + custom CRT pass)
- react-router (lazy route per exhibit), zustand, leva (dev-only tuning panel)
- vite-plugin-glsl for `.frag`/`.vert`/`.glsl` imports

```sh
pnpm dev      # dev server
pnpm build    # typecheck + production build
pnpm lint     # oxlint
```

## Architecture

The site is a shell around a registry of **exhibits**. An exhibit is a
self-contained fullscreen component plus metadata:

```
src/
  app/           # shell: index page ("the archive terminal"), exhibit stage
  exhibits/
    types.ts     # ExhibitMeta contract
    registry.ts  # THE list — index page and routes derive from it
    muthur/      # one folder per exhibit: component, content, assets
  lib/
    crt/         # CRT emulation pass + presets (greenPhosphor, amberPhosphor, colorTube)
    terminal/    # boot sequences, cursor blink — shared terminal primitives
  assets/fonts/  # self-hosted (VT323, OFL license)
  styles/        # global chrome styles incl. DOM-side CRT treatment
```

Rules that keep this maintainable:

- **Exhibits are lazy.** Each one code-splits with its own fonts, shaders and
  assets. Only one is ever mounted.
- **Exhibits pick their renderer** (`r3f` / `dom` / `hybrid`). Nothing forces
  a text terminal or a glass-slab UI through WebGL if DOM is more accurate.
- **Shared code is promoted, not predicted.** A pattern moves from an exhibit
  into `lib/` when a second exhibit needs it.
- **Accuracy notes are part of the exhibit.** Every deliberate deviation from
  the source material is listed in `registry.ts` and shown on the page.

### The CRT pipeline

`lib/crt` is the workhorse: a `postprocessing` Effect doing barrel
distortion, scanlines, monochrome phosphor tinting, grain, mains flicker and
vignette, composed after Bloom. Accuracy work = tuning a preset against film
screenshots with the Leva panel (visible in dev builds only).

### Adding an exhibit

1. `src/exhibits/<id>/index.tsx` — default-export a fullscreen component.
2. Register it in `src/exhibits/registry.ts` with metadata + accuracy notes
   (use `status: 'restoration'` to list it on the index before it's built).
3. That's it — route and index entry derive from the registry.

## Roadmap

- [x] M0 — shell, registry, CRT pipeline, archive index
- [ ] M1 — MU/TH/UR 6000 (*Alien*): full inquiry session, sound, accuracy pass
- [ ] M2 — second exhibit of a *different* type (Gullfire wireframe nav or
      Predator thermal) to prove the architecture generalizes
- [ ] Sound design pass (CRT hum, keys) + global mute
- [ ] Boot-screen index experience (the chrome is itself a FUI)

## Research

- [Typeset in the Future](https://typesetinthefuture.com) — forensic type/UI
  breakdowns of Alien, 2001, and more
- [HUDS+GUIS](https://hudsandguis.com) — FUI design collection
- [Sci-fi Interfaces](https://scifiinterfaces.com) — interaction-design
  analysis of movie UIs

## Legal

Fan preservation work. All referenced properties belong to their respective
studios. VT323 is used under the SIL Open Font License (see
`src/assets/fonts/OFL.txt`).
