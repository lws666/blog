<script lang="ts">
  import { marked } from 'marked'
  import {
    savePost, genSummary, makeCover,
    type AdminPostDetail,
  } from '#lib/admin/api'

  let {
    post = null,
    onSaved = () => {},
  }: {
    post?: AdminPostDetail | null
    onSaved?: (slug: string) => void
  } = $props()

  /* ── 表单状态 ── */
  let slug = $state(post?.slug ?? '')
  let title = $state(post?.title ?? '')
  let date = $state(post?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  let categories = $state((post?.categories ?? []).join(', '))
  let tags = $state((post?.tags ?? []).join(', '))
  let cover = $state(post?.cover ?? '')
  let excerpt = $state(post?.excerpt ?? '')
  let content = $state(stripFm(post?.content ?? ''))
  let draft = $state(post?.draft ?? false)
  let top = $state(post?.top ?? 0)

  let saving = $state(false)
  let msg = $state('')
  let err = $state('')
  let busy = $state('')          // 'summary' | 'cover' | ''
  let showPreview = $state(false)
  let textarea = $state<HTMLTextAreaElement | null>(null)

  /** 后端返回的 content 带 frontmatter，编辑时剥掉 */
  function stripFm(md: string): string {
    const m = md.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/)
    return m ? md.slice(m[0].length) : md
  }

  /** 标题自动生成 slug（仅新建且用户没手动改过） */
  let slugTouched = $state(!!post)
  function syncSlug() {
    if (slugTouched) return
    slug = title
      .trim()
      .toLowerCase()
      .replace(/[\s\u3000]+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
  }

  const toList = (s: string) =>
    s.split(/[,，]/).map(x => x.trim()).filter(Boolean)

  const previewHtml = $derived(marked.parse(content || '*（暂无内容）*') as string)

  /* ── 工具栏：插入 Markdown 语法 ── */
  function wrap(before: string, after = before, placeholder = '文本') {
    const ta = textarea
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const sel = content.slice(s, e) || placeholder
    content = content.slice(0, s) + before + sel + after + content.slice(e)
    queueMicrotask(() => {
      ta.focus()
      ta.setSelectionRange(s + before.length, s + before.length + sel.length)
    })
  }

  function insertLine(prefix: string) {
    const ta = textarea
    if (!ta) return
    const s = ta.selectionStart
    const lineStart = content.lastIndexOf('\n', s - 1) + 1
    content = content.slice(0, lineStart) + prefix + content.slice(lineStart)
    queueMicrotask(() => {
      ta.focus()
      ta.setSelectionRange(s + prefix.length, s + prefix.length)
    })
  }

  /* ── 操作 ── */
  async function doSave(publish: boolean) {
    if (saving) return
    if (!title.trim()) { err = '请填写标题'; return }
    if (!slug.trim()) { err = '请填写 slug'; return }

    saving = true
    err = ''
    msg = ''
    try {
      const r = await savePost({
        slug: slug.trim(),
        title: title.trim(),
        date,
        categories: toList(categories),
        tags: toList(tags),
        cover: cover.trim(),
        excerpt: excerpt.trim(),
        content,
        draft: publish ? false : draft,
        top: Number(top) || 0,
      })
      msg = publish ? '已发布，站点将在约 1 分钟内自动更新' : '已保存'
      onSaved(r.slug)
    } catch (e) {
      err = (e as Error).message
    } finally {
      saving = false
    }
  }

  async function doSummary() {
    if (!slug.trim()) { err = '请先保存文章（需要 slug）'; return }
    busy = 'summary'
    err = ''
    try {
      const r = await genSummary(slug.trim())
      excerpt = r.summary
      msg = 'AI 摘要已生成并填入「摘要」'
    } catch (e) {
      err = (e as Error).message
    } finally {
      busy = ''
    }
  }

  async function doCover() {
    if (!title.trim()) { err = '请先填写标题'; return }
    busy = 'cover'
    err = ''
    try {
      const r = await makeCover({ title: title.trim(), excerpt: excerpt.trim(), tags })
      cover = r.url
      msg = '封面已生成'
    } catch (e) {
      err = (e as Error).message
    } finally {
      busy = ''
    }
  }
</script>

<svelte:head><title>{post ? '编辑文章' : '写文章'} · 管理后台</title></svelte:head>

<header class="adm-head">
  <div>
    <h1 class="adm-title">{post ? '编辑文章' : '写文章'}</h1>
    <p class="adm-sub">
      {post ? `slug：${post.slug}` : '标题会自动生成 slug，可手动修改'}
    </p>
  </div>
  <div style="display:flex;gap:8px">
    <button class="adm-btn" disabled={saving} onclick={() => doSave(false)}>
      {draft ? '保存草稿' : '保存'}
    </button>
    <button class="adm-btn adm-btn--primary" disabled={saving} onclick={() => doSave(true)}>
      {#if saving}<span class="adm-spinner"></span>{/if}
      {saving ? '提交中…' : '发布'}
    </button>
  </div>
</header>

{#if err}<div class="adm-alert adm-alert--error">{err}</div>{/if}
{#if msg}<div class="adm-alert adm-alert--ok">{msg}</div>{/if}

<div class="adm-editor-wrap">
  <!-- 左：正文编辑 -->
  <div class="adm-card">
    <div class="adm-toolbar">
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => wrap('**')} title="加粗"><b>B</b></button>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => wrap('*')} title="斜体"><i>I</i></button>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => wrap('`')} title="行内代码">{'</>'}</button>
      <span class="adm-toolbar__sep"></span>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => insertLine('## ')} title="二级标题">H2</button>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => insertLine('### ')} title="三级标题">H3</button>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => insertLine('- ')} title="列表">列表</button>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => insertLine('> ')} title="引用">引用</button>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => wrap('```\n', '\n```', 'code')} title="代码块">代码</button>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => wrap('[', '](https://)', '链接文字')} title="链接">链接</button>
      <button class="adm-btn adm-btn--sm adm-btn--ghost" onclick={() => wrap('![', '](https://)', '图片描述')} title="图片">图片</button>
      <span class="adm-toolbar__sep"></span>
      <button
        class="adm-btn adm-btn--sm"
        class:adm-btn--primary={showPreview}
        onclick={() => (showPreview = !showPreview)}
      >{showPreview ? '编辑' : '预览'}</button>
    </div>

    {#if showPreview}
      <div class="adm-preview">{@html previewHtml}</div>
    {:else}
      <textarea
        class="adm-textarea adm-md"
        bind:this={textarea}
        bind:value={content}
        placeholder={'在此输入 Markdown 正文…\n\n用 # 写标题（会自动降级为 h2，保证页面只有一个 h1）'}
        style="border:0;border-radius:0"
      ></textarea>
    {/if}
  </div>

  <!-- 右：元信息 -->
  <div>
    <div class="adm-card">
      <div class="adm-card__head">基本信息</div>
      <div class="adm-card__body">
        <div class="adm-field">
          <label class="adm-label" for="t">标题 <span style="color:#e5484d">*</span></label>
          <input id="t" class="adm-input" bind:value={title}
            oninput={syncSlug} placeholder="文章标题" />
        </div>

        <div class="adm-field">
          <label class="adm-label" for="s">Slug <span style="color:#e5484d">*</span></label>
          <input id="s" class="adm-input" bind:value={slug}
            oninput={() => (slugTouched = true)} placeholder="url-标识" />
          <p class="adm-hint">访问地址：/blog/{slug || '…'}/</p>
        </div>

        <div class="adm-row">
          <div class="adm-field">
            <label class="adm-label" for="d">日期</label>
            <input id="d" class="adm-input" type="date" bind:value={date} />
          </div>
          <div class="adm-field">
            <label class="adm-label" for="top">置顶权重</label>
            <input id="top" class="adm-input" type="number" bind:value={top} min="0" />
          </div>
        </div>

        <div class="adm-field">
          <label class="adm-label" for="c">分类</label>
          <input id="c" class="adm-input" bind:value={categories} placeholder="用逗号分隔" />
        </div>

        <div class="adm-field">
          <label class="adm-label" for="tg">标签</label>
          <input id="tg" class="adm-input" bind:value={tags} placeholder="用逗号分隔" />
        </div>

        <label style="display:flex;align-items:center;gap:8px;font-size:0.86rem;color:var(--adm-text-2)">
          <input type="checkbox" bind:checked={draft} />
          保存为草稿（不在前台显示）
        </label>
      </div>
    </div>

    <div class="adm-card">
      <div class="adm-card__head">摘要与封面</div>
      <div class="adm-card__body">
        <div class="adm-field">
          <label class="adm-label" for="ex">摘要</label>
          <textarea id="ex" class="adm-textarea" bind:value={excerpt}
            placeholder="列表页与 SEO description 使用" style="min-height:80px"></textarea>
          <button class="adm-btn adm-btn--sm" style="margin-top:6px"
            disabled={busy === 'summary'} onclick={doSummary}>
            {busy === 'summary' ? '生成中…' : '✨ 用 AI 生成摘要'}
          </button>
        </div>

        <div class="adm-field">
          <label class="adm-label" for="cv">封面图 URL</label>
          <input id="cv" class="adm-input" bind:value={cover} placeholder="https://…" />
          <button class="adm-btn adm-btn--sm" style="margin-top:6px"
            disabled={busy === 'cover'} onclick={doCover}>
            {busy === 'cover' ? '生成中…' : '🎨 自动生成封面'}
          </button>
          {#if cover}
            <img src={cover} alt="" style="width:100%;border-radius:8px;margin-top:10px" />
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
