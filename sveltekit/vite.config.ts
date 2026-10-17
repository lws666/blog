import adapter from '@sveltejs/adapter-static'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

/**
 * SvelteKit 3 起配置写在 sveltekit() 插件里（不再使用 svelte.config.js）。
 * $lib 为内置别名，无需再声明。
 */
export default defineConfig({
  plugins: [
    sveltekit({
      // adapter-static：构建期把全站预渲染为静态 HTML（对齐 acofork 第 20 代）
      // 不设 fallback —— 所有路由都应被预渲染，未知路径得到真实 404.html
      adapter: adapter({
        pages: 'build',
        assets: 'build',
        // 管理后台已改为预渲染静态外壳（admin/+layout.ts prerender=true），
        // 每个 /admin/* 路径都有真实 index.html，不再需要 SPA fallback。
        strict: false
      }),
      prerender: {
        // 分页路由 /blog/page/[page] 只在总页数 > 1 时才有实例；
        // 文章不足一页时不生成，不算错误
        handleUnseenRoutes: ({ routes }) =>
          routes.every(r => r.startsWith('/blog/page/')) ? 'ignore' : 'fail'
      }
    })
  ],
  server: {
    // 本地开发把 /api 代理到线上 Worker，避免 CORS 与写死 localhost
    proxy: {
      '/api': {
        target: 'https://api.lwsnb.eu.cc',
        changeOrigin: true
      }
    }
  }
})
