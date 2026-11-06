// Rasterize public/favicon.svg, public/logo.svg and public/og-image.svg into PNGs.
// Run with: npm run gen:icons
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import * as fontkit from 'fontkit'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')
const fontDir = resolve(root, 'src/assets/fonts')

const targets = [
  // Square mark — favicons, PWA, AdSense logo upload
  { src: 'favicon.svg', out: 'favicon-16.png', size: 16 },
  { src: 'favicon.svg', out: 'favicon-32.png', size: 32 },
  { src: 'favicon.svg', out: 'apple-touch-icon.png', size: 180 },
  { src: 'favicon.svg', out: 'icon-192.png', size: 192 },
  { src: 'favicon.svg', out: 'icon-512.png', size: 512 },
  // Wordmark — AdSense consent banners, footers (2x for retina)
  { src: 'logo.svg', out: 'logo.png', width: 720, height: 160 },
  { src: 'logo.svg', out: 'logo@2x.png', width: 1440, height: 320 },
  // Share card: X, LinkedIn and Facebook don't show SVG previews
  { src: 'og-image.svg', out: 'og-image.png', width: 1200, height: 630 },
]

// The renderer has no Host Grotesk installed and would fall back to Arial, so
// every <text> is drawn as outlines from the site's own font files first.
const fonts = new Map()
function hostGrotesk(weight) {
  if (!fonts.has(weight)) fonts.set(weight, fontkit.openSync(resolve(fontDir, `host-grotesk-latin-${weight}.woff2`)))
  return fonts.get(weight)
}

const attr = (attrs, name) => attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1]

/** One <text> (attributes on the element, start-anchored, plain text) as a <path>. */
function outline(attrs, text) {
  const font = hostGrotesk(attr(attrs, 'font-weight') ?? '400')
  const size = Number(attr(attrs, 'font-size'))
  const spacing = Number(attr(attrs, 'letter-spacing') ?? 0)
  const scale = size / font.unitsPerEm
  const run = font.layout(text)
  let x = Number(attr(attrs, 'x'))
  const y = Number(attr(attrs, 'y'))
  const d = run.glyphs
    .map((glyph, i) => {
      const pos = run.positions[i]
      const path = glyph.path.scale(scale, -scale).translate(x + pos.xOffset * scale, y - pos.yOffset * scale).toSVG()
      x += pos.xAdvance * scale + spacing
      return path
    })
    .join('')
  return `<path fill="${attr(attrs, 'fill') ?? '#000'}" d="${d}"/>`
}

const outlineText = (svg) => svg.replace(/<text\b([^>]*)>([^<]*)<\/text>/g, (_, attrs, text) => outline(attrs, text))

for (const t of targets) {
  const svg = Buffer.from(outlineText(await readFile(resolve(publicDir, t.src), 'utf8')))
  const pipeline = sharp(svg, { density: 384 })
  if (t.size) {
    pipeline.resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  } else {
    pipeline.resize(t.width, t.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  }
  const png = await pipeline.png({ compressionLevel: 9 }).toBuffer()
  await writeFile(resolve(publicDir, t.out), png)
  console.log(`✓ ${t.out}`)
}
