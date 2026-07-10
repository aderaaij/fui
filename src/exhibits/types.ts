import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * Which rendering approach an exhibit uses. The shell treats them all the
 * same — an exhibit is just a fullscreen component — but the field documents
 * intent and keeps us honest about not forcing everything through WebGL.
 */
export type ExhibitRenderer = 'r3f' | 'dom' | 'hybrid'

export type ExhibitStatus = 'online' | 'restoration'

export interface ExhibitSource {
  title: string
  year: number
}

export interface ExhibitMeta {
  id: string
  /** In-fiction name of the interface, e.g. "MU/TH/UR 6000" */
  title: string
  source: ExhibitSource
  description: string
  renderer: ExhibitRenderer
  status: ExhibitStatus
  /** Lazy fullscreen component — required once status is 'online' */
  component?: LazyExoticComponent<ComponentType>
  /**
   * Documented deviations from the source material. Every trade-off between
   * accuracy and usability goes here; shown as "restoration notes" on the
   * exhibit page.
   */
  accuracyNotes: string[]
}
