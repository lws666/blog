<script lang="ts" setup>
/**
 * 正文增强（客户端）：Butterfly 风格代码块 + 图片灯箱。
 *
 * 两件事都在 DOM 渲染后处理，不参与 SSR/SSG，因此不会造成水合不一致：
 * - 代码块：给 .markdown-body 里的每个 pre 加头部（mac 三点 + 语言名 +
 *   复制按钮），语言名取自 shiki/highlight 生成的 language-xxx 类。
 * - 图片灯箱：点击正文图片全屏查看，点任意处或 Esc 关闭。
 */
import { onContentUpdated } from 'valaxy'
import { onMounted, onUnmounted, ref } from 'vue'

const lightboxSrc = ref('')

/* ---------------- 代码块 ---------------- */

function enhanceCodeBlocks() {
  const blocks = document.querySelectorAll<HTMLPreElement>('.markdown-body pre')
  blocks.forEach((pre) => {
    if (pre.dataset.bfEnhanced)
      return
    pre.dataset.bfEnhanced = '1'

    const code = pre.querySelector('code')
    const langClass = code
      ? [...code.classList].find(c => c.startsWith('language-'))
      : undefined
    const lang = langClass ? langClass.replace('language-', '') : 'text'

    const wrap = document.createElement('div')
    wrap.className = 'bf-code'
    pre.parentNode?.insertBefore(wrap, pre)
    wrap.appendChild(pre)

    const head = document.createElement('div')
    head.className = 'bf-code-head'

    const dots = document.createElement('span')
    dots.className = 'bf-code-dots'
    dots.innerHTML = '<i></i><i></i><i></i>'

    const langEl = document.createElement('span')
    langEl.className = 'bf-code-lang'
    // 围栏没写语言时 markdown-it 会给 language-text，这种情况不显示标签
    langEl.textContent = lang === 'text' ? '' : lang

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'bf-code-copy'
    btn.textContent = '复制'
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code?.innerText ?? '')
        btn.textContent = '已复制'
      }
      catch {
        btn.textContent = '复制失败'
      }
      setTimeout(() => {
        btn.textContent = '复制'
      }, 1500)
    })

    head.append(dots, langEl, btn)
    wrap.insertBefore(head, pre)
  })
}

/* ---------------- 图片灯箱 ---------------- */

function onDocumentClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (el?.tagName === 'IMG' && el.closest('.markdown-body')) {
    lightboxSrc.value = (el as HTMLImageElement).src
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    lightboxSrc.value = ''
}

onContentUpdated(() => {
  enhanceCodeBlocks()
})

onMounted(() => {
  enhanceCodeBlocks()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="bf-lightbox">
      <div
        v-if="lightboxSrc"
        class="bf-lightbox"
        role="dialog"
        aria-label="图片预览"
        @click="lightboxSrc = ''"
      >
        <img :src="lightboxSrc" alt="">
      </div>
    </Transition>
  </Teleport>
</template>
