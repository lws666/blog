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
 */
export default function setupDynamicRoutes(ctx: ValaxySSGContext) {
  if (!ctx.isClient) return

  let seeded = false

  // Start immediately (setup runs after app.use(router) but before the
  // initial navigation resolves, so this races the fetch against first paint).
  const seeding = (async () => {
    try {
      const apiBase = 'https://api.lwsnb.eu.cc/api'

      const res = await fetch(`${apiBase}/posts?limit=999`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const body = await res.json()
      if (!body.success || !body.data?.posts?.length) return

      const posts: Array<{
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
      }> = body.data.posts

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
    } catch (e) {
      console.warn('[dynamic-routes] seed failed:', (e as Error).message)
    } finally {
      seeded = true
    }
  })()

  // Gate only the first navigation; afterwards the guard is a no-op.
  // A 3s timeout keeps the site usable if the API is unreachable —
  // the page then renders without dynamic posts (same as the old
  // behaviour), and SPA navigations still pick the routes up once
  // the fetch eventually settles.
  ctx.router.beforeEach(async () => {
    if (seeded) return
    await Promise.race([seeding, new Promise(r => setTimeout(r, 3000))])
  })
}
