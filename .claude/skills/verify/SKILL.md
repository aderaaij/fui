---
name: verify
description: Build, launch and drive FUI exhibits to verify changes at the screen
---

# Verifying FUI changes

Static checks: `npx tsc --noEmit && pnpm lint` (oxlint). No prettier config
or dependency — files fail stock `prettier --check` even untouched, so never
run `--write`; match surrounding style by hand (~80 cols, index.tsx double
quotes, registry.ts single quotes unless the text has an apostrophe).

## Launch

`pnpm dev` in the background — Vite picks the first free port from 5173 up;
read the actual port from the task output. Exhibits live at `/<registry-id>`
(e.g. `/muthur`).

## Drive (claude-in-chrome)

- MU/TH/UR dev pins skip the boot: `/muthur?boot=glyph|matrix|ready`.
  `boot=matrix` lands directly in the select phase with a full matrix; a
  boot pin also bypasses the POWER ON gate.
- The exhibit listens on window keydown. The `computer` tool's `key` action
  ("Down", "Up", "Return", repeat: N) works, and so do synthetic
  `KeyboardEvent`s dispatched from `javascript_tool` — the isolated world
  shares the DOM, and the app never checks `isTrusted` (its own touch
  keyboard sends synthetic keydowns).
- The scene is WebGL through the postprocessing chain — nothing is readable
  from the DOM. Verify by screenshot; `computer`'s `zoom` region is good for
  small details like the selection rule.
- Sub-second transients (blinks, flashes) outlive screenshot latency: run a
  `setInterval` in the page re-triggering the transient every ~1.1× its
  period, take several screenshots/zooms mid-mash, then clearInterval.
  Consecutive frames catching both states = captured.
- Audio cues aren't observable this way; note them as unverified or use the
  tab-capture recording flow (see auto-memory "scored demo recording").
- First screenshot after navigate can be black: fonts/Suspense still
  loading, or the occluded-rAF gotcha. Wait 2-3s and reshoot before
  diagnosing.
