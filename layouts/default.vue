<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's layouts/default.vue.
 *
 * Butterfly 风格通用页：内容放进居中白卡片，右侧栏同首页。
 * 原主题的左侧栏（YunLayoutLeft）取消，站点信息统一由 BfSidebar 呈现。
 */
</script>

<template>
  <YunLayoutWrapper>
    <div class="bf-container flex items-start gap-6 px-4 pt-24 pb-10">
      <main class="flex-1 min-w-0 bf-card p-5 md:p-8">
        <RouterView />
      </main>
      <BfSidebar />
    </div>
  </YunLayoutWrapper>
</template>
