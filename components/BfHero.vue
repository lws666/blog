<script lang="ts" setup>
/**
 * Butterfly 风格首页 Hero：全屏背景图 + 暗色遮罩 + 居中标题 +
 * 每日一言打字机 + 下滑箭头 + 底部波浪。背景图取 themeConfig.banner.url。
 *
 * 首页唯一的 h1 是这里的站名大标题（侧栏/导航里一律 div）。
 *
 * 每日一言走 Hitokoto 开放 API（v1.hitokoto.cn），客户端请求：
 * - 按天缓存在 localStorage（"每日"一言，一天只请求一次）
 * - 请求失败/超时则退回站点描述，保证 Hero 永远有内容
 * - 打字机在挂载后开始，SSR 输出里只是空的占位行，不影响 SEO
 */
import { useSiteConfig, useThemeConfig } from 'valaxy'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const siteConfig = useSiteConfig()
const themeConfig = useThemeConfig<{ banner?: { title?: string, url?: string } }>()

const bg = computed(
  () =>
    themeConfig.value.banner?.url
    || 'https://img.lwsnb.eu.cc/file/1770349301804_DefualtThumbnail.jpg.webp',
)
const title = computed(() => themeConfig.value.banner?.title || siteConfig.title)

/* ---------------- 每日一言 + 打字机 ---------------- */

const HITOKOTO_API = 'https://v1.hitokoto.cn/?encode=json&charset=utf-8'
const CACHE_KEY = 'bf-hitokoto' // { date, text, from }
const TYPE_INTERVAL = 90 // 每个字的间隔（ms）

const typed = ref('')
const source = ref('')
const done = ref(false)
const started = ref(false)

let typeTimer: ReturnType<typeof setInterval> | undefined
let sourceTimer: ReturnType<typeof setTimeout> | undefined

function today() {
  return new Date().toLocaleDateString('sv') // YYYY-MM-DD
}

/** 逐字打出 text；开始前先清掉上一次的文案与定时器 */
function typeText(text: string, from = '') {
  if (typeTimer)
    clearInterval(typeTimer)
  if (sourceTimer)
    clearTimeout(sourceTimer)
  typed.value = ''
  source.value = ''
  done.value = false
  started.value = true

  // 用户偏好减少动效：直接显示全文
  const reduceMotion
    = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    typed.value = text
    source.value = from
    done.value = true
    return
  }

  let i = 0
  typeTimer = setInterval(() => {
    i += 1
    typed.value = text.slice(0, i)
    if (i >= text.length) {
      if (typeTimer)
        clearInterval(typeTimer)
      typeTimer = undefined
      // 打完再淡入出处，避免打字过程中抖动
      sourceTimer = setTimeout(() => {
        source.value = from
        done.value = true
      }, 220)
    }
  }, TYPE_INTERVAL)
}

function readCache(): { date?: string, text?: string, from?: string } | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  }
  catch {
    return null
  }
}

function writeCache(text: string, from: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today(), text, from }))
  }
  catch {
    // 隐私模式等场景写不了缓存，忽略即可
  }
}

/** 兜底文案：站点描述 → 内置句子 */
function fallback(): { text: string, from: string } {
  return {
    text: siteConfig.description || '保持热爱，奔赴山海。',
    from: '',
  }
}

async function loadQuote() {
  const cached = readCache()
  if (cached?.date === today() && cached.text) {
    typeText(cached.text, cached.from || '')
    return
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(HITOKOTO_API, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const text: string = data?.hitokoto || ''
    const from: string = data?.from_who || data?.from || ''
    if (!text)
      throw new Error('empty hitokoto')
    writeCache(text, from)
    typeText(text, from)
  }
  catch {
    const fb = fallback()
    typeText(fb.text, fb.from)
  }
}

onMounted(() => {
  loadQuote()
})

onUnmounted(() => {
  if (typeTimer)
    clearInterval(typeTimer)
  if (sourceTimer)
    clearTimeout(sourceTimer)
})
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

    <div class="relative z-1 text-center text-white px-4 max-w-3xl mx-auto">
      <h1 class="bf-hero-title text-4xl md:text-6xl font-black">
        {{ title }}
      </h1>

      <!-- 每日一言：打字机效果，光标长亮 -->
      <p
        class="bf-hero-quote mt-4 text-base md:text-xl min-h-[3.5rem] md:min-h-[4rem] flex items-start justify-center"
        aria-live="polite"
      >
        <span class="bf-hero-quote-text">{{ typed }}</span>
        <span
          v-if="started"
          class="bf-hero-cursor"
          aria-hidden="true"
        />
      </p>

      <p
        v-if="source"
        class="bf-hero-source text-xs md:text-sm"
      >
        —— {{ source }}
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
