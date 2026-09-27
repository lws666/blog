/**
 * 当前文章的单例响应式引用。
 *
 * vue-router 的 route.meta 突变不具响应性（shallowReactive），所以
 * pages/posts/[slug].vue 把动态文章写入这里（模块级单例），文章页
 * 布局 layouts/post.vue 读取它来渲染 Butterfly 封面 banner——两个
 * 组件共享同一次 API 请求的结果，不产生额外请求。
 *
 * SSG/静态 Markdown 场景下它保持 null，布局回退到 frontmatter。
 */
import { ref } from 'vue'
import type { PostDetail } from './types'

export const currentPost = ref<PostDetail | null>(null)
