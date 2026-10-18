/**
 * 百度站点验证文件。
 *
 * 为什么需要 Function：SvelteKit 的 trailingSlash='always' 会把
 * /xxx.html 308 重定向到 /xxx（去掉 .html），而百度要求验证 URL
 * **精确匹配**、且不能是重定向。Pages 的 _redirects 在 SvelteKit
 * 的规范化重定向之后执行，拦不住；Functions 则在最前面处理。
 *
 * 内容必须与百度提供的文件完全一致（32 字节，无换行）。
 */
const CODE = 'ce1a6c0181a858c560306e7e34edbd0d'

export const onRequest: PagesFunction = async () => {
  return new Response(CODE, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
