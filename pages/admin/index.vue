<template>
  <div v-if="mounted" id="body-root">
    <!-- ── Lock screen ────────────────────────────────────────── -->
    <div id="lock-screen" :class="{ 'hidden-lock': unlocked }">
      <div class="glass-card p-10 text-center space-y-6 w-[85%] max-w-sm">
        <h2 class="text-2xl font-bold text-blue-400">valaxy admin</h2>
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

        <!-- GitHub OAuth login (visible once the worker reports a client_id) -->
        <template v-if="githubConfigured">
          <div class="flex items-center gap-3 text-white/30 text-xs select-none">
            <span class="flex-1 h-px bg-white/10" />
            或
            <span class="flex-1 h-px bg-white/10" />
          </div>
          <button
            id="github-login-btn"
            class="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold
                   bg-[#24292f] hover:bg-[#32383f] transition-all disabled:opacity-50"
            :disabled="unlocking"
            @click="githubLogin"
          >
            <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            {{ unlocking ? '登录中...' : '使用 GitHub 登录' }}
          </button>
        </template>
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
                class="cursor-pointer p-3 hover:bg-white/10 rounded-lg transition-all"
                @click="openAlbumModal"
              >🖼️ 切换相册</div>
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
                  <div>
                    IMAGE
                    <div class="flex gap-2 mt-1">
                      <input v-model="fmImage" type="text" class="config-input" />
                      <button
                        class="bg-blue-600/30 hover:bg-blue-600 px-3 py-1.5 rounded text-[10px] font-bold transition-all disabled:opacity-40 whitespace-nowrap"
                        :disabled="coverLoading"
                        @click="generateCover"
                      >
                        {{ coverLoading ? '生成中...' : '✨ AI 生成封面' }}
                      </button>
                    </div>
                    <input
                      v-model="coverStyle"
                      type="text"
                      class="config-input mt-1"
                      placeholder="风格提示（可选，如：赛博朋克夜景 / 水彩风格）"
                    />
                    <img
                      v-if="fmImage"
                      :src="fmImage"
                      alt="封面预览"
                      class="mt-2 rounded max-h-28 w-auto border border-white/10"
                    />
                    <p
                      v-if="coverMsg"
                      class="text-[10px] mt-1"
                      :class="coverErr ? 'text-red-400' : 'text-green-400'"
                    >
                      {{ coverMsg }}
                    </p>
                  </div>
                  <div>TAGS<input v-model="fmTags" type="text" class="config-input mt-1" placeholder="[tag1, tag2]" /></div>
                  <div>DESCRIPTION<textarea v-model="fmDescription" class="config-input mt-1 h-16"></textarea></div>
                </div>
              </section>

              <!-- AI summary -->
              <section class="glass-card p-5 space-y-3 mt-4">
                <h3 class="text-xs font-bold text-blue-400 uppercase border-b border-white/10 pb-2">
                  AI 摘要
                </h3>

                <p v-if="!currentSlug" class="text-[10px] opacity-40 leading-relaxed">
                  请先从「文章管理」打开一篇已发布的文章，或先上传本文，然后再生成摘要。
                </p>

                <template v-else>
                  <textarea
                    v-model="fmSummary"
                    class="config-input h-24 leading-relaxed"
                    placeholder="点击下方按钮用 Workers AI 生成，也可手动编辑"
                  ></textarea>

                  <div class="flex items-center gap-2 flex-wrap">
                    <button
                      class="bg-blue-600/30 hover:bg-blue-600 px-3 py-1.5 rounded text-[10px] font-bold transition-all disabled:opacity-40"
                      :disabled="summaryLoading"
                      @click="generateSummary"
                    >
                      {{ summaryLoading ? '生成中...' : '✨ AI 生成' }}
                    </button>
                    <button
                      class="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-[10px] transition-all disabled:opacity-40"
                      :disabled="summarySaving || summaryLoading"
                      @click="saveSummary"
                    >
                      {{ summarySaving ? '保存中...' : '💾 保存' }}
                    </button>
                    <span class="text-[10px] opacity-40 ml-auto">{{ fmSummary.length }} 字</span>
                  </div>

                  <p v-if="summaryMsg" class="text-[10px]" :class="summaryErr ? 'text-red-400' : 'text-green-400'">
                    {{ summaryMsg }}
                  </p>
                </template>
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

    <!-- ── Album modal ─────────────────────────────────────────── -->
    <Teleport to="body">
      <div
        id="album-modal"
        class="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md"
        :class="{ hidden: !showAlbumModal }"
        @click.self="showAlbumModal = false"
      >
        <div class="glass-card w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-sm m-4">
          <div class="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 class="font-bold">🖼️ 相册</h3>
            <button class="text-2xl leading-none" @click="showAlbumModal = false">&times;</button>
          </div>
          <div class="overflow-y-auto p-4">
            <AdminAlbum v-if="albumOpened" @insert="insertFromAlbum" />
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
const API_BASE = 'https://api.lwsnb.eu.cc/api'

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
const fmSummary = ref('')

// ── AI summary state ──────────────────────────────────────────────
const summaryLoading = ref(false)
const summarySaving = ref(false)
const summaryMsg = ref('')
const summaryErr = ref(false)

// ── AI cover state (Agnes AI) ─────────────────────────────────────
const coverLoading = ref(false)
const coverMsg = ref('')
const coverErr = ref(false)
const coverStyle = ref('')

/**
 * Generate a cover from the current title/tags via the worker, which
 * stores it in B2 and returns a permanent img.lwsnb.eu.cc/cover/… URL.
 */
async function generateCover() {
  if (coverLoading.value) return
  coverLoading.value = true
  coverMsg.value = ''
  coverErr.value = false
  try {
    const data = await apiAdminPost<{ url: string }>('/cover', {
      title: fmTitle.value,
      tags: fmTags.value,
      excerpt: fmDescription.value,
      slug: currentSlug.value || fmTitle.value,
      style: coverStyle.value.trim() || undefined,
    })
    fmImage.value = data.url
    coverMsg.value = '封面已生成，保存文章后生效'
  } catch (e) {
    coverErr.value = true
    coverMsg.value = (e as Error).message
  } finally {
    coverLoading.value = false
  }
}

const currentSlug = ref('')
const saveStatus = ref('就绪')
const publishing = ref(false)
const publishBtnText = ref('确认并上传')

const showListModal = ref(false)
const showAlbumModal = ref(false)
/** Lazy-mount the album so it only fetches after the first open */
const albumOpened = ref(false)
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

// ── GitHub OAuth login ─────────────────────────────────────────────
const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
// The OAuth app's registered Redirect URL is the OLD domain (OAuth apps
// cannot be edited via API). The old host 301-redirects to the new one,
// so the ?code= callback lands on www.lwsnb.eu.cc seamlessly. Once the
// new URL (https://www.lwsnb.eu.cc/admin/) is added to the app settings,
// this can point straight at the new domain.
const ADMIN_URL = 'https://www.lwsnb.dpdns.org/admin/'

const githubConfigured = ref(false)
const githubClientId = ref('')

/** Ask the worker whether a GitHub OAuth app is linked (public value) */
async function checkGithubConfig() {
  try {
    const res = await fetch(`${API_BASE}/auth/github/config`)
    const data = await res.json()
    githubClientId.value = data?.data?.client_id || ''
  } catch {
    githubClientId.value = ''
  }
  githubConfigured.value = !!githubClientId.value
}

/** Redirect to GitHub. The OAuth app requests NO scope (public data only). */
function githubLogin() {
  // crypto.randomUUID needs a secure context + modern browser; fall back
  const state = crypto.randomUUID?.() || `gh-${Date.now()}-${Math.random().toString(36).slice(2)}`
  sessionStorage.setItem('gh_oauth_state', state)
  // sessionStorage is ORIGIN-scoped: if the user starts from lwsnb.eu.cc
  // but GitHub redirects back to the registered www.lwsnb.eu.cc, the
  // stored state is invisible there. A parent-domain cookie bridges that hop.
  try {
    document.cookie = `gh_oauth_state=${state}; max-age=600; path=/; SameSite=Lax; domain=.lwsnb.eu.cc`
  } catch { /* cookies blocked — sessionStorage still applies */ }
  const url = `${GITHUB_AUTHORIZE_URL}?client_id=${encodeURIComponent(githubClientId.value)}`
    + `&redirect_uri=${encodeURIComponent(ADMIN_URL)}&state=${state}`
  window.location.href = url
}

/** Read the state back from sessionStorage, falling back to the cookie. */
function readSavedState(): string | null {
  const fromSession = sessionStorage.getItem('gh_oauth_state')
  if (fromSession) return fromSession
  const m = document.cookie.match(/(?:^|;\s*)gh_oauth_state=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

function clearSavedState() {
  sessionStorage.removeItem('gh_oauth_state')
  try {
    document.cookie = 'gh_oauth_state=; max-age=0; path=/; domain=.lwsnb.eu.cc'
    document.cookie = 'gh_oauth_state=; max-age=0; path=/'
  } catch { /* ignore */ }
}

/**
 * Handle the OAuth callback (?code=…&state=… on /admin/). Exchanges the
 * code via the worker, which verifies the GitHub identity server-side.
 * Returns true if a callback was present (URL is cleaned either way).
 *
 * The state check is best-effort: storage can legitimately lose it across
 * the www ↔ non-www origin hop (sessionStorage is origin-scoped). A state
 * mismatch alone therefore does NOT block the login — the worker's
 * lws666-only identity gate is the real security boundary, and login-CSRF
 * is unexploitable here (an attacker's code resolves to their own account,
 * which the worker rejects with 403).
 */
async function handleGithubCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return false

  // Strip the query from the URL immediately (refresh-safe, no history entry).
  // Relative path — an absolute cross-origin URL would throw.
  window.history.replaceState({}, '', '/admin/')

  const state = params.get('state')
  const saved = readSavedState()
  clearSavedState()
  if (!state || !saved || state !== saved) {
    console.warn('[github-oauth] state mismatch (possible cross-origin hop), continuing with code exchange')
  }

  unlocking.value = true
  lockError.value = ''
  try {
    const res = await fetch(`${API_BASE}/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'GitHub 登录失败')

    sessionStorage.setItem('admin_token', data.data.token)
    sessionStorage.setItem('pub_auth', '1')
    unlocked.value = true

    await nextTick()
    initVditor()
  } catch (e) {
    lockError.value = (e as Error).message
  } finally {
    unlocking.value = false
  }
  return true
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
  const poster = prompt('封面 URL:', 'https://img.lwsnb.eu.cc/file/1770349301804_DefualtThumbnail.jpg.webp') || ''
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
      summary: string
    }>(`/admin/posts/${article.slug}`)

    fmTitle.value = data.title || ''
    fmDate.value = data.date || ''
    fmCategory.value = data.categories?.[0] || ''
    fmImage.value = data.cover || ''
    fmTags.value = data.tags?.join(', ') || ''
    fmDescription.value = data.excerpt || ''
    fmSummary.value = data.summary || ''
    currentSlug.value = data.slug
    summaryMsg.value = ''
    summaryErr.value = false

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

// ── AI summary ─────────────────────────────────────────────────────
/** Generate a summary via Workers AI (result is cached in D1 server-side) */
async function generateSummary() {
  if (!currentSlug.value) return

  summaryLoading.value = true
  summaryMsg.value = ''
  summaryErr.value = false

  try {
    const data = await apiAdminPost<{ summary: string; model: string; neurons: number }>(
      `/admin/posts/${currentSlug.value}/summary`,
      {},
    )
    fmSummary.value = data.summary
    summaryMsg.value = `已生成并保存（${data.model.split('/').pop()} · ${data.neurons.toFixed(1)} neurons）`
  } catch (e) {
    summaryErr.value = true
    summaryMsg.value = '生成失败: ' + (e as Error).message
  } finally {
    summaryLoading.value = false
  }
}

/** Save a manually edited summary */
async function saveSummary() {
  if (!currentSlug.value) return

  summarySaving.value = true
  summaryMsg.value = ''
  summaryErr.value = false

  try {
    const res = await fetch(`${API_BASE}/admin/posts/${currentSlug.value}/summary`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ summary: fmSummary.value }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || `API error: ${res.status}`)
    summaryMsg.value = '已保存'
  } catch (e) {
    summaryErr.value = true
    summaryMsg.value = '保存失败: ' + (e as Error).message
  } finally {
    summarySaving.value = false
  }
}

// ── Album ──────────────────────────────────────────────────────────
function openAlbumModal() {
  albumOpened.value = true
  showAlbumModal.value = true
}

/** Insert a markdown image tag from the album into the editor */
function insertFromAlbum(markdown: string) {
  if (!vditor) {
    alert('编辑器尚未就绪')
    return
  }
  vditor.insertValue(`\n${markdown}\n`)
  showAlbumModal.value = false
}

function toggleDarkMode() {  document.getElementById('body-root')?.classList.toggle('dark-mode')
  const isDark = document.getElementById('body-root')?.classList.contains('dark-mode')
  localStorage.setItem('mizuki_dark', String(isDark))
}

function logout() {
  sessionStorage.removeItem('admin_token')
  sessionStorage.removeItem('pub_auth')
  unlocked.value = false
  tokenInput.value = ''
  lockError.value = ''
  // Drop album state so the next login re-fetches with a fresh token
  showAlbumModal.value = false
  albumOpened.value = false
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
  } else {
    // OAuth callback (?code=…&state=…) beats everything else. The config
    // check runs either way so the GitHub button is available for retry
    // even after a failed callback.
    checkGithubConfig()
    await handleGithubCallback()
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
  background-image: url('https://img.lwsnb.eu.cc/file/1778339868119_1.png');
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
#album-modal.hidden { display: none !important; }
#album-modal { display: flex; align-items: center; justify-content: center; padding: 1rem; }
</style>
