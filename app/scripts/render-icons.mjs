import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const htmlPath = path.join(__dirname, 'icon-render.html')
const outDir = path.join(__dirname, '..', 'public', 'icons')

const sizes = [192, 512]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file://' + htmlPath)

for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size })
  await page.evaluate((s) => {
    const icon = document.querySelector('.icon')
    const wrench = document.querySelector('.wrench')
    icon.style.width = s + 'px'
    icon.style.height = s + 'px'
    wrench.style.fontSize = Math.round(s * (300 / 512)) + 'px'
  }, size)
  const el = await page.$('.icon')
  await el.screenshot({ path: path.join(outDir, `icon-${size}.png`) })
}

await browser.close()
console.log('done')
