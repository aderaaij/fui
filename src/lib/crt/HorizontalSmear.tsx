import { useEffect, useMemo } from 'react'
import { HorizontalSmearEffect, smearDefaults, type SmearParams } from './HorizontalSmearEffect'

/** Horizontal phosphor smear pass for use inside <EffectComposer>. */
export function HorizontalSmear(props: Partial<SmearParams>) {
  const effect = useMemo(() => new HorizontalSmearEffect(), [])
  useEffect(() => {
    effect.setParams({ ...smearDefaults, ...props })
  })
  return <primitive object={effect} dispose={null} />
}
