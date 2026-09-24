/**
 * Deterministic SVG cover generator.
 *
 * Produces the "white background + black type + real tech logos" style:
 * genuine vector logos (simple-icons) and real font rendering instead of
 * AI-painted imitations, which garble CJK glyphs and distort logos.
 *
 * Cost: zero — pure string templating, no AI quota, no image library
 * (Workers cannot rasterise; text is laid out with width estimation and
 * rendered by the viewer's own fonts, so CJK always looks right).
 */

/** Icon slugs come from simple-icons (https://simpleicons.org). */
const ICON_CDN = 'https://cdn.simpleicons.org'

/** Keyword (lowercased substring) → simple-icons slug + label */
const TECH_ICONS: Array<[string[], string, string]> = [
  [['cloudflare worker', 'cloudflareworker', 'workers', 'worker'], 'cloudflareworkers', 'Workers'],
  [['cloudflare', 'cf'], 'cloudflare', 'Cloudflare'],
  [['serverless'], 'serverless', 'Serverless'],
  [['d1', 'sqlite'], 'sqlite', 'SQLite'],
  [['b2', 'backblaze'], 'backblaze', 'Backblaze'],
  [['vue'], 'vuedotjs', 'Vue'],
  [['vite'], 'vite', 'Vite'],
  [['markdown', 'md'], 'markdown', 'Markdown'],
  [['github'], 'github', 'GitHub'],
  [['nuxt'], 'nuxt', 'Nuxt'],
  [['react'], 'react', 'React'],
  [['typescript', 'ts'], 'typescript', 'TypeScript'],
  [['javascript', 'js'], 'javascript', 'JavaScript'],
  [['node'], 'nodedotjs', 'Node.js'],
  [['python'], 'python', 'Python'],
  [['docker'], 'docker', 'Docker'],
  [['linux'], 'linux', 'Linux'],
  [['nginx'], 'nginx', 'Nginx'],
  [['astro'], 'astro', 'Astro'],
  [['tailwind'], 'tailwindcss', 'Tailwind'],
  [['vercel'], 'vercel', 'Vercel'],
  [['redis'], 'redis', 'Redis'],
  [['mysql'], 'mysql', 'MySQL'],
  [['postgres'], 'postgresql', 'PostgreSQL'],
  [['hono'], 'hono', 'Hono'],
  [['git'], 'git', 'Git'],
  [['html'], 'html5', 'HTML5'],
  [['css'], 'css', 'CSS'],
  [['json'], 'json', 'JSON'],
  [['npm'], 'npm', 'npm'],
]

/** Used when nothing matches — keeps the cover from looking empty */
const DEFAULT_ICONS: Array<[string, string]> = [
  ['cloudflare', 'Cloudflare'],
  ['sqlite', 'SQLite'],
  ['markdown', 'Markdown'],
]

export interface SvgCoverInput {
  /** The one-liner describing what the article does (big black type) */
  text: string
  /** Tags / tech keywords used for the icon row */
  tags: string[]
  /** Site name shown bottom-right */
  site?: string
  /** Hard cap on icons in the row */
  maxIcons?: number
}

/** simple-icons path data, cached in-process then at the edge */
const pathCache = new Map<string, string | null>()

async function fetchIconPath(slug: string): Promise<string | null> {
  if (pathCache.has(slug)) {
    return pathCache.get(slug) ?? null
  }
  try {
    const res = await fetch(`${ICON_CDN}/${slug}/111111`, {
      cf: { cacheEverything: true, cacheTtl: 2592000 },
    } as RequestInit)
    if (!res.ok) {
      pathCache.set(slug, null)
      return null
    }
    const svg = await res.text()
    const d = svg.match(/\sd="([^"]+)"/)?.[1] ?? null
    pathCache.set(slug, d)
    return d
  } catch {
    pathCache.set(slug, null)
    return null
  }
}

/** Map tags/title keywords onto icon slugs (deduplicated, order preserved) */
export function resolveIconSlugs(input: SvgCoverInput): Array<{ slug: string, label: string }> {
  const haystack = [...input.tags, input.text].join(' ').toLowerCase()
  const out: Array<{ slug: string, label: string }> = []
  const seen = new Set<string>()

  for (const [keywords, slug, label] of TECH_ICONS) {
    if (seen.has(slug)) continue
    if (keywords.some(k => haystack.includes(k))) {
      out.push({ slug, label })
      seen.add(slug)
    }
  }

  if (out.length === 0) {
    for (const [slug, label] of DEFAULT_ICONS) out.push({ slug, label })
  }

  return out.slice(0, input.maxIcons ?? 8)
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Visual width in em: CJK counts 1, ASCII ~0.55 */
function visualWidth(ch: string): number {
  return /[\u3000-\u9fff\uff00-\uffef\u3040-\u30ff]/.test(ch) ? 1 : 0.55
}

/** Greedy line wrap driven by estimated em width */
function wrap(text: string, maxEm: number): string[] {
  const lines: string[] = []
  let cur = ''
  let curW = 0
  for (const ch of text) {
    const w = visualWidth(ch)
    if (curW + w > maxEm && cur) {
      lines.push(cur)
      cur = ''
      curW = 0
    }
    cur += ch
    curW += w
  }
  if (cur) lines.push(cur)
  return lines
}

const SANS = '\'Noto Sans SC\',\'PingFang SC\',\'Microsoft YaHei\',\'Source Han Sans SC\',sans-serif'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

/**
 * Build the cover as an SVG string (1200×630, the social-card ratio).
 * Layout is fixed and mirrored by the admin preview; see the constants
 * below when tuning.
 */
export async function buildCoverSvg(input: SvgCoverInput): Promise<string> {
  const W = 1200
  const H = 630
  const PAD = 70

  const text = (input.text || input.tags[0] || 'Untitled').trim()

  // Shrink the title until it fits in at most three lines
  let size = 64
  let lines = wrap(text, (W - PAD * 2) / size)
  if (lines.length > 3) {
    size = 52
    lines = wrap(text, (W - PAD * 2) / size)
  }
  if (lines.length > 3) {
    size = 44
    lines = wrap(text, (W - PAD * 2) / size)
  }

  const lineHeight = size * 1.28
  const startY = (H - lines.length * lineHeight) / 2 + size * 0.85

  const icons = resolveIconSlugs(input)
  const paths = await Promise.all(icons.map(i => fetchIconPath(i.slug)))

  const iconSize = 46
  const gap = 118
  const iconRow = paths
    .map((d, i) => {
      if (!d) return ''
      const x = PAD + i * gap
      const scale = iconSize / 24
      return `<g transform="translate(${x},488) scale(${scale})"><path d="${d}" fill="#111111"/></g>`
        + `<text x="${x + iconSize / 2}" y="562" text-anchor="middle" font-size="17" font-weight="600"`
        + ` fill="#111111" font-family="${MONO}">${escapeXml(icons[i].label)}</text>`
    })
    .join('')

  const label = escapeXml(input.tags.join(' · ').slice(0, 46).toUpperCase())
  const site = escapeXml(input.site || 'lwsnb.eu.cc')

  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="#ffffff"/>`
    + `<rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#111111" stroke-width="2"/>`
    + `<text x="${PAD}" y="104" font-size="21" font-weight="700" fill="#111111" letter-spacing="5" font-family="${MONO}">${label}</text>`
    + lines
      .map((l, i) => `<text x="${PAD}" y="${startY + i * lineHeight}" font-size="${size}" font-weight="800"`
        + ` fill="#111111" font-family="${SANS}">${escapeXml(l)}</text>`)
      .join('')
    + `<line x1="${PAD}" y1="452" x2="${W - PAD}" y2="452" stroke="#111111" stroke-width="2"/>`
    + iconRow
    + `<text x="${W - PAD}" y="562" text-anchor="end" font-size="19" font-weight="600" fill="#888888"`
    + ` font-family="${MONO}">${site}</text>`
    + `</svg>`
}
