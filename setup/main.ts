import type { ValaxySSGContext } from 'valaxy/client/setups'

/**
 * Seed dynamic post routes into Vue Router on client startup.
 * This enables usePageList() / site.postList / useTags() / useCategories()
 * to see dynamically fetched posts without modifying any layout.
 *
 * IMPORTANT — why the first navigation is gated on the seeding:
 * page-level computeds (usePageList → useTags / useCategories / nav post
 * counts) read `router.getRoutes()`, which is NOT reactive. If such a
 * computed evaluates before the dynamic routes below are registered, it
 * caches an empty list FOREVER — a later addRoute() never invalidates it.
 * Blocking the very first navigation until seeding finishes guarantees
 * every page mounts with the routes already in place. Without this,
 * /tags/, /categories/, /archives/ and the nav counts render empty on a
 * hard load and only recover after an SPA re-navigation.
 *
 * PERFORMANCE — the list is cached in sessionStorage and replayed before
 * the first navigation, so a repeat visit seeds synchronously and never
 * waits on the network. Only a cold cache still blocks, and then only
 * until the fetch settles or the timeout fires; the article itself is
 * fetched separately by pages/posts/[slug].vue and is never gated here.
 */

/** Metadata needed to register a dynamic post route */
interface SeedPost {
  slug: string
  title: string
  date: string
  updated: string
  tags: string[]
  categories: string[]
  excerpt: string
  cover: string
  type: string
  top: number
  hide: string
}

const CACHE_KEY = 'dyn-route-seed-v1'

/** How long a cold start may wait for the API before rendering without it */
const COLD_START_TIMEOUT_MS = 2500

function readSeedCache(): SeedPost[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed as SeedPost[] : null
  } catch {
    return null
  }
}

function writeSeedCache(posts: SeedPost[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(posts))
  } catch {
    // Quota or private mode — caching is an optimisation, not a requirement.
  }
}

/** fetch() bounded by a timeout, without relying on AbortSignal.timeout() */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export default function setupDynamicRoutes(ctx: ValaxySSGContext) {
  if (!ctx.isClient) return

  let seeded = false

  /** Register one route per post; existing routes are left untouched */
  function seedRoutes(posts: SeedPost[]) {
    for (const post of posts) {
      // Use a non-conflicting route path so the real [slug].vue route
      // at /posts/:slug is NOT shadowed during SPA navigation.
      // The frontmatter's `path` field overrides the route path in
      // usePageList(), yielding post.path = /posts/:slug for the post
      // list, tags, categories, and prev/next navigation.
      const routeKey = `/__pd__/${post.slug}`
      const realPath = `/posts/${post.slug}`

      // Skip if route already exists
      if (ctx.router.hasRoute(routeKey)) continue

      ctx.router.addRoute({
        name: routeKey,
        path: routeKey,
        meta: {
          frontmatter: {
            path: realPath,
            title: post.title,
            date: post.date,
            updated: post.updated || post.date,
            tags: post.tags || [],
            categories: post.categories || [],
            excerpt: post.excerpt || '',
            cover: post.cover || '',
            type: post.type || 'post',
            top: post.top || 0,
            hide: post.hide || '',
            draft: false,
          },
        },
      })
    }
  }

  // ── 1. Replay the previous visit's list before the first navigation ──
  // Same-origin: the entry Worker forwards /api to the API Worker through
  // a service binding, so this no longer crosses to the api.* subdomain.
  const cached = readSeedCache()
  if (cached?.length) {
    seedRoutes(cached)
    seeded = true
  }

  // ── 2. Revalidate in the background (picks up newly published posts) ──
  const seeding = (async () => {
    try {
      const res = await fetchWithTimeout('/api/posts?limit=999', 8000)
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const body = await res.json()
      if (!body.success || !body.data?.posts?.length) return

      const posts: SeedPost[] = body.data.posts
      seedRoutes(posts)
      writeSeedCache(posts)
    } catch (e) {
      console.warn('[dynamic-routes] seed failed:', (e as Error).message)
    } finally {
      seeded = true
    }
  })()

  // Gate only the first navigation; afterwards the guard is a no-op.
  // A timeout keeps the site usable if the API is unreachable — the page
  // then renders without dynamic posts (same as the old behaviour), and SPA
  // navigations still pick the routes up once the fetch eventually settles.
  ctx.router.beforeEach(async () => {
    if (seeded) return
    await Promise.race([seeding, new Promise(r => setTimeout(r, COLD_START_TIMEOUT_MS))])
  })
}
