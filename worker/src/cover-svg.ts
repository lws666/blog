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

/**
 * One icon: its inner SVG markup (one or more <path> elements, kept verbatim
 * so attributes such as fill-rule="evenodd" survive), plus the viewBox and
 * the brand colour the paths inherit.
 */
interface IconArt {
  inner: string
  viewBox: string
  hex: string
}

/**
 * Official Cloudflare product icons that simple-icons does not ship.
 *
 * Source: cloudflare/cloudflare-docs `src/icons/*.svg` — the product icon set
 * the docs site itself renders. None of these has a simple-icons entry, and
 * borrowing the SQLite database glyph for D1 is simply the wrong mark.
 * `fill="currentColor"` is dropped from the originals so every path inherits
 * the brand colour from the wrapper <g>.
 */
const LOCAL_ICONS: Record<string, IconArt> = {
  d1: {
    viewBox: '0 0 65 64',
    hex: '#F38020',
    inner: '<path d="m23.6 22.2 3.03 1.75v3.5L23.6 29.2l-3.03-1.75v-3.5zM20.06 49l3.54-3.54L27.14 49l-3.54 3.54zm3.54-14.7c.593 0 1.17.176 1.67.506.493.33.878.798 1.1 1.35a3 3 0 0 1-.65 3.27c-.42.42-.954.705-1.54.821a3 3 0 0 1-1.73-.171 3.04 3.04 0 0 1-1.35-1.1 3 3 0 0 1-.506-1.67c0-.796.316-1.56.879-2.12a3 3 0 0 1 2.12-.879zM10.3 11.2l6.42-4.89 1.21-.37h29l1.19.39 6.61 4.89.82 1.61v38L55 52.21l-4.83 5.11-1.46.63h-31.7l-1.37-.54-5.48-5.11-.64-1.47v-38zm3.21 25.4 4.47 4.94h.056v4h-1.83l-2.7-3v7.39l4.26 4h30l3.7-3.91V42.3l-3.67 3.24h-18.6v-4h17.2l5.19-4.61v-7.44l-3.67 3.25h-18.7v-4h17.2l5.19-4.6v-6.92l-3.67 3.26h-31.6l-2.74-2.8v6.12l4.47 4.94h.056v4h-1.83l-2.7-3zm32.7-26.7h-27.6l-4.07 3.11 3.4 3.48h28.4l4-3.56z"/>',
  },
  kv: {
    viewBox: '0 0 64 64',
    hex: '#F38020',
    inner: '<path d="M22 44.95h-7v-4h7zm-7-8h7v-4h-7zm7-8h-7v-4h7zm4 16h23v-4H26zm23-8H26v-4h23zm-23-8h23v-4H26z"/><path fill-rule="evenodd" d="m6 12 2-2h19l1.675.907 3.408 5.225H56l2 2V52l-2 2H8l-2-2zm4 2v36h44V20.132H31l-1.675-.908L25.917 14z" clip-rule="evenodd"/>',
  },
  r2: {
    viewBox: '0 0 40 40',
    hex: '#F38020',
    inner: '<path fill-rule="evenodd" d="M30.289 6.423c-2.43-.813-5.958-1.362-9.977-1.362-4.018 0-7.545.549-9.976 1.362-1.228.41-2.033.842-2.48 1.195q-.14.111-.204.18c.052.171.196.395.562.67.524.394 1.372.783 2.563 1.119 2.368.666 5.731 1.023 9.536 1.023s7.167-.357 9.535-1.023c1.191-.336 2.04-.725 2.563-1.119.366-.275.51-.499.562-.67a2 2 0 0 0-.204-.18c-.447-.353-1.252-.784-2.48-1.195m-20.24 5.624c-.885-.25-1.71-.552-2.424-.922v4.393c0 .196.097.514.625.941.535.433 1.391.869 2.576 1.252 2.36.764 5.71 1.222 9.486 1.222 3.778 0 7.128-.458 9.487-1.222 1.185-.383 2.041-.82 2.576-1.252.528-.427.625-.745.625-.94v-4.394c-.715.37-1.539.673-2.424.922-2.7.76-6.336 1.124-10.264 1.124s-7.564-.364-10.263-1.124m25.576 3.471V7.622c0-2.829-6.856-5.122-15.313-5.122C11.857 2.5 5 4.793 5 7.622v24.756c0 2.829 6.856 5.122 15.313 5.122 8.456 0 15.312-2.293 15.312-5.122zM33 19.134c-.7.393-1.505.726-2.375 1.008-2.708.877-6.358 1.352-10.313 1.352-3.954 0-7.604-.475-10.312-1.352-.87-.282-1.676-.615-2.375-1.008v4.28c0 .196.097.514.625.942.535.432 1.391.868 2.576 1.252 2.36.763 5.71 1.221 9.486 1.221 3.778 0 7.128-.458 9.487-1.221 1.185-.384 2.041-.82 2.576-1.252.528-.428.625-.746.625-.941v-4.28Zm-23 8.904c-.87-.281-1.676-.615-2.375-1.007v5.143c.044.048.116.117.231.208.447.353 1.252.785 2.48 1.195 2.43.813 5.958 1.362 9.976 1.362s7.546-.549 9.977-1.362c1.228-.41 2.033-.842 2.48-1.195a2 2 0 0 0 .231-.208v-5.143c-.7.392-1.505.726-2.375 1.007-2.708.877-6.358 1.352-10.313 1.352-3.954 0-7.604-.475-10.312-1.352m23.06 4.06-.01.016zm-25.495 0 .01.016zm3.997-15.726c.725 0 1.313-.573 1.313-1.28s-.588-1.281-1.313-1.281c-.724 0-1.312.573-1.312 1.28s.588 1.281 1.313 1.281Zm1.313 6.83c0 .706-.588 1.28-1.313 1.28-.724 0-1.312-.574-1.312-1.28 0-.708.588-1.281 1.313-1.281.724 0 1.312.573 1.312 1.28Zm-1.313 9.176c.725 0 1.313-.573 1.313-1.28s-.588-1.28-1.313-1.28c-.724 0-1.312.572-1.312 1.28 0 .707.588 1.28 1.313 1.28Z" clip-rule="evenodd"/>',
  },
}

/** Keyword (lowercased substring) → icon slug + label */
const TECH_ICONS: Array<[string[], string, string]> = [
  [['cloudflare worker', 'cloudflareworker', 'workers', 'worker'], 'cloudflareworkers', 'Workers'],
  [['cloudflare', 'cf'], 'cloudflare', 'Cloudflare'],
  [['serverless'], 'serverless', 'Serverless'],
  [['d1'], 'd1', 'D1'],
  [['kv'], 'kv', 'KV'],
  [['r2'], 'r2', 'R2'],
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
  /**
   * Post description. Authors here list the stack they used in this field
   * ("d1，vue，nodejs，vite，kv，b2"), so it is part of the icon search — the
   * icons must reflect what the article is about, not just its tags.
   */
  excerpt?: string
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
      inner: `<path d="${d}"/>`,
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
/**
 * Does the haystack mention this keyword?
 *
 * Two-character keywords are matched on word boundaries: plain substring
 * matching made "nodejs" light up JavaScript (js) and would make "d1x" light
 * up D1. Longer keywords stay substring matches so plurals and compounds
 * ("workers", "vuejs") still hit.
 */
function mentions(haystack: string, keyword: string): boolean {
  if (keyword.length <= 2) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`).test(haystack)
  }
  return haystack.includes(keyword)
}

export function resolveIconSlugs(input: SvgCoverInput): Array<{ slug: string, label: string }> {
  const haystack = [...input.tags, input.text, input.excerpt ?? ''].join(' ').toLowerCase()
  const out: Array<{ slug: string, label: string }> = []
  const seen = new Set<string>()

  for (const [keywords, slug, label] of TECH_ICONS) {
    if (seen.has(slug)) continue
    if (keywords.some(k => mentions(haystack, k))) {
      out.push({ slug, label })
      seen.add(slug)
    }
  }

  if (out.length === 0) {
    for (const [slug, label] of DEFAULT_ICONS) out.push({ slug, label })
  }

  return out.slice(0, input.maxIcons ?? 8)
}

/**
 * Pick the big black headline.
 *
 * The description is the natural headline ("what the article does"), but
 * authors here also use that field as a comma-separated technology list
 * ("d1，vue，nodejs，vite，kv，b2"), which makes a poor banner. So a
 * description is only used as the headline when it reads like prose: it
 * carries a real amount of CJK, or several space-separated words.
 */
export function headlineFrom(excerpt: string | undefined, title: string | undefined): string {
  const e = (excerpt ?? '').trim()
  const t = (title ?? '').trim()
  if (!e) return t

  const cjk = (e.match(/[\u4e00-\u9fff]/g) ?? []).length
  const words = e.split(/\s+/).filter(Boolean).length
  const looksLikeList = cjk < Math.max(4, e.length * 0.3) && words < 4

  return looksLikeList ? (t || e) : e
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
        + ` translate(${-(vx || 0)},${-(vy || 0)})" fill="${art.hex}">${art.inner}</g>`
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
