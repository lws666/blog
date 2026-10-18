import { site, absUrl } from '#lib/site'
import type { PageServerLoad } from './$types'

/**
 * 收录检测页的数据层。
 *
 * 为什么不在服务端直接查 `site:域名`：
 * 实测 Bing / Google 对服务端抓取的 `site:` 查询会返回被反爬/个性化污染的
 * 结果——连 site:github.com 都解析出 0 条命中。用它判断收录状态会给出
 * 错误结论，比不做更糟。
 *
 * 因此这里只做**可验证的客观检查**（这些结果 100% 可信）：
 *   1. 站点可达性（HTTP 状态 + 响应时间）
 *   2. robots.txt 是否放行 + 是否声明 sitemap
 *   3. sitemap.xml 是否可访问、URL 数量
 *   4. canonical / og 标签是否规范
 *   5. IndexNow key 是否就位（决定能否主动推送）
 * 收录结果本身则给出官方查询入口（Bing/Google 站长工具 + 带 site: 的搜索链接）。
 */
export const load: PageServerLoad = async ({ fetch }) => {
  const origin = site.url

  type Check = {
    id: string
    label: string
    ok: boolean | null
    detail: string
    hint?: string
  }

  const checks: Check[] = []

  /** 带超时的 fetch，避免页面卡死 */
  async function probe(url: string, timeoutMs = 8000) {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const t0 = Date.now()
    try {
      const res = await fetch(url, {
        signal: ctl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteCheck/1.0)' },
      })
      const text = await res.text()
      return { ok: res.ok, status: res.status, ms: Date.now() - t0, text }
    } catch (e) {
      return { ok: false, status: 0, ms: Date.now() - t0, text: '', error: (e as Error).message }
    } finally {
      clearTimeout(t)
    }
  }

  // 1) 首页可达性
  const home = await probe(absUrl('/'))
  checks.push({
    id: 'home',
    label: '站点可访问',
    ok: home.ok,
    detail: home.ok ? `HTTP ${home.status} · ${home.ms}ms` : `无法访问（${home.status || home.error}）`,
    hint: home.ok ? undefined : '搜索引擎抓不到就无法收录，先确认域名解析与证书',
  })

  // 2) robots.txt 放行 + 声明 sitemap
  const robots = await probe(absUrl('/robots.txt'))
  const robotsText = robots.text || ''
  const allowAll = /User-agent:\s*\*/i.test(robotsText) && /Allow:\s*\//i.test(robotsText)
  const hasSitemap = /Sitemap:\s*https?:\/\//i.test(robotsText)
  const blocked = /Disallow:\s*\/\s*$/m.test(robotsText)
  checks.push({
    id: 'robots',
    label: 'robots.txt 允许抓取',
    ok: robots.ok && allowAll && !blocked,
    detail: robots.ok
      ? (blocked ? '存在 Disallow: / （全站禁止抓取）' : allowAll ? '允许全部抓取' : '规则不明确')
      : `robots.txt 无法访问（${robots.status}）`,
    hint: blocked ? 'Disallow: / 会让所有搜索引擎拒绝收录' : undefined,
  })
  checks.push({
    id: 'sitemap-declared',
    label: 'robots.txt 声明 sitemap',
    ok: hasSitemap,
    detail: hasSitemap ? '已声明 Sitemap 地址' : '未声明 Sitemap',
    hint: hasSitemap ? undefined : '在 robots.txt 加一行 Sitemap: 地址，爬虫能更快发现文章',
  })

  // 3) sitemap.xml
  const sm = await probe(absUrl('/sitemap.xml'))
  const urlCount = (sm.text?.match(/<loc>/g) || []).length
  const hasLastmod = sm.text?.includes('<lastmod>') ?? false
  checks.push({
    id: 'sitemap',
    label: 'sitemap.xml 可用',
    ok: sm.ok && urlCount > 0,
    detail: sm.ok ? `${urlCount} 个 URL${hasLastmod ? ' · 含 lastmod' : ' · 无 lastmod'}` : `无法访问（${sm.status}）`,
    hint: hasLastmod ? undefined : 'lastmod 能让爬虫识别更新过的页面',
  })

  // 4) canonical + og
  const homeText = home.text || ''
  const canonical = homeText.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || ''
  const canonicalOk = canonical === absUrl('/')
  checks.push({
    id: 'canonical',
    label: 'canonical 规范',
    ok: canonicalOk,
    detail: canonical || '缺少 canonical',
    hint: canonicalOk ? undefined : 'canonical 应指向 https + www 的唯一地址，避免重复内容',
  })

  const ogOk = /property="og:title"/.test(homeText) && /property="og:image"/.test(homeText)
  checks.push({
    id: 'og',
    label: '社交分享标签（og）',
    ok: ogOk,
    detail: ogOk ? 'og:title / og:image 齐全' : 'og 标签不完整',
  })

  // 5) IndexNow key（决定能否主动推送）
  const keyFile = homeText.includes('indexnow') ? '' : ''
  const robotsIdx = robotsText.match(/IndexNow/i)
  // key 文件名无法预知，用约定路径探测（站点把 key 放在根目录）
  let indexnowOk = false
  let indexnowDetail = '未找到 IndexNow key 文件'
  // 从环境无法读取 key，改为检查 /api/indexnow-key.txt 代理是否通
  const ik = await probe(absUrl('/api/indexnow-key.txt'))
  if (ik.ok && ik.text.trim().length > 10) {
    indexnowOk = true
    indexnowDetail = 'key 可访问，可主动推送更新'
  }
  checks.push({
    id: 'indexnow',
    label: 'IndexNow 主动推送',
    ok: indexnowOk,
    detail: indexnowDetail,
    hint: indexnowOk ? undefined : 'IndexNow 能让 Bing 等立刻收到新内容通知，显著加快收录',
  })
  void keyFile
  void robotsIdx

  const passed = checks.filter(c => c.ok).length
  const score = Math.round((passed / checks.length) * 100)

  return {
    origin,
    checks,
    passed,
    total: checks.length,
    score,
    /** 官方查询入口（收录结果以官方为准，服务端抓取不可靠） */
    engines: [
      {
        name: 'Google',
        siteQuery: `https://www.google.com/search?q=site%3A${site.host}`,
        console: 'https://search.google.com/search-console',
        tip: 'Search Console → 网址检查 → 请求编入索引',
      },
      {
        name: 'Bing',
        siteQuery: `https://www.bing.com/search?q=site%3A${site.host}`,
        console: 'https://www.bing.com/webmasters',
        tip: 'Bing Webmaster → URL 检查 → 请求编制索引',
      },
      {
        name: '百度',
        siteQuery: `https://www.baidu.com/s?wd=site%3A${site.host}`,
        console: 'https://ziyuan.baidu.com',
        tip: '百度搜索资源平台 → 普通收录 → 提交 sitemap',
      },
    ],
  }
}
