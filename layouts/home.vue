<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's layouts/home.vue.
 *
 * Butterfly 首页：全屏 Hero（BfHero）→ 居中容器（文章卡片流 +
 * 右侧栏）。原主题的字符动画 banner、公告条、Prologue 由 Hero
 * 与侧栏公告卡替代。
 *
 * 文章卡片流来自 pages/index.vue（D1 动态文章 → YunPostList）。
 */
</script>

<template>
  <YunLayoutWrapper>
    <BfHero />

    <div
      id="bf-main"
      class="bf-container flex items-start gap-6 px-4 pt-8 pb-10"
    >
      <main class="flex-1 min-w-0">
        <RouterView />
      </main>
      <BfSidebar />
    </div>
  </YunLayoutWrapper>
</template>
