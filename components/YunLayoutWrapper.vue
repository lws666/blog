<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's YunLayoutWrapper.
 *
 * Butterfly 风格骨架：顶部固定导航（BfNavbar）+ 页面内容 + 页脚。
 * 与主题原版的差异：不再提供"内容垂直居中"的容器，也不渲染左侧栏——
 * 双栏结构（内容列 + 右侧栏）由各页面布局自行组织；导航栏是全站
 * 唯一全局入口。
 *
 * 保留 footer / no-margin props 以兼容主题布局的既有调用。
 */
withDefaults(defineProps<{
  footer?: boolean
  noMargin?: boolean
}>(), {
  footer: true,
  noMargin: false,
})
</script>

<template>
  <div class="bf-shell min-h-screen flex flex-col">
    <BfProgressBar />
    <BfContentEnhancer />
    <BfNavbar />
    <div class="flex-grow flex flex-col">
      <slot />
    </div>
    <YunFooter v-if="footer" />
  </div>
</template>
