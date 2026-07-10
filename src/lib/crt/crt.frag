// CRT display emulation as a postprocessing Effect.
// `inputBuffer`, `resolution` and `time` are provided by the postprocessing
// framework and must not be re-declared here.

uniform float uCurvature;
uniform float uScanlineIntensity;
uniform float uScanlineCount;
uniform float uPhosphor;
uniform vec3 uTint;
uniform float uNoise;
uniform float uFlicker;
uniform float uVignette;
uniform float uRgbOffset;

vec2 curveUv(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 offset = abs(uv.yx) / vec2(uCurvature);
  uv = uv + uv * offset * offset;
  return uv * 0.5 + 0.5;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 cuv = curveUv(uv);

  // Outside the curved glass: the dark of the tube
  if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) {
    outputColor = vec4(vec3(0.0), 1.0);
    return;
  }

  vec2 fringe = vec2(uRgbOffset, 0.0);
  vec3 color = vec3(
    texture2D(inputBuffer, cuv + fringe).r,
    texture2D(inputBuffer, cuv).g,
    texture2D(inputBuffer, cuv - fringe).b
  );

  // Monochrome phosphor: collapse to luminance, re-emit through the tint
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, luma * uTint, uPhosphor);

  // Scanlines follow the curved glass
  float lineCount = uScanlineCount > 0.0 ? uScanlineCount : resolution.y * 0.4;
  float scan = 0.5 + 0.5 * sin(cuv.y * lineCount * 6.2831853);
  color *= 1.0 - uScanlineIntensity * scan;

  // Broadcast grain
  float grain = hash21(cuv * resolution.xy + vec2(time * 61.0, time * 17.0));
  color += (grain - 0.5) * uNoise;

  // Mains-hum flicker
  color *= 1.0 - uFlicker * (0.5 + 0.5 * sin(time * 73.0));

  // Tube vignette, fading to true black exactly at the glass edge
  float vig = pow(16.0 * cuv.x * cuv.y * (1.0 - cuv.x) * (1.0 - cuv.y), uVignette);
  vec2 edge = smoothstep(vec2(0.0), vec2(0.004), cuv) * smoothstep(vec2(0.0), vec2(0.004), 1.0 - cuv);
  color *= vig * edge.x * edge.y;

  outputColor = vec4(color, inputColor.a);
}
