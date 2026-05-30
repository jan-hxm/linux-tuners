// Rasterize public/favicon.svg and public/logo.svg into PNG fallbacks.
// Run with: npm run gen:icons
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')

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
]

for (const t of targets) {
  const svg = await readFile(resolve(publicDir, t.src))
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
