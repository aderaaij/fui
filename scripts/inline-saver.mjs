/**
 * Folds the saver-mode build (dist-saver/) into one self-contained HTML.
 * WKWebView won't fetch external module scripts over file:// (opaque-origin
 * CORS), so the .saver ships a single file with the JS and CSS inline and
 * every asset already a data: URI (vite `saver` mode, assetsInlineLimit).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dist = path.resolve(import.meta.dirname, '../dist-saver')
const htmlPath = path.join(dist, 'screensaver.html')
let html = readFileSync(htmlPath, 'utf8')

// Inline scripts must not contain a literal </script>; escaping the slash
// is byte-identical inside JS strings and regexes.
const escapeInline = (js) => js.replaceAll('</script', '<\\/script')

html = html.replace(
  /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_, src) =>
    `<script type="module">${escapeInline(readFileSync(path.join(dist, src), 'utf8'))}</script>`,
)
html = html.replace(
  /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_, href) => `<style>${readFileSync(path.join(dist, href), 'utf8')}</style>`,
)
// The favicon would 404 over file://; the saver has no tab to decorate
html = html.replace(/\s*<link rel="icon"[^>]*>/, '')

if (/(src|href)="\.\/assets/.test(html)) {
  console.error('inline-saver: external asset references remain — not self-contained')
  process.exit(1)
}
writeFileSync(htmlPath, html)
console.log(
  `inline-saver: screensaver.html is self-contained (${(html.length / 1024 / 1024).toFixed(1)} MB)`,
)
