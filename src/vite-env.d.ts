/// <reference types="vite/client" />

declare module '*.frag' {
  const src: string
  export default src
}

declare module '*.vert' {
  const src: string
  export default src
}

declare module '*.glsl' {
  const src: string
  export default src
}

// troika-three-text ships no type definitions; declare what we use
declare module 'troika-three-text' {
  export function preloadFont(
    options: { font?: string; characters?: string | string[]; sdfGlyphSize?: number },
    callback: () => void,
  ): void
}
