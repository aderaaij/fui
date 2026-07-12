import { useControls } from 'leva'
import type { CRTParams } from './CRTEffect'
import { smearDefaults, type SmearParams } from './HorizontalSmearEffect'
import { crtPresets, type CRTPresetName } from './presets'

/**
 * A preset's values, exposed as live Leva controls for tuning against
 * reference screenshots. The panel is hidden in production builds
 * (see <Leva hidden> in ExhibitPage).
 *
 * The folder is keyed by preset: Leva's store is global and keyed by
 * path, so two exhibits sharing a 'crt' folder would inherit each
 * other's values across navigation — the second mount reads whatever
 * the first left at those paths instead of its own preset.
 */
export function useCRTParams(preset: CRTPresetName): CRTParams {
  const base = crtPresets[preset]
  return useControls(
    `crt · ${preset}`,
    {
      curvature: { value: base.curvature, min: 1.5, max: 20, step: 0.1 },
      scanlineIntensity: { value: base.scanlineIntensity, min: 0, max: 1 },
      scanlineCount: { value: base.scanlineCount, min: 0, max: 1200, step: 1 },
      phosphor: { value: base.phosphor, min: 0, max: 1 },
      tint: base.tint,
      overdrive: { value: base.overdrive, min: 0, max: 1 },
      noise: { value: base.noise, min: 0, max: 0.5 },
      flicker: { value: base.flicker, min: 0, max: 0.2 },
      vignette: { value: base.vignette, min: 0, max: 1.5 },
      rgbOffset: { value: base.rgbOffset, min: 0, max: 0.01 },
    },
    [preset],
  )
}

/**
 * Horizontal smear params as live Leva controls (dev only). An exhibit
 * passes its name and (optionally) its own defaults — the pass is shared,
 * the look is not, and the folder is keyed by exhibit for the same
 * store-collision reason as the CRT presets above.
 */
export function useSmearParams(
  scope: string,
  defaults?: Partial<SmearParams>,
): SmearParams {
  const base = { ...smearDefaults, ...defaults }
  return useControls(
    `smear · ${scope}`,
    {
      intensity: { value: base.intensity, min: 0, max: 4 },
      threshold: { value: base.threshold, min: 0, max: 3 },
      length: { value: base.length, min: 0, max: 0.4 },
    },
    [scope],
  )
}
