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
        const path = `/posts/${post.slug}`

        // Skip if route already exists
        if (ctx.router.hasRoute(path)) continue

        // Only seed frontmatter data for usePageList() / site.postList
        // WITHOUT a component, so the static route doesn't shadow
        // the dynamic :slug param route from [slug].vue on SPA navigation.
        ctx.router.addRoute({
          name: path,
          path,
          meta: {
            frontmatter: {
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
