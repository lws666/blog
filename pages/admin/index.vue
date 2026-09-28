<template>
  <div v-if="mounted" id="body-root">
    <!-- ── Lock screen ────────────────────────────────────────── -->
    <div id="lock-screen" :class="{ 'hidden-lock': unlocked }">
      <div class="glass-card p-10 text-center space-y-6 w-[85%] max-w-sm">
        <!-- 2FA：绑定（扫码）阶段 -->
        <template v-if="totpStage === 'setup' && totpSetup">
          <h2 class="text-2xl font-bold text-blue-400">设置两步验证</h2>
          <p class="text-white/60 text-xs leading-relaxed">
            用 谷歌身份验证器 / Microsoft Authenticator 等 App 扫码，<br>或手动输入密钥，然后输入 6 位验证码确认。
          </p>
          <div class="bg-white rounded-xl p-3 inline-block">
            <img
              :src="`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(totpSetup.otpauth)}`"
              alt="TOTP 二维码"
              class="w-[180px] h-[180px]"
            >
          </div>
          <div class="text-white/50 text-[11px] break-all font-mono bg-black/30 rounded-lg p-2 select-all">{{ totpSetup.secret }}</div>
          <input
            v-model="totpInput"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="输入 6 位验证码"
            class="config-input text-center tracking-[0.4em]"
            @keyup.enter="submitTotp"
          />
          <button
            class="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
            :disabled="unlocking"
            @click="submitTotp"
          >
            {{ unlocking ? '确认中...' : '确认绑定' }}
          </button>
        </template>

        <!-- 2FA：日常挑战阶段 -->
        <template v-else-if="totpStage === 'challenge'">
          <h2 class="text-2xl font-bold text-blue-400">两步验证</h2>
          <p class="text-white/60 text-xs">输入身份验证器 App 中的 6 位验证码</p>
          <input
            v-model="totpInput"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="6 位验证码"
            class="config-input text-center tracking-[0.4em]"
            @keyup.enter="submitTotp"
          />
          <p v-if="lockError" class="text-red-400 text-xs">{{ lockError }}</p>
          <button
            class="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
            :disabled="unlocking"
            @click="submitTotp"
          >
            {{ unlocking ? '验证中...' : '验证进入' }}
          </button>
        </template>

        <!-- 默认：Token + GitHub 登录 -->
        <template v-else>
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
                class="cursor-pointer p-3 hover:bg-white/10 rounded-lg transition-all"
                @click="openTotpModal"
              >🔐 两步验证</div>
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
                        @click="generateCover('svg')"
                      >
                        {{ coverLoading ? '生成中...' : '🎨 生成封面' }}
                      </button>
                      <button
                        class="bg-white/5 hover:bg-white/15 px-2 py-1.5 rounded text-[10px] transition-all disabled:opacity-40 whitespace-nowrap"
                        :disabled="coverLoading"
                        title="AI 生图（消耗 Workers AI 免费额度）"
                        @click="generateCover('ai')"
                      >
                        ✨
                      </button>
                    </div>
                    <input
                      v-model="coverText"
                      type="text"
                      class="config-input mt-1"
                      placeholder="封面大字：这篇文章干了什么（留空用 DESCRIPTION）"
                    />
                    <input
                      v-model="coverStyle"
                      type="text"
                      class="config-input mt-1"
                      placeholder="仅 AI 生图用：风格提示（可选）"
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

    <!-- ── TOTP modal（两步验证管理） ───────────────────────────── -->
    <Teleport to="body">
      <div
        id="totp-modal"
        class="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md"
        :class="{ hidden: !showTotpModal }"
        @click.self="showTotpModal = false"
      >
        <div class="glass-card w-full max-w-md m-4 p-6 space-y-4 text-sm">
          <div class="flex justify-between items-center">
            <h3 class="font-bold">🔐 两步验证（谷歌身份验证器）</h3>
            <button class="text-2xl leading-none" @click="showTotpModal = false">&times;</button>
          </div>

          <template v-if="totpEnabled">
            <p class="text-white/60 text-xs leading-relaxed">
              已启用。发布/删除文章等写操作需要验证码（登录后 12 小时内免重复输入）。<br>关闭前需要输入一次验证码确认身份。
            </p>
            <input
              v-model="totpModalCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="6 位验证码"
              class="config-input text-center tracking-[0.4em]"
            />
            <p v-if="totpModalError" class="text-red-400 text-xs">{{ totpModalError }}</p>
            <button
              class="w-full bg-red-600/80 py-2.5 rounded-xl font-bold hover:bg-red-600 transition-all disabled:opacity-50"
              :disabled="totpBusy"
              @click="disableTotp"
            >关闭两步验证</button>
          </template>

          <template v-else>
            <p class="text-white/60 text-xs leading-relaxed">
              未启用。启用后，即使管理 Token 泄露，没有你的手机验证码也无法操作。
            </p>
            <button
              class="w-full bg-blue-600 py-2.5 rounded-xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
              :disabled="totpBusy"
              @click="startTotpSetup"
            >{{ totpBusy ? '生成中...' : '启用两步验证' }}</button>
            <template v-if="totpSetup">
              <div class="bg-white rounded-xl p-3 inline-block mx-auto">
                <img
                  :src="`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(totpSetup.otpauth)}`"
                  alt="TOTP 二维码"
                  class="w-[180px] h-[180px]"
                >
              </div>
              <div class="text-white/50 text-[11px] break-all font-mono bg-black/30 rounded-lg p-2 select-all">{{ totpSetup.secret }}</div>
              <input
                v-model="totpModalCode"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="输入 6 位验证码确认"
                class="config-input text-center tracking-[0.4em]"
              />
              <p v-if="totpModalError" class="text-red-400 text-xs">{{ totpModalError }}</p>
              <button
                class="w-full bg-blue-600 py-2.5 rounded-xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
                :disabled="totpBusy"
                @click="confirmTotp"
              >确认绑定</button>
            </template>
          </template>
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

/** 2FA 会令牌（启用二步验证后写操作要用它替代 Bearer） */
function getTotpToken(): string {
  return sessionStorage.getItem('totp_token') || ''
}

/**
 * 写操作统一走这里：2FA 未启用用 Bearer，已启用用 TOTP 会话令牌。
 * 收到 401（会话过期/被拒）时退回验证码挑战页。
 */
function authHeaders(json = true): Record<string, string> {
  const totp = getTotpToken()
  const headers: Record<string, string> = {
    Authorization: totp ? `TOTP ${totp}` : `Bearer ${getToken()}`,
  }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

function totpRequired(): boolean {
  return sessionStorage.getItem('totp_enabled') === '1'
}

/** 回到验证码挑战页（保留 admin_token 以便重新换发会话） */
function fallbackToTotpChallenge() {
  sessionStorage.removeItem('totp_token')
  sessionStorage.removeItem('pub_auth')
  unlocked.value = false
  totpStage.value = 'challenge'
  totpInput.value = ''
  lockError.value = ''
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
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (res.status === 401 && totpRequired()) {
    fallbackToTotpChallenge()
    throw new Error('二步验证会话已过期，请重新输入验证码')
  }
  const data = await res.json()
  if (!data.success) throw new Error(data.error || `API error: ${res.status}`)
  return data.data as T
}

async function apiAdminDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  })
  if (res.status === 401 && totpRequired()) {
    fallbackToTotpChallenge()
    throw new Error('二步验证会话已过期，请重新输入验证码')
  }
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

// ── Cover state ───────────────────────────────────────────────────
const coverLoading = ref(false)
const coverMsg = ref('')
const coverErr = ref(false)
/** Headline printed in big black type on a deterministic cover */
const coverText = ref('')
/** Style hint, AI engine only */
const coverStyle = ref('')

/**
 * Draw the SVG cover onto a canvas and return a PNG data URL.
 *
 * Two reasons this happens in the browser rather than the worker:
 * social crawlers reject SVG for og:image, and this is the only runtime
 * that has the CJK fonts the edge lacks. The SVG is served with CORS *,
 * so the canvas stays untainted and toDataURL() is allowed.
 */
function rasterizeSvg(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 630
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建画布上下文'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('封面栅格化失败：SVG 加载失败'))
    img.src = `${url}?t=${Date.now()}`
  })
}

/**
 * Generate a cover via the worker and store it in B2.
 *
 * 'svg' (default) builds the white/black/tech-logo design deterministically
 * — no AI quota — then rasterises it here and stores the PNG alongside, so
 * og:image and every social crawler get a usable bitmap.
 * 'ai' asks Agnes/Workers AI for a painted cover instead.
 */
async function generateCover(engine: 'svg' | 'ai' = 'svg') {
  if (coverLoading.value) return
  coverLoading.value = true
  coverMsg.value = ''
  coverErr.value = false
  try {
    // Only the manual override is sent as text — the worker picks between
    // description and title itself, and always searches the description for
    // tech keywords when building the icon row.
    const headline = coverText.value.trim()
    const data = await apiAdminPost<{ url: string }>('/cover', {
      engine,
      title: fmTitle.value,
      tags: fmTags.value,
      excerpt: fmDescription.value,
      text: headline || undefined,
      slug: currentSlug.value || fmTitle.value,
      style: engine === 'ai' ? (coverStyle.value.trim() || undefined) : undefined,
    })

    if (engine === 'svg') {
      coverMsg.value = '正在栅格化…'
      const png = await rasterizeSvg(data.url)
      const stored = await apiAdminPost<{ url: string }>('/cover/raster', {
        svg: data.url,
        png,
      })
      fmImage.value = stored.url
      coverMsg.value = '封面已生成（SVG + PNG），保存文章后生效'
    } else {
      fmImage.value = data.url
      coverMsg.value = '封面已生成，保存文章后生效'
    }
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

// ── TOTP modal（面板内的两步验证管理） ─────────────────────────────
const showTotpModal = ref(false)
const totpEnabled = ref(false)
const totpModalCode = ref('')
const totpModalError = ref('')
const totpBusy = ref(false)

async function refreshTotpStatus() {
  try {
    const data = await apiAdminGet<{ enabled: boolean }>('/admin/totp/status')
    totpEnabled.value = !!data.enabled
  } catch {
    totpEnabled.value = false
  }
}

async function startTotpSetup() {
  totpBusy.value = true
  totpModalError.value = ''
  try {
    const data = await apiAdminPost<{ secret: string, otpauth: string }>('/admin/totp/setup', {})
    totpSetup.value = data
    totpModalCode.value = ''
  } catch (e) {
    totpModalError.value = (e as Error).message
  } finally {
    totpBusy.value = false
  }
}

async function confirmTotp() {
  totpBusy.value = true
  totpModalError.value = ''
  const code = totpModalCode.value.trim()
  try {
    await apiAdminPost('/admin/totp/confirm', { code })
    totpEnabled.value = true
    totpSetup.value = null
    totpModalCode.value = ''
    // 让本次面板会话立刻拿到 TOTP 会话令牌，写操作不再被打断
    await totpExchange(code, getToken()).catch(() => {})
  } catch (e) {
    totpModalError.value = (e as Error).message
  } finally {
    totpBusy.value = false
  }
}

async function disableTotp() {
  totpBusy.value = true
  totpModalError.value = ''
  try {
    await apiAdminPost('/admin/totp/disable', { code: totpModalCode.value.trim() })
    totpEnabled.value = false
    totpModalCode.value = ''
    sessionStorage.removeItem('totp_token')
    sessionStorage.removeItem('totp_enabled')
  } catch (e) {
    totpModalError.value = (e as Error).message
  } finally {
    totpBusy.value = false
  }
}

function openTotpModal() {
  totpModalCode.value = ''
  totpModalError.value = ''
  totpSetup.value = null
  refreshTotpStatus()
  showTotpModal.value = true
}
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
const totpInput = ref('')
const totpStage = ref<'none' | 'challenge' | 'setup'>('none')
const totpSetup = ref<{ secret: string, otpauth: string } | null>(null)

/** 验证码换 TOTP 会话令牌；成功后后续写操作用 Authorization: TOTP <token> */
async function totpExchange(code: string, bearer: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/admin/totp/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ code }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || '验证码错误')
  sessionStorage.setItem('totp_token', data.data.token)
  sessionStorage.setItem('totp_enabled', '1')
  return true
}

async function submitTotp() {
  const code = totpInput.value.trim()
  const raw = tokenInput.value.trim()
  if (!code || !raw) return
  unlocking.value = true
  lockError.value = ''
  try {
    if (totpStage.value === 'setup' && totpSetup.value) {
      // 绑定流程：确认验证码 → 立即换会话令牌
      const res = await fetch(`${API_BASE}/admin/totp/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${raw}` },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || '验证码错误')
      await totpExchange(code, raw)
    } else {
      await totpExchange(code, raw)
    }

    sessionStorage.setItem('admin_token', raw)
    sessionStorage.setItem('pub_auth', '1')
    totpStage.value = 'none'
    totpInput.value = ''
    unlocked.value = true
    await nextTick()
    initVditor()
  } catch (e) {
    lockError.value = (e as Error).message
  } finally {
    unlocking.value = false
  }
}

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

    // 2FA: enabled? → 要求验证码；setup 中断过？→ 回到扫码页
    const st = await fetch(`${API_BASE}/admin/totp/status`, {
      headers: { Authorization: `Bearer ${raw}` },
    })
    const stData = await st.json().catch(() => null)
    if (stData?.data?.enabled) {
      totpStage.value = 'challenge'
      lockError.value = ''
      totpInput.value = ''
      unlocking.value = false
      return
    }
    // 未确认绑定但库里有半截密钥 → 引导完成绑定
    const setupRes = await fetch(`${API_BASE}/admin/totp/setup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${raw}` },
    }).catch(() => null)
    const setupData = setupRes ? await setupRes.json().catch(() => null) : null
    if (setupData?.success) {
      totpSetup.value = setupData.data
      totpStage.value = 'setup'
      lockError.value = ''
      unlocking.value = false
      return
    }

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

const githubConfigured = ref(false)
const githubClientId = ref('')

/**
 * Where GitHub sends the ?code= back to.
 *
 * GitHub requires this to match a Redirect URL registered on the OAuth app,
 * so the current origin is used instead of a hardcoded host: browsing the
 * admin on https://www.lwsnb.eu.cc/admin/ (the canonical domain, and a
 * registered URL) now completes the whole flow on that domain, with no hop
 * through the retired www.lwsnb.dpdns.org host.
 *
 * NOTE: any other origin used to reach the admin (a preview deployment, the
 * apex domain) must also be registered, otherwise GitHub refuses the login
 * after the user authenticates. Add new hosts to the OAuth/GitHub App
 * settings before using them.
 */
function adminRedirectUrl(): string {
  const origin = typeof window === 'undefined' ? 'https://www.lwsnb.eu.cc' : window.location.origin
  return `${origin}/admin/`
}

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
    + `&redirect_uri=${encodeURIComponent(adminRedirectUrl())}&state=${state}`
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

    const ghToken = data.data.token
    // 2FA：与密码路径一致 —— 已启用则要求验证码
    const st = await fetch(`${API_BASE}/admin/totp/status`, {
      headers: { Authorization: `Bearer ${ghToken}` },
    }).catch(() => null)
    const stData = st ? await st.json().catch(() => null) : null
    if (stData?.data?.enabled) {
      tokenInput.value = ghToken
      totpStage.value = 'challenge'
      totpInput.value = ''
      unlocking.value = false
      return true
    }

    sessionStorage.setItem('admin_token', ghToken)
    sessionStorage.setItem('totp_token', sessionStorage.getItem('totp_token') || '')
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
  sessionStorage.removeItem('totp_token')
  sessionStorage.removeItem('totp_enabled')
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
    // TOTP 会话令牌有 12h 有效期；过期时 API 会 401，由 apiAdmin* 的
    // 401 处理退回挑战页（这里不主动探测，避免每次进面板都多一个请求）
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
