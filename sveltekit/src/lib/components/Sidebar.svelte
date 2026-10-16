<script lang="ts">
  import { site } from '#lib/site'
  import type { PostListItem } from '#lib/api'
  import Icon from './Icon.svelte'
  import type { IconName } from '#lib/icons'

  /**
   * 右栏 —— 对齐线上 5 张卡：
   *   作者卡（头像+名+简介+归档/分类/标签统计+社交图标）
   *   公告 / 最新文章 / 音乐 / 网站资讯
   */
  let {
    recentPosts = [],
    categories = [],
    tags = [],
    stats = {}
  }: {
    recentPosts?: PostListItem[]
    categories?: { name: string; count: number }[]
    tags?: { name: string; count: number }[]
    stats?: Record<string, number>
  } = $props()

  /** 运行天数（客户端算，避免 SSG 与访问时间不一致导致水合不符） */
  let runningDays = $state<number | null>(null)
  $effect(() => {
    const since = new Date(`${site.since}T00:00:00Z`).getTime()
    runningDays = Math.max(0, Math.floor((Date.now() - since) / 86400000))
  })

  const postCount = $derived(stats.post_count ?? recentPosts.length)
</script>

<aside class="bf-aside">
  <div class="bf-aside__inner">
    <!-- 作者卡 -->
    <section class="bf-card bf-author">
      <img class="bf-author__avatar" src={site.author.avatar} alt={site.author.name} width="110" height="110" />
      <h3 class="bf-author__name">{site.author.name}</h3>
      <p class="bf-author__desc">{site.description}</p>

      <div class="bf-author__stats">
        <a href="/archives/"><strong>{postCount}</strong><span>归档</span></a>
        <a href="/categories/"><strong>{stats.category_count ?? categories.length}</strong><span>分类</span></a>
        <a href="/tags/"><strong>{stats.tag_count ?? tags.length}</strong><span>标签</span></a>
      </div>

      <div class="bf-author__social">
        {#each site.social as s (s.href)}
          <a href={s.href} title={s.name} aria-label={s.name} rel="me noopener">
            <Icon name={s.icon as IconName} size={20} />
          </a>
        {/each}
      </div>
    </section>

    <!-- 公告 -->
    {#if site.notice}
      <section class="bf-card bf-widget">
        <h3 class="bf-widget__title"><Icon name="bell" size={15} /> 公告</h3>
        <p class="bf-widget__text">{site.notice}</p>
      </section>
    {/if}

    <!-- 最新文章 -->
    {#if recentPosts.length}
      <section class="bf-card bf-widget">
        <h3 class="bf-widget__title"><Icon name="file" size={15} /> 最新文章</h3>
        <ul class="bf-widget__list">
          {#each recentPosts.slice(0, 6) as post (post.slug)}
            <li class="bf-widget__item">
              {#if post.cover}
                <img class="bf-widget__thumb" src={post.cover} alt="" loading="lazy" />
              {/if}
              <a class="bf-widget__item-title" href={`/blog/${post.slug}/`}>{post.title}</a>
              <time class="bf-widget__item-date">{(post.date || '').slice(0, 10)}</time>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- 音乐 -->
    <section class="bf-card bf-widget">
      <h3 class="bf-widget__title"><Icon name="music" size={15} /> 音乐</h3>
      <iframe
        class="bf-music"
        title="网易云音乐播放器"
        frameborder="no"
        marginwidth="0"
        marginheight="0"
        width="100%"
        height="86"
        src={`//music.163.com/outchain/player?type=playlist&id=${site.music.id}&auto=0&height=66`}
        loading="lazy"
      ></iframe>
    </section>

    <!-- 网站资讯 -->
    <section class="bf-card bf-widget">
      <h3 class="bf-widget__title"><Icon name="chart" size={15} /> 网站资讯</h3>
      <dl class="bf-webinfo">
        <div><dt>运行天数</dt><dd>{runningDays ?? '—'} 天</dd></div>
        <div><dt>文章数目</dt><dd>{postCount} 篇</dd></div>
        <div><dt>创建于</dt><dd>{site.since.replace(/-/g, '/')}</dd></div>
      </dl>
    </section>
  </div>
</aside>
