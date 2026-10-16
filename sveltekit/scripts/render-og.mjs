/**
 * 渲染社交预览图（og:image / twitter:image）。
 *
 * og:image 应当接近 1200×630（Twitter/Facebook 的大图卡片比例），
 * 尺寸不符会被裁剪或缩小展示。
 *
 * 用法：
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/render-og.mjs            # 输出 static/social-preview.png
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cardPath = resolve(here, 'og-card.html')
const out = resolve(here, '../static/social-preview.png')

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1
})
await page.goto(`file://${cardPath}`, { waitUntil: 'load' })
// 等待字体与渐变装饰绘制完成
await page.waitForTimeout(400)
await page.screenshot({ path: out })
await browser.close()
console.log(`✓ 已生成 ${out} (1200×630)`)
