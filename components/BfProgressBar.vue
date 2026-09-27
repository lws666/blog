<script lang="ts" setup>
/**
 * Butterfly 风格顶部加载进度条（pace.js 的轻量替代，无新依赖）。
 *
 * 首次进入：挂载即开始，window load 后收尾。
 * 站内跳转：router.beforeEach 开始、afterEach 稍延迟后收尾
 * （动态文章的接口请求在导航之后，留一点时间让进度条贴近真实加载）。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const visible = ref(false)
const width = ref(0)

let tick: ReturnType<typeof setInterval> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let doneTimer: ReturnType<typeof setTimeout> | undefined

function start() {
  if (tick)
    clearInterval(tick)
  if (hideTimer)
    clearTimeout(hideTimer)
  if (doneTimer)
    clearTimeout(doneTimer)

  visible.value = true
  width.value = 8
  tick = setInterval(() => {
    if (width.value < 90)
      width.value += (92 - width.value) * 0.12
  }, 160)
}

function done() {
  if (tick) {
    clearInterval(tick)
    tick = undefined
  }
  width.value = 100
  hideTimer = setTimeout(() => {
    visible.value = false
    width.value = 0
  }, 320)
}

const offBefore = router.beforeEach(() => {
  start()
  return true
})

const offAfter = router.afterEach(() => {
  if (doneTimer)
    clearTimeout(doneTimer)
  doneTimer = setTimeout(done, 260)
})

function onLoad() {
  done()
}

onMounted(() => {
  start()
  if (document.readyState === 'complete')
    done()
  else
    window.addEventListener('load', onLoad)
})

onUnmounted(() => {
  offBefore()
  offAfter()
  window.removeEventListener('load', onLoad)
  if (tick)
    clearInterval(tick)
  if (hideTimer)
    clearTimeout(hideTimer)
  if (doneTimer)
    clearTimeout(doneTimer)
})
</script>

<template>
  <div v-show="visible" class="bf-progress" aria-hidden="true">
    <div class="bf-progress-bar" :style="{ width: `${width}%` }" />
  </div>
</template>
