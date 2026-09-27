<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's YunFullscreenMenu.
 *
 * 与主题一致的全屏抽屉菜单（站点信息/统计/社交/页面链接），仅新增
 * 右上角「关闭」按钮：抽屉打开后盖住整个屏幕（z 高于导航栏），
 * 原版没有退出入口，移动端用户会被困住。
 */
import { ref } from 'vue'
import { useYunAppStore } from 'valaxy-theme-yun/stores/app.ts'

const yunApp = useYunAppStore()
const fullscreenMenuRef = ref<HTMLElement>()
</script>

<template>
  <Transition name="slide-left">
    <div
      v-if="yunApp.fullscreenMenu.isOpen"
      ref="fullscreenMenuRef"
      p="t-12 md:t-20"
      class="yun-fullscreen-menu fixed left-0 right-0 bottom-0 top-0 bg-$va-c-bg-soft z-$yun-z-fullscreen-menu overflow-auto max-w-md shadow-2xl"
    >
      <!-- 关闭按钮：原版缺失，没有它抽屉无法退出 -->
      <button
        class="bf-menu-close fixed top-4 right-4 z-1 inline-flex items-center justify-center size-10 rounded-full"
        aria-label="关闭菜单"
        title="关闭菜单"
        @click="yunApp.fullscreenMenu.toggle()"
      >
        <div class="i-ri-close-line text-2xl" />
      </button>

      <YunSiteInfo class="text-center" />
      <YunGradientDivider class="my-2 op-20" />
      <YunPostsInfo />
      <YunGradientDivider class="my-2 op-20" />
      <YunSocialLinks />
      <YunGradientDivider class="my-2 op-20" />
      <YunSidebarLinks />

      <YunGradientDivider class="my-2 op-20 lg:hidden" />

      <div class="flex-center">
        <YunConfig />
      </div>
    </div>
  </Transition>
</template>

<style lang="scss">
.slide-left-enter-active,
.slide-left-leave-active {
  opacity: 1;
  transition: transform 0.3s ease, opacity 0.25s ease;
  transform: translateX(0);
}

.slide-left-enter-from,
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}

/* 关闭按钮：跟随亮暗模式 */
.bf-menu-close {
  color: var(--va-c-text, #4c4948);
  background: var(--va-c-bg, #fff);
  border: 1px solid var(--va-c-divider, rgba(125, 125, 125, 0.2));
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.1);
  cursor: pointer;

  &:hover {
    color: var(--bf-primary, #49b1f5);
  }
}
</style>
