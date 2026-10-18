/**
 * 百度站点验证文件（32 字节）。
 *
 * 为什么用 Function 而不是静态文件：
 * 1. SvelteKit trailingSlash='always' 会把 /xxx.html 308 到 /xxx，
 *    而百度要求验证 URL 精确匹配且不能重定向
 * 2. Pages 的静态资源查找对 .html 后缀有特殊处理，容易回落到 SPA 首页
 * Function 在路由最前面直接返回，绕开以上两条。
 *
 * 内容必须与百度提供的文件完全一致（32 字节，无换行）。
 */
const CODE = 'ce1a6c0181a858c560306e7e34edbd0d'

export const onRequest: PagesFunction = async () => {
  return new Response(CODE, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': String(CODE.length),
      'Cache-Control': 'no-store',
    },
  })
}
