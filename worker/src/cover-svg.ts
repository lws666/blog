/**
 * Deterministic SVG cover generator.
 *
 * Produces the "white background + black type + real tech logos" style:
 * genuine vector logos in their official brand colours and real font
 * rendering instead of AI-painted imitations, which garble CJK glyphs and
 * distort logos.
 *
 * Cost: zero — pure string templating, no AI quota, no image library
 * (Workers cannot rasterise; text is laid out with width estimation and
 * rendered by the viewer's own fonts, so CJK always looks right).
 */

/** Icon slugs come from simple-icons (https://simpleicons.org). */
const ICON_CDN = 'https://cdn.simpleicons.org'

/** One icon: path data plus the geometry and colour it must be drawn in */
interface IconArt {
  d: string
  viewBox: string
  hex: string
}

/**
 * Official Cloudflare product icons that simple-icons does not ship.
 *
 * Source: cloudflare/cloudflare-docs `src/icons/*.svg` — the product icon
 * set the docs site itself renders. D1 has no simple-icons entry, and
 * borrowing the SQLite database glyph for it is simply the wrong mark.
 */
const LOCAL_ICONS: Record<string, IconArt> = {
  d1: {
    viewBox: '0 0 65 64',
    hex: '#F38020',
    d: 'm23.6 22.2 3.03 1.75v3.5L23.6 29.2l-3.03-1.75v-3.5zM20.06 49l3.54-3.54L27.14 49l-3.54 3.54zm3.54-14.7c.593 0 1.17.176 1.67.506.493.33.878.798 1.1 1.35a3 3 0 0 1-.65 3.27c-.42.42-.954.705-1.54.821a3 3 0 0 1-1.73-.171 3.04 3.04 0 0 1-1.35-1.1 3 3 0 0 1-.506-1.67c0-.796.316-1.56.879-2.12a3 3 0 0 1 2.12-.879zM10.3 11.2l6.42-4.89 1.21-.37h29l1.19.39 6.61 4.89.82 1.61v38L55 52.21l-4.83 5.11-1.46.63h-31.7l-1.37-.54-5.48-5.11-.64-1.47v-38zm3.21 25.4 4.47 4.94h.056v4h-1.83l-2.7-3v7.39l4.26 4h30l3.7-3.91V42.3l-3.67 3.24h-18.6v-4h17.2l5.19-4.61v-7.44l-3.67 3.25h-18.7v-4h17.2l5.19-4.6v-6.92l-3.67 3.26h-31.6l-2.74-2.8v6.12l4.47 4.94h.056v4h-1.83l-2.7-3zm32.7-26.7h-27.6l-4.07 3.11 3.4 3.48h28.4l4-3.56z',
  },
}

/** Keyword (lowercased substring) → icon slug + label */
const TECH_ICONS: Array<[string[], string, string]> = [
  [['cloudflare worker', 'cloudflareworker', 'workers', 'worker'], 'cloudflareworkers', 'Workers'],
  [['cloudflare', 'cf'], 'cloudflare', 'Cloudflare'],
  [['serverless'], 'serverless', 'Serverless'],
  [['d1'], 'd1', 'D1'],
  [['sqlite'], 'sqlite', 'SQLite'],
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
  ['d1', 'D1'],
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

/** Icon artwork, cached in-process then at the edge */
const artCache = new Map<string, IconArt | null>()

async function fetchIconArt(slug: string): Promise<IconArt | null> {
  if (LOCAL_ICONS[slug]) return LOCAL_ICONS[slug]
  if (artCache.has(slug)) return artCache.get(slug) ?? null

  try {
    // No colour segment in the URL → the CDN returns the icon in its official
    // brand colour (Cloudflare #F38020, Vue #4FC08D, …), which is what the
    // covers show. The fill sits on the <svg> element.
    const res = await fetch(`${ICON_CDN}/${slug}`, {
      cf: { cacheEverything: true, cacheTtl: 2592000 },
    } as RequestInit)
    if (!res.ok) {
      artCache.set(slug, null)
      return null
    }

    const svg = await res.text()
    const d = svg.match(/\sd="([^"]+)"/)?.[1]
    if (!d) {
      artCache.set(slug, null)
      return null
    }

    const art: IconArt = {
      d,
      viewBox: svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24',
      hex: svg.match(/fill="(#[0-9A-Fa-f]{3,8})"/)?.[1] ?? '#111111',
    }
    artCache.set(slug, art)
    return art
  } catch {
    artCache.set(slug, null)
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
  const arts = await Promise.all(icons.map(i => fetchIconArt(i.slug)))

  const iconSize = 46
  const gap = 118
  const iconRow = arts
    .map((art, i) => {
      if (!art) return ''
      const x = PAD + i * gap

      // Icons come in different viewBoxes (simple-icons is 24×24, Cloudflare's
      // product set is 65×64), so scale each one to the same box and centre it
      // rather than assuming a fixed 24×24 grid.
      const [vx, vy, vw, vh] = art.viewBox.split(/[\s,]+/).map(Number)
      const w = vw || 24
      const h = vh || 24
      const scale = iconSize / Math.max(w, h)
      const offsetX = (iconSize - w * scale) / 2
      const offsetY = (iconSize - h * scale) / 2

      return `<g transform="translate(${x + offsetX},${488 + offsetY}) scale(${scale})`
        + ` translate(${-(vx || 0)},${-(vy || 0)})"><path d="${art.d}" fill="${art.hex}"/></g>`
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
