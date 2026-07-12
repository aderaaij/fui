// troika-three-text ships no types; the saver entry only needs this one.
declare module 'troika-three-text' {
  export function configureTextBuilder(config: {
    useWorker?: boolean
    sdfGlyphSize?: number
  }): void
}
