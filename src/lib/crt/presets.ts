import type { CRTParams } from './CRTEffect'

/**
 * Named display types. Every exhibit picks (or extends) one of these —
 * accuracy work happens by tuning a preset against film screenshots.
 */
export const crtPresets = {
  /** P1-phosphor monochrome — MU/TH/UR, early terminals, oscilloscopes */
  greenPhosphor: {
    curvature: 5.5,
    scanlineIntensity: 0.28,
    scanlineCount: 0,
    phosphor: 1,
    tint: '#59ff7f',
    noise: 0.07,
    flicker: 0.02,
    vignette: 0.4,
    rgbOffset: 0.0012,
  },
  /** P3-phosphor amber — avionics, later Nostromo screens */
  amberPhosphor: {
    curvature: 5.5,
    scanlineIntensity: 0.26,
    scanlineCount: 0,
    phosphor: 1,
    tint: '#ffb143',
    noise: 0.06,
    flicker: 0.018,
    vignette: 0.4,
    rgbOffset: 0.001,
  },
  /** Color consumer tube — broadcast look, stronger fringe, keeps RGB */
  colorTube: {
    curvature: 6.5,
    scanlineIntensity: 0.2,
    scanlineCount: 0,
    phosphor: 0,
    tint: '#ffffff',
    noise: 0.05,
    flicker: 0.012,
    vignette: 0.35,
    rgbOffset: 0.0025,
  },
} satisfies Record<string, CRTParams>

export type CRTPresetName = keyof typeof crtPresets
