// Horizontal phosphor smear: drags HDR-bright pixels sideways with a
// tapered falloff, the way hot raster lines bleed on a filmed CRT.
// Only content brighter than uThreshold smears — streak quads render at
// 2.5-5x white while text sits at 1.0, so type stays crisp.

uniform float uIntensity;
uniform float uThreshold;
uniform float uLength;

#define SMEAR_TAPS 24

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 1; i <= SMEAR_TAPS; i++) {
    float f = float(i) / float(SMEAR_TAPS);
    float w = pow(1.0 - f, 2.0);
    vec2 off = vec2(f * uLength, 0.0);
    vec3 a = max(texture2D(inputBuffer, uv + off).rgb - uThreshold, 0.0);
    vec3 b = max(texture2D(inputBuffer, uv - off).rgb - uThreshold, 0.0);
    acc += (a + b) * w;
    wsum += 2.0 * w;
  }
  outputColor = vec4(inputColor.rgb + (acc / wsum) * uIntensity, inputColor.a);
}
