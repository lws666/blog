/** Cloudflare Pages Function：把 /twikoo 代理到 blog-worker（Twikoo 同域挂载）。 */
const API_ORIGIN = 'https://api.lwsnb.eu.cc'

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const target = new URL(API_ORIGIN + url.pathname + url.search)
  const res = await fetch(new Request(target.toString(), context.request))
  const out = new Response(res.body, res)
  out.headers.set('Access-Control-Allow-Origin', url.origin)
  out.headers.set('Vary', 'Origin')
  return out
}
