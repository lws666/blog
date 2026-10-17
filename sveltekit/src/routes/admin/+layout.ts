/**
 * 管理后台是纯客户端应用（依赖 localStorage 里的会话令牌）：
 * - ssr = false：不做服务端渲染（避免构建期/请求期访问 localStorage）
 * - prerender = true：**输出静态外壳**（每个 admin 路径一个 index.html）。
 *   之前用 prerender=false + Pages 的 _redirects 兜底，但 Pages 对
 *   /admin 与 /admin/ 的 HTML 美化规则会和 _redirects 打架，
 *   产生 308 循环。预渲染出真实文件后不再依赖任何重写规则。
 */
export const prerender = true
export const ssr = false

/** 后台不套前台外壳（导航/页脚/悬浮球），由 admin 自己的布局负责 */
export const trailingSlash = 'always'
