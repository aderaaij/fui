// Horizontal phosphor smear: drags HDR-bright pixels sideways with a
// tapered falloff, the way hot raster lines bleed on a filmed CRT.
// Only content brighter than the threshold smears — streak quads render at
// 2.5-5x white while text sits at 1.0, so type stays crisp.
//
// The thresholded source is prepared once per frame at half resolution
// (see HorizontalSmearEffect), so the taps read a small, cache-friendly
// buffer instead of striding across the full-res frame.

uniform sampler2D uBright;
uniform float uIntensity;
uniform float uLength;

#define SMEAR_TAPS 24

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 1; i <= SMEAR_TAPS; i++) {
    float f = float(i) / float(SMEAR_TAPS);
    float w = pow(1.0 - f, 2.0);
    vec2 off = vec2(f * uLength, 0.0);
    acc += (texture2D(uBright, uv + off).rgb + texture2D(uBright, uv - off).rgb) * w;
    wsum += 2.0 * w;
  }
  outputColor = vec4(inputColor.rgb + (acc / wsum) * uIntensity, inputColor.a);
}
