<script lang="ts" setup>
/**
 * Butterfly 风格顶部导航栏。
 *
 * - 首页顶部（Hero 可见时）透明白字；滚动后或其它页面为毛玻璃白条
 * - 桌面端显示完整菜单；移动端汉堡按钮唤起 Yun 的全屏抽屉菜单
 * - 站名用 div（SEO 红线：每页只允许一个 h1，页面标题才是 h1）
 */
import { useSiteConfig } from 'valaxy'
import { useWindowScroll } from '@vueuse/core'
import { useYunAppStore } from 'valaxy-theme-yun/stores/app.ts'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const siteConfig = useSiteConfig()
const yun = useYunAppStore()
const { y: scrollY } = useWindowScroll()
const route = useRoute()

// 只有首页顶部是「透明覆盖在 Hero 上」的形态
const overHero = computed(() => route.path === '/' && scrollY.value < 40)

const menus = [
  { name: '首页', to: '/', icon: 'i-ri-home-4-line' },
  { name: '归档', to: '/archives/', icon: 'i-ri-archive-line' },
  { name: '分类', to: '/categories/', icon: 'i-ri-folder-2-line' },
  { name: '标签', to: '/tags/', icon: 'i-ri-price-tag-3-line' },
  { name: '友链', to: '/links/', icon: 'i-ri-links-line' },
  { name: '关于', to: '/about/', icon: 'i-ri-user-3-line' },
]
</script>

<template>
  <header
    class="bf-navbar fixed top-0 inset-x-0 z-18 flex items-center px-4 md:px-8"
    :class="overHero ? 'bf-navbar--clear' : 'bf-navbar--solid'"
  >
    <RouterLink
      to="/"
      class="bf-navbar-brand flex items-center gap-2 font-bold text-lg bf-font-sans"
    >
      <img
        :src="siteConfig.author.avatar"
        alt=""
        class="size-8 rounded-full object-cover"
      >
      <span>{{ siteConfig.title }}</span>
    </RouterLink>

    <nav class="ml-auto hidden md:flex items-center gap-1" aria-label="主导航">
      <RouterLink
        v-for="m in menus"
        :key="m.to"
        :to="m.to"
        class="bf-navbar-item"
      >
        <div :class="m.icon" aria-hidden="true" />
        <span>{{ m.name }}</span>
      </RouterLink>
    </nav>

    <div class="ml-auto md:ml-2 flex items-center gap-1">
      <YunToggleDark class="bf-icon-btn" />
      <button
        class="bf-icon-btn md:hidden"
        aria-label="打开菜单"
        @click="yun.fullscreenMenu.toggle()"
      >
        <div class="i-ri-menu-line" />
      </button>
    </div>

    <!--
      全屏抽屉菜单由主题 App 全局渲染（strato 类型自带），这里不再
      重复挂载——两份同栈抽屉会互相遮挡，关闭按钮点不到。
    -->
  </header>
</template>
