import { BlendFunction, Effect, EffectAttribute, ShaderPass } from 'postprocessing'
import {
  ShaderMaterial,
  Uniform,
  WebGLRenderTarget,
  type TextureDataType,
  type WebGLRenderer,
} from 'three'
import fragmentShader from './smear.frag'
import brightFragmentShader from './smearBright.frag'
import fullscreenVertexShader from './fullscreen.vert'

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

/**
 * The smear kernel spans ~12% of the screen, so tapping the full-res frame
 * 48x per pixel thrashes the texture cache. Instead the thresholded source
 * is rendered once per frame into a half-res target (the smear itself is a
 * wide tapered blur, so the 2x2 prefilter is invisible in the result) and
 * the taps read that — same kernel, a fraction of the bandwidth.
 */
export class HorizontalSmearEffect extends Effect {
  private readonly brightTarget: WebGLRenderTarget
  private readonly brightMaterial: ShaderMaterial
  private readonly brightPass: ShaderPass

  constructor(params: SmearParams = smearDefaults) {
    super('HorizontalSmearEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      // Neighborhood-sampling pass — must not merge with the CRT pass
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uBright', new Uniform(null)],
        ['uIntensity', new Uniform(params.intensity)],
        ['uLength', new Uniform(params.length)],
      ]),
    })

    this.brightTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false })
    this.brightTarget.texture.name = 'Smear.Bright'
    this.brightMaterial = new ShaderMaterial({
      uniforms: {
        inputBuffer: new Uniform(null),
        uThreshold: new Uniform(params.threshold),
      },
      vertexShader: fullscreenVertexShader,
      fragmentShader: brightFragmentShader,
      depthWrite: false,
      depthTest: false,
    })
    this.brightPass = new ShaderPass(this.brightMaterial)
    this.uniforms.get('uBright')!.value = this.brightTarget.texture
  }

  setParams(p: SmearParams) {
    const u = this.uniforms
    u.get('uIntensity')!.value = p.intensity
    u.get('uLength')!.value = p.length
    this.brightMaterial.uniforms.uThreshold.value = p.threshold
  }

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget) {
    this.brightPass.render(renderer, inputBuffer, this.brightTarget, 0, false)
  }

  override setSize(width: number, height: number) {
    this.brightTarget.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)))
  }

  override initialize(renderer: WebGLRenderer, alpha: boolean, frameBufferType: TextureDataType) {
    this.brightPass.initialize(renderer, alpha, frameBufferType)
    if (frameBufferType !== undefined) {
      this.brightTarget.texture.type = frameBufferType
    }
  }

  override dispose() {
    this.brightTarget.dispose()
    this.brightPass.dispose()
    super.dispose()
  }
}
