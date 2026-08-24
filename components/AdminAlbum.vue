<script setup lang="ts">
/**
 * AdminAlbum — B2-backed image album for the admin dashboard.
 *
 * Talks to the Worker album API:
 *   GET    /api/album      — list
 *   POST   /api/album      — upload (multipart/form-data)
 *   DELETE /api/album/:id  — delete
 *
 * The B2 bucket is private, so image URLs are Worker-proxied paths
 * (/api/album/file/...) rather than direct B2 links.
 */
import { ref, computed, onMounted } from 'vue'

const API_ORIGIN = 'https://api.lwsnb.dpdns.org'
const API_BASE = `${API_ORIGIN}/api`

interface AlbumImage {
  id: number
  b2_key: string
  filename: string
  mime_type: string
  size: number
  url: string
  created_at: string
}

const images = ref<AlbumImage[]>([])
const loading = ref(false)
const errorMsg = ref('')
const uploading = ref(false)
const uploadTotal = ref(0)
const uploadDone = ref(0)
const dragging = ref(false)
const copiedId = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const uploadLabel = computed(() =>
  uploading.value ? `上传中 ${uploadDone.value}/${uploadTotal.value}...` : '＋ 选择图片',
)

function getToken(): string {
  return sessionStorage.getItem('admin_token') || ''
}

/** Absolute URL for display / copying */
function absUrl(img: AlbumImage): string {
  return img.url.startsWith('http') ? img.url : `${API_ORIGIN}${img.url}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// ── Load ────────────────────────────────────────────────────────
async function loadImages() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API_BASE}/album?limit=100`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || `API error: ${res.status}`)
    images.value = data.data.images || []
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// ── Upload ──────────────────────────────────────────────────────
async function uploadFiles(files: File[]) {
  const picked = files.filter((f) => f.type.startsWith('image/'))
  if (!picked.length) return

  uploading.value = true
  uploadTotal.value = picked.length
  uploadDone.value = 0
  errorMsg.value = ''

  const failed: string[] = []

  for (const file of picked) {
    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`${API_BASE}/album`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || `API error: ${res.status}`)

      // Newest first, matching the API's ordering
      images.value.unshift(data.data as AlbumImage)
    } catch (e) {
      failed.push(`${file.name}: ${(e as Error).message}`)
    } finally {
      uploadDone.value++
    }
  }

  uploading.value = false
  if (failed.length) errorMsg.value = `部分上传失败 — ${failed.join('; ')}`
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) uploadFiles(Array.from(input.files))
  // Reset so picking the same file again still fires change
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files?.length) uploadFiles(Array.from(e.dataTransfer.files))
}

// ── Delete ──────────────────────────────────────────────────────
async function removeImage(img: AlbumImage) {
  if (!confirm(`确定删除「${img.filename}」吗？此操作不可撤销。`)) return
  try {
    const res = await fetch(`${API_BASE}/album/${img.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || `API error: ${res.status}`)
    images.value = images.value.filter((i) => i.id !== img.id)
  } catch (e) {
    errorMsg.value = `删除失败: ${(e as Error).message}`
  }
}

// ── Copy URL (handy for inserting into posts) ───────────────────
async function copyUrl(img: AlbumImage) {
  const url = absUrl(img)
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // Fallback for non-secure contexts
    const ta = document.createElement('textarea')
    ta.value = url
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copiedId.value = img.id
  setTimeout(() => {
    if (copiedId.value === img.id) copiedId.value = null
  }, 1500)
}

/** Emit a markdown image tag so the parent can insert it into the editor */
const emit = defineEmits<{ insert: [markdown: string] }>()

function insertToEditor(img: AlbumImage) {
  emit('insert', `![${img.filename}](${absUrl(img)})`)
}

onMounted(loadImages)
</script>

<template>
  <div class="space-y-4">
    <!-- ── Toolbar ──────────────────────────────────────────── -->
    <div class="flex items-center gap-3 flex-wrap">
      <button
        class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        :disabled="uploading"
        @click="fileInput?.click()"
      >
        {{ uploadLabel }}
      </button>

      <button
        class="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-xs transition-all disabled:opacity-50"
        :disabled="loading || uploading"
        @click="loadImages"
      >
        ⟳ 刷新
      </button>

      <span class="text-[10px] opacity-40 ml-auto">
        共 {{ images.length }} 张 · 单张上限 10MB
      </span>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onPick"
      />
    </div>

    <!-- ── Error banner ─────────────────────────────────────── -->
    <p v-if="errorMsg" class="text-red-400 text-xs break-words">{{ errorMsg }}</p>

    <!-- ── Drop zone ────────────────────────────────────────── -->
    <div
      class="border-2 border-dashed rounded-xl p-6 text-center text-xs transition-all"
      :class="dragging
        ? 'border-blue-400 bg-blue-400/10 opacity-100'
        : 'border-white/15 opacity-50'"
      @dragover.prevent="dragging = true"
      @dragenter.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      {{ dragging ? '松开即可上传' : '把图片拖到这里上传' }}
    </div>

    <!-- ── States ───────────────────────────────────────────── -->
    <div v-if="loading" class="text-center opacity-50 py-10 text-sm">加载中...</div>
    <div v-else-if="!images.length" class="text-center opacity-30 py-10 text-sm">
      相册还是空的
    </div>

    <!-- ── Grid ─────────────────────────────────────────────── -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <figure
        v-for="img in images"
        :key="img.id"
        class="glass-card overflow-hidden group relative"
      >
        <img
          :src="absUrl(img)"
          :alt="img.filename"
          loading="lazy"
          class="w-full h-32 object-cover bg-black/20"
        />

        <figcaption class="p-2 text-[10px] leading-tight">
          <div class="truncate" :title="img.filename">{{ img.filename }}</div>
          <div class="opacity-40 mt-0.5">{{ formatSize(img.size) }}</div>
        </figcaption>

        <!-- Hover actions -->
        <div
          class="absolute inset-x-0 top-0 flex gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-b from-black/70 to-transparent"
        >
          <button
            class="bg-black/60 hover:bg-blue-600 px-2 py-1 rounded text-[10px] transition-all"
            title="复制链接"
            @click="copyUrl(img)"
          >
            {{ copiedId === img.id ? '✓ 已复制' : '🔗 链接' }}
          </button>
          <button
            class="bg-black/60 hover:bg-blue-600 px-2 py-1 rounded text-[10px] transition-all"
            title="插入到编辑器"
            @click="insertToEditor(img)"
          >
            ↵ 插入
          </button>
          <button
            class="bg-black/60 hover:bg-red-600 px-2 py-1 rounded text-[10px] ml-auto transition-all"
            title="删除"
            @click="removeImage(img)"
          >
            🗑
          </button>
        </div>
      </figure>
    </div>
  </div>
</template>
