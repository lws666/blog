import adapter from '@sveltejs/adapter-cloudflare'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

/**
 * SvelteKit 3 起配置写在 sveltekit() 插件里（不再使用 svelte.config.js）。
 * $lib 为内置别名，无需再声明。
 */
export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({
        // 显式指定本目录的 wrangler.toml：否则 adapter 会用仓库根的配置，
        // 把 SvelteKit 入口写进根 src/index.js，覆盖生产 Worker 源码
        config: 'wrangler.toml',
        routes: { include: ['/*'], exclude: ['<all>'] }
      })
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
