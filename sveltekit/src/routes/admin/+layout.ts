/**
 * 管理后台是纯客户端应用（依赖 localStorage 里的会话令牌）：
 * - prerender = false：不参与预渲染
 * - ssr = false：不做服务端渲染（避免访问 localStorage 报错）
 */
export const prerender = false
export const ssr = false

/** 后台不套前台外壳（导航/页脚/悬浮球），由 admin 自己的布局负责 */
export const trailingSlash = 'always'
