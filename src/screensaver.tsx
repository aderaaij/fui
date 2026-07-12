/**
 * Screensaver entry — MU/TH/UR alone, no archive chrome, no router. The
 * attract driver (exhibits/muthur/attract.ts) boots the tube, opens
 * INTERFACE 2037, types the film's inquiries and power-cycles into a loop.
 * Point a fullscreen kiosk tab or a WebView-based .saver at
 * /screensaver.html; rendering live is what keeps it correct at any
 * resolution and dpi.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Leva } from 'leva'
import { configureTextBuilder } from 'troika-three-text'
import MuthurExhibit from './exhibits/muthur'
import { enableAttract } from './exhibits/muthur/attract'
import './styles/global.css'

// WebKit refuses blob: workers on file:// pages (opaque origin), which is
// exactly where the .saver runs — build glyphs on the main thread there.
// The atlas warm-up during the glyph phase absorbs the cost.
if (window.location.protocol === 'file:') {
  configureTextBuilder({ useWorker: false })
}

// Before mount: silences every cue and waves off the POWER ON gate
enableAttract()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="stage">
      <MuthurExhibit />
    </main>
    {/* CRT tuning lives on /muthur — the saver never shows a panel */}
    <Leva hidden />
  </StrictMode>,
)
