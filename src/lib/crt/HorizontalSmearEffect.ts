import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'
import fragmentShader from './smear.frag'

export interface SmearParams {
  /** Gain applied to the accumulated smear */
  intensity: number
  /** Luminance floor — keep above 1 so plain white text does not smear */
  threshold: number
  /** Half-length of the smear in UV units of screen width */
  length: number
}

export const smearDefaults: SmearParams = {
  intensity: 1,
  threshold: 1.25,
  length: 0.12,
}

export class HorizontalSmearEffect extends Effect {
  constructor(params: SmearParams = smearDefaults) {
    super('HorizontalSmearEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uIntensity', new Uniform(params.intensity)],
        ['uThreshold', new Uniform(params.threshold)],
        ['uLength', new Uniform(params.length)],
      ]),
    })
  }

  setParams(p: SmearParams) {
    const u = this.uniforms
    u.get('uIntensity')!.value = p.intensity
    u.get('uThreshold')!.value = p.threshold
    u.get('uLength')!.value = p.length
  }
}
