<script lang="ts">
  /**
   * Twikoo 评论区 —— 前端从 CDN 加载 twikoo.js，初始化到 #tcomment。
   *
   * 后端：https://twikoo.13318678430.workers.dev/（Cloudflare Workers + D1）
   *
   * 注意（与 giscus 同样的坑）：twikoo.init 只在首次执行时读取容器，
   * SPA 路由切换需要按 path 重建；主题切换通过 data-theme 重新 init。
   */
  let { path, dark }: { path: string; dark: boolean } = $props()

  let container = $state<HTMLElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let twikooJs: any = null
  let loaded = false

  const ENV_ID = 'https://twikoo.13318678430.workers.dev/'
  const VERSION = '2.0.15'

  async function ensureScript(): Promise<any> {
    if (twikooJs) return twikooJs
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = `https://cdn.jsdelivr.net/npm/twikoo@${VERSION}/dist/twikoo.all.min.js`
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('twikoo.js 加载失败'))
      document.head.appendChild(s)
    })
    twikooJs = (window as unknown as { twikoo: unknown }).twikoo
    if (!twikooJs) throw new Error('twikoo 全局对象不存在')
    return twikooJs
  }

  async function render() {
    if (!container) return
    container.innerHTML = ''
    try {
      const tk = await ensureScript()
      await tk.init({
        envId: ENV_ID,
        el: '#tcomment',
        path,
        // 亮暗跟随站点主题
        lang: 'zh-CN',
      })
    } catch (e) {
      if (container) {
        container.innerHTML =
          `<p style="color:var(--card-meta,#858585);font-size:0.88rem">评论加载失败：${(e as Error).message}</p>`
      }
    }
  }

  $effect(() => {
    // 依赖 path 与 dark：任一变化都重新渲染（twikoo 不支持热更新主题）
    void path
    void dark
    render()
  })
</script>

<div class="bf-comments">
  <h2 class="bf-comments__title">评论</h2>
  <div id="tcomment" bind:this={container}></div>
</div>
