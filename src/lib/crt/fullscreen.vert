// Fullscreen-triangle vertex shader matching postprocessing's Pass geometry
// (positions at (-1,-1) (3,-1) (-1,3); uv derived from clip position).

varying vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
