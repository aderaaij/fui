// Smear brightpass: everything above the threshold, at half resolution.
// This is a raw ShaderPass material (not a postprocessing Effect), so
// inputBuffer IS declared here — ShaderPass assigns it by that name.

uniform sampler2D inputBuffer;
uniform float uThreshold;

varying vec2 vUv;

void main() {
  gl_FragColor = vec4(max(texture2D(inputBuffer, vUv).rgb - uThreshold, 0.0), 1.0);
}
