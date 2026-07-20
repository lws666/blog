import type { ValaxySSGContext } from 'valaxy/client/setups'

/**
 * Seed dynamic post routes into Vue Router on client startup.
 * This enables usePageList() / site.postList / useTags() / useCategories()
 * to see dynamically fetched posts without modifying any layout.
 */
export default function setupDynamicRoutes(ctx: ValaxySSGContext) {
  if (!ctx.isClient) return

  // Defer to avoid blocking initial render
  setTimeout(async () => {
    try {
      const apiBase = 'https://blog-worker.13318678430.workers.dev/api'

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
    }
  }, 100)
}
