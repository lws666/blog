<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's YunBackToTop.
 *
 * Butterfly 风格：右下角圆形按钮 + 进度环 + 环内显示滚动百分比
 * （到底部显示 ↑）。滚动状态复用 valaxy 的 useBackToTop。
 */
import { useBackToTop } from 'valaxy'
import { computed } from 'vue'

const { show, percentage, backToTop } = useBackToTop({ offset: 100 })

const radius = 46
const circumference = 2 * radius * Math.PI

// valaxy 的 percentage 是 0~1 的比例（y / 可滚动高度）
const strokeOffset = computed(() => {
  const val = (1 - percentage.value) * circumference
  return val < 0 ? 0 : val
})

const percentText = computed(() =>
  Math.max(0, Math.min(100, Math.round(percentage.value * 100))),
)

const label = computed(() =>
  percentText.value >= 100 ? '↑' : `${percentText.value}`,
)
</script>

<template>
  <a
    href="#"
    class="bf-gotop"
    :class="{ show }"
    :aria-label="`回到顶部（当前 ${percentText}%）`"
    title="回到顶部"
    @click.prevent="backToTop"
  >
    <svg class="bf-gotop-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle
        cx="50" cy="50" :r="radius" fill="none"
        stroke="currentColor" stroke-width="6" stroke-linecap="round"
        :stroke-dasharray="`${circumference} ${circumference}`"
        :stroke-dashoffset="strokeOffset"
      />
    </svg>
    <span class="bf-gotop-text">{{ label }}</span>
  </a>
</template>

<style lang="scss">
.bf-gotop {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: var(--yun-z-go-up-btn, 20);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  color: var(--bf-primary, #49b1f5);
  background: var(--va-c-bg-soft, #fff);
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.12);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;

  &.show {
    opacity: 1;
    pointer-events: auto;
  }

  &:hover {
    transform: translateY(-3px);
  }
}

.bf-gotop-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  opacity: 0.85;
}

.bf-gotop-text {
  position: relative;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: var(--bf-font-sans);
  line-height: 1;
}
</style>
