<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's layouts/post.vue.
 *
 * Butterfly 风格文章页：
 * - 全宽封面 banner（标题/日期/标签叠在图上，h1 只在这里出现一个）
 * - 内容白卡片上移压住 banner
 * - 右侧栏（BfSidebar）内含目录卡片（桌面）；
 *   移动端为悬浮按钮 + YunAside 抽屉（复用 yun.rightSidebar 状态）
 *
 * 主题原版在 layout setup 阶段用 frontmatter 构建 BlogPosting 的
 * useSchemaOrg(defineArticle(...)) 调用依旧不保留：动态文章此时还没
 * 有数据，会产出 "Invalid Date" 等错误 JSON-LD；文章节点由
 * pages/posts/[slug].vue 在拿到真实数据后的 useHead 里定义。
 *
 * banner 数据来自 route.meta.frontmatter（[slug].vue 在 API 返回后
 * 写入；Markdown 文章则直接是 frontmatter）。
 */
import { useFrontmatter } from 'valaxy'
import { useYunAppStore } from 'valaxy-theme-yun/stores/app.ts'
import { computed } from 'vue'
import { currentPost } from '../composables/useCurrentPost'

const fm = useFrontmatter()
const yun = useYunAppStore()

// banner 元数据：动态文章来自单例（[slug].vue 写入；route.meta 突变
// 不具响应性，不能直接依赖 useFrontmatter），静态 Markdown 回退 frontmatter
const meta = computed(() => {
  const p = currentPost.value
  if (p) {
    return {
      title: p.title,
      cover: p.cover,
      date: p.date,
      updated: p.updated,
      tags: p.tags,
    }
  }
  return {
    title: fm.value.title as string | undefined,
    cover: fm.value.cover as string | undefined,
    date: fm.value.date as string | undefined,
    updated: fm.value.updated as string | undefined,
    tags: fm.value.tags,
  }
})

// 动态文章加载完成前没有标题：不渲染 banner，容器改为常规顶距
const hasBanner = computed(() => !!meta.value.title)

const bannerCover = computed(
  () =>
    meta.value.cover
    || 'https://img.lwsnb.eu.cc/file/1770349301804_DefualtThumbnail.jpg.webp',
)

const bannerTags = computed(() =>
  Array.isArray(meta.value.tags) ? meta.value.tags : [],
)
</script>

<template>
  <YunLayoutWrapper>
    <!-- 封面 banner -->
    <header
      v-if="hasBanner"
      class="bf-post-banner relative w-full flex items-end overflow-hidden"
    >
      <img
        :src="bannerCover"
        alt=""
        aria-hidden="true"
        class="absolute inset-0 size-full object-cover"
      >
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent"
        aria-hidden="true"
      />
      <div class="bf-container relative z-1 px-4 pb-8 text-white w-full">
        <h1 class="bf-post-banner-title text-2xl md:text-4xl font-black">
          {{ meta.title }}
        </h1>
        <div
          class="mt-3 flex items-center gap-4 text-sm opacity-90 flex-wrap bf-font-sans"
        >
          <span v-if="meta.date" class="flex items-center gap-1">
            <div class="i-ri-calendar-line" aria-hidden="true" />
            {{ String(meta.date).slice(0, 10) }}
          </span>
          <span
            v-if="meta.updated && meta.updated !== meta.date"
            class="flex items-center gap-1"
          >
            <div class="i-ri-refresh-line" aria-hidden="true" />
            更新于 {{ String(meta.updated).slice(0, 10) }}
          </span>
          <span
            v-for="t in bannerTags"
            :key="t"
            class="flex items-center gap-1"
          >
            <div class="i-ri-price-tag-3-line" aria-hidden="true" />
            {{ t }}
          </span>
        </div>
      </div>
    </header>

    <!-- 内容卡片 + 右侧栏；有 banner 时上移压住它 -->
    <div
      class="bf-container w-full flex items-start gap-6 px-4 pb-10"
      :class="hasBanner ? '-mt-14 relative z-1' : 'pt-24'"
    >
      <main class="flex-1 min-w-0 bf-card p-5 md:p-8">
        <RouterView />
      </main>

      <BfSidebar>
        <!-- 桌面端目录卡片 -->
        <div v-if="fm.toc !== false" class="bf-card p-4">
          <div class="bf-card-title">
            <div class="i-ri-list-unordered" aria-hidden="true" />
            目录
          </div>
          <YunOutline />
        </div>
      </BfSidebar>
    </div>

    <!-- 移动端目录：悬浮按钮 + 抽屉（xl 及以上隐藏，桌面走右栏卡片）
         按钮位置与音乐球、回到顶部排成一列（见 styles/index.scss） -->
    <div class="xl:hidden">
      <button
        v-if="fm.toc !== false"
        class="toc-btn shadow-md fixed yun-icon-btn z-20 bg-$va-c-bg-soft"
        opacity="75"
        right="5"
        bottom="31"
        aria-label="打开目录"
        @click="yun.rightSidebar.toggle()"
      >
        <div i-ri-file-list-line />
      </button>
      <YunOverlay
        :show="yun.rightSidebar.isOpen"
        @click="yun.rightSidebar.toggle()"
      />
      <YunAside />
    </div>
  </YunLayoutWrapper>
</template>
