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

/* ---------------- 每日一言 + 打字机（循环） ---------------- */

/**
 * 流程：打字 → 停留 → 逐字删除 → 打下一句 → 循环。
 * 为了"出来快"：光标挂载即闪烁，文案不等接口——先按缓存/兜底句子
 * 立刻开始打字，接口返回的多条一言在后台补齐后接上。
 */
const HITOKOTO_API = 'https://v1.hitokoto.cn/?encode=json&charset=utf-8'
const CACHE_KEY = 'bf-hitokoto-list' // { date, items: [{ text, from }], last }
const QUOTE_COUNT = 3 // 每天缓存几条用于轮播
const MAX_ATTEMPTS = 6 // 去重后仍不足时最多请求几次
// 分类轮换（d 文学 / i 诗词 / k 哲学 / f 网络 / a 动画 / h 影视），
// 同时用随机参数击穿 CDN 缓存——否则同一 URL 会被缓存成同一句
const CATEGORIES = ['d', 'i', 'k', 'f', 'a', 'h']
const FETCH_TIMEOUT = 2500
const TYPE_TARGET_MS = 1800 // 整句打字的目标总时长
const TYPE_MS_MIN = 40
const TYPE_MS_MAX = 80
const DELETE_MS = 28
const HOLD_MS = 2600 // 打完停留

interface Quote { text: string, from: string, placeholder?: boolean }

const typed = ref('')
const source = ref('')
const started = ref(true) // 光标从挂载起就闪，避免"反应慢"的观感

let items: Quote[] = []
let idx = 0
let mode: 'typing' | 'holding' | 'deleting' = 'typing'
let timer: ReturnType<typeof setTimeout> | undefined

function today() {
  return new Date().toLocaleDateString('sv') // YYYY-MM-DD
}

function typeInterval(len: number) {
  return Math.max(TYPE_MS_MIN, Math.min(TYPE_MS_MAX, Math.round(TYPE_TARGET_MS / Math.max(len, 1))))
}

function scheduleNext(delay: number) {
  if (timer)
    clearTimeout(timer)
  timer = setTimeout(step, delay)
}

/** 一天的状态机：打字 → 停留 → 删除 → 下一句 */
function step() {
  const q = items[idx % items.length]
  if (!q)
    return

  if (mode === 'typing') {
    if (typed.value.length < q.text.length) {
      typed.value = q.text.slice(0, typed.value.length + 1)
      scheduleNext(typeInterval(q.text.length))
    }
    else {
      mode = 'holding'
      source.value = q.from
      scheduleNext(HOLD_MS)
    }
    return
  }

  if (mode === 'holding') {
    mode = 'deleting'
    source.value = ''
    scheduleNext(80)
    return
  }

  // deleting
  if (typed.value.length > 0) {
    typed.value = typed.value.slice(0, -1)
    scheduleNext(DELETE_MS)
  }
  else {
    idx = (idx + 1) % items.length
    mode = 'typing'
    scheduleNext(160)
  }
}

/** 用接口返回的一言替换占位句：先删掉占位文字再打第一句 */
function replacePlaceholder(fresh: Quote[]) {
  if (!fresh.length)
    return
  if (items.some(i => i.placeholder)) {
    items = fresh
    idx = 0
    if (typed.value.length > 0) {
      mode = 'deleting'
      source.value = ''
      scheduleNext(DELETE_MS)
    }
    else {
      mode = 'typing'
      scheduleNext(160)
    }
  }
}

function fallbackQuote(): Quote {
  return {
    text: siteConfig.description || '保持热爱，奔赴山海。',
    from: '',
    placeholder: true,
  }
}

function readCache(): { todayItems: Quote[], last: Quote | null } {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    const todayItems: Quote[]
      = raw?.date === today() && Array.isArray(raw.items) ? raw.items : []
    const last: Quote | null = raw?.last?.text ? raw.last : (todayItems[0] || null)
    return { todayItems, last }
  }
  catch {
    return { todayItems: [], last: null }
  }
}

function writeCache(list: Quote[]) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        date: today(),
        items: list.map(({ text, from }) => ({ text, from })),
        // 留着给下一天"零等待开局"用：明天先打这句，接口回来再换成新的
        last: list[0] ? { text: list[0].text, from: list[0].from } : null,
      }),
    )
  }
  catch {
    // 隐私模式写不了缓存，忽略
  }
}

async function fetchQuotes(): Promise<Quote[]> {
  const out: Quote[] = []
  const seen = new Set<string>()
  // 串行请求，对开放接口友好；凑够 QUOTE_COUNT 条互不相同的一言为止
  for (let i = 0; i < MAX_ATTEMPTS && out.length < QUOTE_COUNT; i++) {
    const cat = CATEGORIES[i % CATEGORIES.length]
    const url = `${HITOKOTO_API}&c=${cat}&_=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(t)
      if (!res.ok)
        continue
      const data = await res.json()
      const text: string = data?.hitokoto || ''
      if (!text || seen.has(text))
        continue
      seen.add(text)
      out.push({ text, from: data?.from_who || data?.from || '' })
    }
    catch {
      // 单条失败不影响其它
    }
  }
  return out
}

async function loadQuotes() {
  const { todayItems, last } = readCache()
  if (todayItems.length) {
    items = todayItems
    idx = 0
    mode = 'typing'
    step()
    return
  }

  // 当天没有缓存：立刻开打（优先用"昨天那句"——真句不尴尬，其次兜底句），
  // 接口结果稍后接上，做到零等待
  items = [last ? { ...last, placeholder: true } : fallbackQuote()]
  idx = 0
  mode = 'typing'
  step()

  const fresh = await fetchQuotes()
  if (fresh.length) {
    writeCache(fresh)
    replacePlaceholder(fresh)
  }
}

onMounted(() => {
  // 用户偏好减少动效：不打字不循环，直接展示一句
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    const { todayItems, last } = readCache()
    const q = todayItems[0] || last || fallbackQuote()
    items = [q]
    typed.value = q.text
    source.value = q.from
    return
  }
  loadQuotes()
})

onUnmounted(() => {
  if (timer)
    clearTimeout(timer)
})

/** 下滑箭头：平滑滚到正文容器（#bf-main 有 scroll-margin-top 让开导航） */
function scrollToMain() {
  const el = document.getElementById('bf-main')
  if (!el)
    return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <header
    class="bf-hero relative w-full flex items-center justify-center overflow-hidden"
  >
    <!-- Hero 背景图：首页 LCP 元素。worker 在首页 <head> 里预加载了同一
         URL（两边都不带 crossorigin，保持同一 no-cors 缓存条目，
         否则浏览器会下载两份） -->
    <img
      :src="bg"
      alt=""
      aria-hidden="true"
      fetchpriority="high"
      decoding="async"
      class="absolute inset-0 size-full object-cover"
    >
    <div class="absolute inset-0 bg-black/35" aria-hidden="true" />

    <div class="relative z-1 text-center text-white px-4 max-w-3xl mx-auto">
      <h1 class="bf-hero-title text-4xl md:text-6xl font-black">
        {{ title }}
      </h1>

      <!-- 每日一言：打字机循环（打字 → 停留 → 删除 → 下一句） -->
      <p
        class="bf-hero-quote mt-4 text-base md:text-xl min-h-[3.5rem] md:min-h-[4rem] flex items-start justify-center"
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

    <!-- 下滑箭头：z-5 保证浮在波浪之上（波浪是 z-1，且 DOM 在其后） -->
    <a
      href="#bf-main"
      class="bf-hero-arrow absolute bottom-20 md:bottom-24 left-1/2 z-5 text-white"
      aria-label="向下滚动查看文章"
      @click.prevent="scrollToMain"
    >
      <div class="i-ri-arrow-down-s-line size-10" />
    </a>

    <!--
      底部波浪：每层 SVG 宽 300%（3 个周期，viewBox 4320 = 3×1440），
      路径是同一周期重复 3 份、首尾控制点相同，因此整体左移 1/3
      （= 恰好一个周期 = 一个 hero 宽度）时首尾无缝。
      用百分比平移而不是 px：preserveAspectRatio="none" 下用户单位
      与 CSS 像素不等价，写死 px 在非 1440px 宽屏会跳。
      两层相位相反、速度不同形成视差；颜色跟随页面底色变量。
    -->
    <svg
      class="bf-hero-wave bf-wave--back absolute bottom-0 left-0 h-[70px] md:h-[100px] z-1"
      viewBox="0 0 4320 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0,72 C240,32 480,32 720,72 C960,112 1200,112 1440,72
           C1680,32 1920,32 2160,72 C2400,112 2640,112 2880,72
           C3120,32 3360,32 3600,72 C3840,112 4080,112 4320,72
           L4320,120 L0,120 Z"
        style="fill: var(--va-c-bg); opacity: 0.45"
      />
    </svg>
    <svg
      class="bf-hero-wave bf-wave--front absolute bottom-0 left-0 h-[70px] md:h-[100px] z-1"
      viewBox="0 0 4320 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0,80 C240,116 480,116 720,80 C960,44 1200,44 1440,80
           C1680,116 1920,116 2160,80 C2400,44 2640,44 2880,80
           C3120,116 3360,116 3600,80 C3840,44 4080,44 4320,80
           L4320,120 L0,120 Z"
        style="fill: var(--va-c-bg)"
      />
    </svg>
  </header>
</template>
