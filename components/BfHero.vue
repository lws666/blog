<script lang="ts" setup>
/**
 * Butterfly 风格首页 Hero：全屏背景图 + 暗色遮罩 + 居中标题 +
 * 下滑箭头 + 底部波浪。背景图取 themeConfig.banner.url。
 *
 * 首页唯一的 h1 是这里的站名大标题（侧栏/导航里一律 div）。
 */
import { useSiteConfig, useThemeConfig } from 'valaxy'
import { computed } from 'vue'

const siteConfig = useSiteConfig()
const themeConfig = useThemeConfig<{ banner?: { title?: string, url?: string } }>()

const bg = computed(
  () =>
    themeConfig.value.banner?.url
    || 'https://img.lwsnb.eu.cc/file/1770349301804_DefualtThumbnail.jpg.webp',
)
const title = computed(() => themeConfig.value.banner?.title || siteConfig.title)
</script>

<template>
  <header
    class="bf-hero relative w-full flex items-center justify-center overflow-hidden"
  >
    <img
      :src="bg"
      alt=""
      aria-hidden="true"
      class="absolute inset-0 size-full object-cover"
    >
    <div class="absolute inset-0 bg-black/35" aria-hidden="true" />

    <div class="relative z-1 text-center text-white px-4">
      <h1 class="bf-hero-title text-4xl md:text-6xl font-black">
        {{ title }}
      </h1>
      <p
        v-if="siteConfig.description"
        class="bf-hero-subtitle mt-4 text-base md:text-xl opacity-90"
      >
        {{ siteConfig.description }}
      </p>
    </div>

    <a
      href="#bf-main"
      class="bf-hero-arrow absolute bottom-14 left-1/2 z-1 text-white opacity-90 hover:opacity-100"
      aria-label="向下滚动查看文章"
    >
      <div class="i-ri-arrow-down-s-line size-10" />
    </a>

    <!-- 底部波浪：颜色跟随页面底色变量，暗色模式自动适配 -->
    <svg
      class="absolute bottom-0 left-0 w-full h-[70px] md:h-[100px] z-1"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0,64 C240,110 480,20 720,48 C960,76 1200,28 1440,64 L1440,120 L0,120 Z"
        style="fill: var(--va-c-bg); opacity: 0.45"
      />
      <path
        d="M0,80 C260,40 520,100 780,76 C1040,52 1240,88 1440,72 L1440,120 L0,120 Z"
        style="fill: var(--va-c-bg)"
      />
    </svg>
  </header>
</template>
