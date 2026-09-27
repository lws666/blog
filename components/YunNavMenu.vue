<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's YunNavMenu.
 *
 * 主题 App 在全局渲染 YunNavMenu（strato/nimbo 类型的顶部导航）。
 * 站点已改用 Butterfly 风格的 BfNavbar，这里的全局导航必须置空，
 * 否则它会和 BfNavbar 叠加（透明的 StratoNavMenu 被盖在下面，
 * 其暗色切换按钮会拦截/重复出现）。
 *
 * BfNavbar 由 components/YunLayoutWrapper.vue 挂载。
 */
</script>

<template>
  <!-- 置空：顶部导航由 BfNavbar 提供 -->
</template>
