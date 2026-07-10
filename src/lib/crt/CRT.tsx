import { useEffect, useMemo } from 'react'
import { CRTEffect, type CRTParams } from './CRTEffect'
import { crtPresets, type CRTPresetName } from './presets'

export type CRTProps = Partial<CRTParams> & { preset?: CRTPresetName }

function resolveParams({ preset = 'greenPhosphor', ...overrides }: CRTProps): CRTParams {
  const params = { ...crtPresets[preset] }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      ;(params as Record<string, unknown>)[key] = value
    }
  }
  return params
}

/** CRT emulation pass for use inside <EffectComposer>. */
export function CRT(props: CRTProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- single instance, uniforms updated below
  const effect = useMemo(() => new CRTEffect(resolveParams(props)), [])
  useEffect(() => {
    effect.setParams(resolveParams(props))
  })
  return <primitive object={effect} dispose={null} />
}
