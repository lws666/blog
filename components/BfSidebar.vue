<script lang="ts" setup>
/**
 * Butterfly 风格右侧栏（桌面 ≥1024px 显示）。
 *
 * 模块：作者卡（头像/名称/简介/统计/社交）→ 公告 → 最新文章 →
 * 音乐播放器（卡片形态）→ 网站资讯。末尾 slot 供页面追加
 * （文章页放目录卡片）。
 *
 * 数据全部复用现有来源：站点信息用 Valaxy 的 siteConfig，
 * 最新文章/文章数用项目的 useDynamicPosts（D1 动态文章）。
 */
import { useSiteConfig, useThemeConfig } from 'valaxy'
import { computed, onMounted, ref } from 'vue'
import { useDynamicPosts } from '../composables/useDynamicPosts'

interface MusicConfig {
  enable?: boolean
  api?: string
  server?: string
  type?: string
  id?: string
  title?: string
}

const siteConfig = useSiteConfig()
const themeConfig = useThemeConfig<{
  music?: MusicConfig
  notice?: { enable?: boolean, content?: string }
  footer?: { since?: number }
}>()

const music = computed(() => themeConfig.value.music)
const notice = computed(() => themeConfig.value.notice)

const { posts } = useDynamicPosts({ limit: 50 })
const recent = computed(() => posts.value.slice(0, 6))
const postCount = computed(() => posts.value.length)

// 运行天数在客户端计算，避免 SSG 构建时间与访问时间不同导致的水合不一致
const runningDays = ref<number | null>(null)
onMounted(() => {
  const since = themeConfig.value.footer?.since
  if (since)
    runningDays.value = Math.max(0, Math.floor((Date.now() - new Date(`${since}-01-01T00:00:00Z`).getTime()) / 86400000))
})

function fmtDate(d?: string | number) {
  return d ? String(d).slice(0, 10) : ''
}
</script>

<template>
  <aside class="bf-aside hidden lg:flex flex-col gap-4">
    <!-- 作者卡 -->
    <div class="bf-card p-5 flex flex-col items-center gap-2 text-center">
      <YunAuthorAvatar />
      <div class="bf-font-sans font-bold text-lg">
        {{ siteConfig.author.name }}
      </div>
      <p
        v-if="siteConfig.description"
        class="text-sm opacity-70 leading-relaxed"
      >
        {{ siteConfig.description }}
      </p>
      <YunPostsInfo />
      <YunSocialLinks />
    </div>

    <!-- 公告 -->
    <div
      v-if="notice?.enable !== false && notice?.content"
      class="bf-card p-4"
    >
      <div class="bf-card-title">
        <div class="i-ri-notification-3-line" aria-hidden="true" />
        公告
      </div>
      <p class="text-sm opacity-80 leading-relaxed">
        {{ notice.content }}
      </p>
    </div>

    <!-- 最新文章 -->
    <div v-if="recent.length" class="bf-card p-4">
      <div class="bf-card-title">
        <div class="i-ri-file-list-3-line" aria-hidden="true" />
        最新文章
      </div>
      <RouterLink
        v-for="p in recent"
        :key="p.path"
        :to="p.path || '/'"
        class="bf-recent-item"
      >
        <img
          v-if="p.cover"
          :src="p.cover"
          alt=""
          loading="lazy"
          class="size-12 rounded-md object-cover flex-shrink-0"
        >
        <div class="min-w-0">
          <div class="bf-recent-title text-sm truncate">
            {{ p.title }}
          </div>
          <div class="text-xs opacity-50 mt-0.5">
            {{ fmtDate(p.date) }}
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- 音乐播放器（卡片形态） -->
    <div v-if="music?.enable !== false" class="bf-card p-4">
      <div class="bf-card-title">
        <div class="i-ri-music-2-line" aria-hidden="true" />
        {{ music?.title || '音乐' }}
      </div>
      <ClientOnly>
        <MusicPlayer
          card
          :api="music?.api"
          :server="music?.server"
          :type="music?.type"
          :id="music?.id"
          :title="music?.title"
        />
      </ClientOnly>
    </div>

    <!-- 网站资讯 -->
    <div class="bf-card p-4">
      <div class="bf-card-title">
        <div class="i-ri-information-line" aria-hidden="true" />
        网站资讯
      </div>
      <dl class="text-sm space-y-1.5">
        <div v-if="runningDays !== null" class="flex justify-between">
          <dt class="opacity-60">运行天数</dt>
          <dd>{{ runningDays }} 天</dd>
        </div>
        <div class="flex justify-between">
          <dt class="opacity-60">文章数目</dt>
          <dd>{{ postCount }} 篇</dd>
        </div>
        <div v-if="themeConfig.footer?.since" class="flex justify-between">
          <dt class="opacity-60">创建于</dt>
          <dd>{{ themeConfig.footer.since }} 年</dd>
        </div>
      </dl>
    </div>

    <!-- 页面追加的卡片（文章页：目录） -->
    <slot />
  </aside>
</template>
