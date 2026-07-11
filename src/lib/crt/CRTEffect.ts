import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Color, Uniform } from 'three'
import fragmentShader from './crt.frag'

export interface CRTParams {
  /** Barrel distortion strength — higher is flatter glass */
  curvature: number
  /** 0–1 darkness of the scanline troughs */
  scanlineIntensity: number
  /** Scanlines across the screen height; 0 derives a count from resolution */
  scanlineCount: number
  /** 0 keeps RGB, 1 collapses to monochrome re-emitted through the tint */
  phosphor: number
  /** Phosphor color as a hex string */
  tint: string
  /** 0–1 bleach of HDR-hot content toward yellow-white (overexposed stock) */
  overdrive: number
  /** Per-frame grain amplitude */
  noise: number
  /** Mains-hum brightness flicker amplitude — keep subtle */
  flicker: number
  /** Vignette exponent */
  vignette: number
  /** Horizontal RGB fringe in UV units */
  rgbOffset: number
}

export class CRTEffect extends Effect {
  constructor(params: CRTParams) {
    super('CRTEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      // Samples inputBuffer at distorted UVs — must not merge into a pass
      // with other convolution effects, and needs the composed image as input
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uCurvature', new Uniform(params.curvature)],
        ['uScanlineIntensity', new Uniform(params.scanlineIntensity)],
        ['uScanlineCount', new Uniform(params.scanlineCount)],
        ['uPhosphor', new Uniform(params.phosphor)],
        ['uTint', new Uniform(new Color(params.tint))],
        ['uOverdrive', new Uniform(params.overdrive)],
        ['uNoise', new Uniform(params.noise)],
        ['uFlicker', new Uniform(params.flicker)],
        ['uVignette', new Uniform(params.vignette)],
        ['uRgbOffset', new Uniform(params.rgbOffset)],
      ]),
    })
  }

  setParams(p: CRTParams) {
    const u = this.uniforms
    u.get('uCurvature')!.value = p.curvature
    u.get('uScanlineIntensity')!.value = p.scanlineIntensity
    u.get('uScanlineCount')!.value = p.scanlineCount
    u.get('uPhosphor')!.value = p.phosphor
    ;(u.get('uTint')!.value as Color).set(p.tint)
    u.get('uOverdrive')!.value = p.overdrive
    u.get('uNoise')!.value = p.noise
    u.get('uFlicker')!.value = p.flicker
    u.get('uVignette')!.value = p.vignette
    u.get('uRgbOffset')!.value = p.rgbOffset
  }
}
