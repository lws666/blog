/**
 * 全站预渲染开关（adapter-static）。
 *
 * - prerender = true：构建期把每页写成静态 HTML（对齐 acofork 第 20 代）
 * - trailingSlash = 'always'：与 canonical / sitemap 一致
 *
 * 动态路由（[slug] / [page] / categories / tags）通过各自的 entries()
 * 在构建期枚举出全部路径。
 *
 * 注意：preview 阶段（npm run preview）后端不可用时会跳过 entries，
 * 正式构建请确保 api.lwsnb.eu.cc 可达。
 */
export const prerender = true
export const trailingSlash = 'always'
