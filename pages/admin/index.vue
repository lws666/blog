<template>
  <div v-if="mounted" id="body-root">
    <!-- ── Lock screen ────────────────────────────────────────── -->
    <div id="lock-screen" :class="{ 'hidden-lock': unlocked }">
      <div class="glass-card p-10 text-center space-y-6 w-[85%] max-w-sm">
        <h2 class="text-2xl font-bold text-blue-400">Mizuki Admin</h2>
        <input
          v-model="tokenInput"
          type="password"
          placeholder="请输入管理 Token"
          class="config-input text-center"
          @keyup.enter="unlock"
        />
        <p v-if="lockError" class="text-red-400 text-xs">{{ lockError }}</p>
        <button
          id="unlock-btn"
          class="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
          :disabled="unlocking"
          @click="unlock"
        >
          {{ unlocking ? '验证中...' : '解锁进入' }}
        </button>
      </div>
    </div>

    <!-- ── Main content ───────────────────────────────────────── -->
    <div id="main-content" :class="{ hidden: !unlocked }">
      <div class="pc-layout">
        <!-- Sidebar -->
        <aside class="p-6 border-r border-white/10 bg-black/10 flex flex-col justify-between pc-only">
          <div>
            <div class="font-bold text-lg mb-8 text-blue-400">valaxy</div>
            <nav class="space-y-2 text-sm">
              <div
                class="cursor-pointer p-3 hover:bg-white/10 rounded-lg transition-all"
                @click="openListModal"
              >📁 文章管理</div>
              <div
                class="cursor-pointer p-3 hover:bg-white/10 rounded-lg transition-all"
                @click="toggleDarkMode"
              >🌓 切换模式</div>
              <div
                class="cursor-pointer p-3 hover:bg-white/10 rounded-lg text-red-400 transition-all"
                @click="logout"
              >🚪 退出登录</div>
            </nav>
          </div>
        </aside>

        <!-- Main panel -->
        <div class="overflow-y-auto p-4 lg:p-8">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto">
            <!-- Frontmatter -->
            <div class="lg:col-span-4">
              <section class="glass-card p-5 space-y-4">
                <h3 class="text-xs font-bold text-blue-400 uppercase border-b border-white/10 pb-2">Frontmatter</h3>
                <div class="space-y-3 text-[10px]">
                  <div>TITLE<input v-model="fmTitle" type="text" class="config-input mt-1" /></div>
                  <div>PUBLISHED (DATE)<input v-model="fmDate" type="date" class="config-input mt-1" /></div>
                  <div>CATEGORY<input v-model="fmCategory" type="text" class="config-input mt-1" /></div>
                  <div>IMAGE<input v-model="fmImage" type="text" class="config-input mt-1" /></div>
                  <div>TAGS<input v-model="fmTags" type="text" class="config-input mt-1" placeholder="[tag1, tag2]" /></div>
                  <div>DESCRIPTION<textarea v-model="fmDescription" class="config-input mt-1 h-16"></textarea></div>
                </div>
              </section>
            </div>

            <!-- Editor -->
            <div class="lg:col-span-8 space-y-4">
              <div class="glass-card p-2 min-h-[600px] flex flex-col">
                <div class="flex gap-2 p-2 border-b border-white/5 mb-2">
                  <button
                    class="bg-blue-600/30 hover:bg-blue-600 px-3 py-1 rounded text-[10px] font-bold transition-all"
                    @click="insertVideoTag"
                  >📺 插入视频</button>
                  <span class="ml-auto text-[10px] opacity-30 self-center">{{ saveStatus }}</span>
                </div>
                <div id="vditor" class="flex-grow"></div>
              </div>
              <button
                id="publish-btn"
                class="w-full bg-blue-600 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50"
                :disabled="publishing"
                @click="publish"
              >{{ publishBtnText }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Article list modal ──────────────────────────────────── -->
    <Teleport to="body">
      <div
        id="list-modal"
        class="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md"
        :class="{ hidden: !showListModal }"
        @click.self="showListModal = false"
      >
        <div class="glass-card w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden text-sm m-4">
          <div class="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 class="font-bold">文章列表</h3>
            <button class="text-2xl" @click="showListModal = false">&times;</button>
          </div>
          <div class="overflow-y-auto p-4 space-y-2">
            <div v-if="listLoading" class="text-center opacity-50 py-8">加载中...</div>
            <div v-else-if="articles.length === 0" class="text-center opacity-30 py-8">暂无文章</div>
            <div
              v-for="article in articles"
              :key="article.slug"
              class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 group transition-all"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span class="cursor-pointer truncate" @click="loadArticle(article)">
                  {{ article.title || article.slug }}
                </span>
                <span
                  v-if="article.draft"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-yellow-600/40 text-yellow-300 shrink-0"
                >草稿</span>
              </div>
              <button
                class="text-red-400 opacity-0 group-hover:opacity-100 px-2 transition-all shrink-0"
                @click="deleteArticle(article)"
              >删除</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

// ── SSR guard: content only renders after client mount ────────────
const mounted = ref(false)

// ── CDN helpers ───────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

function loadStyleSheet(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}

// ── API helpers ────────────────────────────────────────────────────
const API_BASE = 'https://api.lwsnb.dpdns.org/api'

function getToken(): string {
  return sessionStorage.getItem('admin_token') || ''
}

async function apiAdminGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || `API error: ${res.status}`)
  return data.data as T
}

async function apiAdminPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || `API error: ${res.status}`)
  return data.data as T
}

async function apiAdminDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || `API error: ${res.status}`)
}

// ── State ──────────────────────────────────────────────────────────
const tokenInput = ref('')
const unlocked = ref(false)
const unlocking = ref(false)
const lockError = ref('')

const fmTitle = ref('')
const fmDate = ref('')
const fmCategory = ref('')
const fmImage = ref('')
const fmTags = ref('')
const fmDescription = ref('')

const currentSlug = ref('')
const saveStatus = ref('就绪')
const publishing = ref(false)
const publishBtnText = ref('确认并上传')

const showListModal = ref(false)
const listLoading = ref(false)
const articles = ref<Array<{
  slug: string
  title: string
  date: string
  draft: boolean
}>>([])

let vditor: any = null

// ── Lock screen ────────────────────────────────────────────────────
async function unlock() {
  const raw = tokenInput.value.trim()
  if (!raw) return
  unlocking.value = true
  lockError.value = ''
  try {
    // Verify token via dedicated endpoint
    const res = await fetch(`${API_BASE}/admin/verify`, {
      headers: { Authorization: `Bearer ${raw}` },
    })
    if (res.status === 401) throw new Error('Token 验证失败')
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Token 验证失败')

    sessionStorage.setItem('admin_token', raw)
    sessionStorage.setItem('pub_auth', '1')
    unlocked.value = true

    await nextTick()
    initVditor()
  } catch (e) {
    lockError.value = (e as Error).message
  } finally {
    unlocking.value = false
  }
}

// ── Vditor init (lazy, client-only) ────────────────────────────────
async function initVditor() {
  try {
    loadStyleSheet('https://cdn.jsdelivr.net/npm/vditor@3.9.6/dist/index.css')
    await loadScript('https://cdn.jsdelivr.net/npm/vditor@3.9.6/dist/index.min.js')

    const VditorCtor = (window as any).Vditor
    if (!VditorCtor) {
      console.error('Vditor failed to load')
      return
    }

    const savedDraft = localStorage.getItem('pub_draft') || ''

    vditor = new VditorCtor('vditor', {
      height: 600,
      mode: 'ir',
      theme: 'dark',
      after: () => {
        if (savedDraft) vditor.setValue(savedDraft)
      },
      input: (v: string) => {
        localStorage.setItem('pub_draft', v)
        saveStatus.value = '草稿已存 ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
    })
  } catch (e) {
    console.error('Vditor init failed:', e)
  }
}

// ── Actions ────────────────────────────────────────────────────────
function insertVideoTag() {
  const url = prompt('视频 URL:')
  if (!url) return
  const poster = prompt('封面 URL:', 'https://img.lwsnb.dpdns.org/file/1770349301804_DefualtThumbnail.jpg.webp') || ''
  vditor.insertValue(`\n<video width="640" height="360" controls="" poster="${poster}">\n  <source src="${url}" type="video/mp4"/>\n  你的浏览器不支持 HTML5 视频。\n</video>\n`)
}

async function publish() {
  if (!fmTitle.value || !fmDate.value) {
    alert('标题和日期为必填')
    return
  }

  publishing.value = true
  publishBtnText.value = '上传中...'

  try {
    const tags = fmTags.value
      ? fmTags.value.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const slugBase = fmTitle.value
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase()

    const body = {
      slug: currentSlug.value || `${fmDate.value}-${slugBase}`,
      title: fmTitle.value,
      date: fmDate.value,
      categories: fmCategory.value ? [fmCategory.value] : [],
      tags,
      cover: fmImage.value || '',
      excerpt: fmDescription.value || '',
      content: vditor?.getValue() || '',
    }

    await apiAdminPost('/admin/posts', body)
    alert('✅ 发布成功')
    localStorage.removeItem('pub_draft')
    currentSlug.value = body.slug
    publishBtnText.value = '✅ 已上传 (可继续编辑)'
  } catch (e) {
    alert('❌ 发布失败: ' + (e as Error).message)
    publishBtnText.value = '确认并上传'
  } finally {
    publishing.value = false
  }
}

async function openListModal() {
  showListModal.value = true
  listLoading.value = true
  articles.value = []
  try {
    const data = await apiAdminGet<{ posts: Array<{ slug: string; title: string; date: string; draft: boolean }> }>('/admin/posts', { page: 1, limit: 50 })
    articles.value = data.posts
  } catch (e) {
    console.error('Failed to load articles:', e)
  } finally {
    listLoading.value = false
  }
}

async function loadArticle(article: { slug: string }) {
  try {
    const data = await apiAdminGet<{
      slug: string
      title: string
      date: string
      categories: string[]
      tags: string[]
      cover: string
      excerpt: string
      content: string
      draft: boolean
    }>(`/admin/posts/${article.slug}`)

    fmTitle.value = data.title || ''
    fmDate.value = data.date || ''
    fmCategory.value = data.categories?.[0] || ''
    fmImage.value = data.cover || ''
    fmTags.value = data.tags?.join(', ') || ''
    fmDescription.value = data.excerpt || ''
    currentSlug.value = data.slug

    if (vditor) {
      const body = extractMarkdownBody(data.content || '')
      vditor.setValue(body)
    }

    showListModal.value = false
    publishBtnText.value = '确认并上传'
  } catch (e) {
    alert('加载文章失败: ' + (e as Error).message)
  }
}

function extractMarkdownBody(content: string): string {
  const match = content.match(/^---[\s\S]*?---\n?\n?([\s\S]*)$/)
  return match ? match[1].trim() : content.trim()
}

async function deleteArticle(article: { slug: string; title: string }) {
  if (!confirm(`确定要删除「${article.title || article.slug}」吗？此操作不可撤销。`)) return
  try {
    await apiAdminDelete(`/admin/posts/${article.slug}`)
    articles.value = articles.value.filter((a) => a.slug !== article.slug)
    alert('已删除')
  } catch (e) {
    alert('删除失败: ' + (e as Error).message)
  }
}

function toggleDarkMode() {
  document.getElementById('body-root')?.classList.toggle('dark-mode')
  const isDark = document.getElementById('body-root')?.classList.contains('dark-mode')
  localStorage.setItem('mizuki_dark', String(isDark))
}

function logout() {
  sessionStorage.removeItem('admin_token')
  sessionStorage.removeItem('pub_auth')
  unlocked.value = false
  tokenInput.value = ''
  lockError.value = ''
}

// ── Bootstrap on mount ─────────────────────────────────────────────
onMounted(async () => {
  // Load Tailwind CDN (Play CDN — processes classes at runtime)
  loadScript('https://cdn.tailwindcss.com')

  // Restore dark mode preference
  if (localStorage.getItem('mizuki_dark') === 'true') {
    document.getElementById('body-root')?.classList.add('dark-mode')
  }

  // Auto-unlock if session is still valid
  if (sessionStorage.getItem('pub_auth') === '1') {
    unlocked.value = true
    await nextTick()
    initVditor()
  }

  mounted.value = true
})
</script>

<style>
:root {
  --vditor-color: #3b82f6;
  --glass-opacity: 0.08;
  --bg-brightness: 1;
}
.dark-mode {
  --glass-opacity: 0.2;
  --bg-brightness: 0.3;
}
#body-root {
  background-image: url('https://img.lwsnb.dpdns.org/file/1778339868119_1.png');
  background-attachment: fixed;
  background-size: cover;
  background-position: center;
  min-height: 100vh;
  font-family: sans-serif;
  color: white;
  margin: 0;
  transition: 0.3s;
}
#body-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, calc(1 - var(--bg-brightness)));
  z-index: -1;
  pointer-events: none;
}
.glass-card {
  background: rgba(255, 255, 255, var(--glass-opacity));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
}
.vditor {
  border: none !important;
  background: rgba(0, 0, 0, 0.2) !important;
  border-radius: 12px !important;
}
.config-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 10px;
  color: white;
  outline: none;
  font-size: 13px;
}
input[type='date']::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
#lock-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
}
#lock-screen.hidden-lock {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: 0.6s;
}
@media (min-width: 1025px) {
  .pc-layout { display: grid; grid-template-columns: 240px 1fr; height: 100vh; }
}
#list-modal.hidden { display: none !important; }
#list-modal { display: flex; align-items: center; justify-content: center; padding: 1rem; }
</style>
