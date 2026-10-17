/**
 * Cloudflare Pages Function：把 /api/* 代理到 blog-worker。
 *
 * 为什么需要：站点是纯静态预渲染（adapter-static），没有服务端路由。
 * 但部分资源必须由 Worker 提供——例如 /api/indexnow-key.txt
 * （IndexNow 要求 key 文件位于站点根域），以及让浏览器同域调用 API。
 *
 * 用绝对 URL 转发（而非 service binding），因为 Pages Functions 与
 * Worker 是不同项目，绑定的配置成本高于直接转发。
 */
const API_ORIGIN = 'https://api.lwsnb.eu.cc'

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const target = new URL(API_ORIGIN + url.pathname + url.search)

  const req = new Request(target.toString(), context.request)
  const res = await fetch(req)

  // 透传响应，但补上 CORS 头（同域调用其实不需要，保留以防子域调用）
  const out = new Response(res.body, res)
  out.headers.set('Access-Control-Allow-Origin', url.origin)
  out.headers.set('Vary', 'Origin')
  return out
}
