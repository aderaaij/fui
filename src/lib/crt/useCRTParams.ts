import { useControls } from 'leva'
import type { CRTParams } from './CRTEffect'
import { crtPresets, type CRTPresetName } from './presets'

/**
 * A preset's values, exposed as live Leva controls for tuning against
 * reference screenshots. The panel is hidden in production builds
 * (see <Leva hidden> in ExhibitPage).
 */
export function useCRTParams(preset: CRTPresetName): CRTParams {
  const base = crtPresets[preset]
  return useControls(
    'crt',
    {
      curvature: { value: base.curvature, min: 1.5, max: 20, step: 0.1 },
      scanlineIntensity: { value: base.scanlineIntensity, min: 0, max: 1 },
      scanlineCount: { value: base.scanlineCount, min: 0, max: 1200, step: 1 },
      phosphor: { value: base.phosphor, min: 0, max: 1 },
      tint: base.tint,
      noise: { value: base.noise, min: 0, max: 0.5 },
      flicker: { value: base.flicker, min: 0, max: 0.2 },
      vignette: { value: base.vignette, min: 0, max: 1.5 },
      rgbOffset: { value: base.rgbOffset, min: 0, max: 0.01 },
    },
    [preset],
  )
}
