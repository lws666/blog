<script lang="ts">
  import { site } from '#lib/site'
  import type { PostListItem } from '#lib/api'
  import Icon from './Icon.svelte'
  import type { IconName } from '#lib/icons'
  import { t } from '#lib/i18n.svelte'

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
  const d = $derived(t())
</script>

<aside class="bf-aside">
  <div class="bf-aside__inner">
    <!-- 作者卡 -->
    <section class="bf-card bf-author">
      <img class="bf-author__avatar" src={site.author.avatar} alt={site.author.name} width="110" height="110" />
      <h3 class="bf-author__name">{site.author.name}</h3>
      <p class="bf-author__desc">{site.description}</p>

      <div class="bf-author__stats">
        <a href="/archives/"><strong>{postCount}</strong><span>{d.archives}</span></a>
        <a href="/categories/"><strong>{stats.category_count ?? categories.length}</strong><span>{d.categories}</span></a>
        <a href="/tags/"><strong>{stats.tag_count ?? tags.length}</strong><span>{d.tags}</span></a>
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
        <h3 class="bf-widget__title"><Icon name="bell" size={15} /> {d.notice}</h3>
        <p class="bf-widget__text">{site.notice}</p>
      </section>
    {/if}

    <!-- 最新文章 -->
    {#if recentPosts.length}
      <section class="bf-card bf-widget">
        <h3 class="bf-widget__title"><Icon name="file" size={15} /> {d.recent}</h3>
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


    <!-- 网站资讯 -->
    <section class="bf-card bf-widget">
      <h3 class="bf-widget__title"><Icon name="chart" size={15} /> {d.webinfo}</h3>
      <dl class="bf-webinfo">
        <div><dt>{d.runningDays}</dt><dd>{runningDays ?? '—'} {d.day}</dd></div>
        <div><dt>{d.postCount}</dt><dd>{postCount} {d.post}</dd></div>
        <div><dt>{d.createdAt}</dt><dd>{site.since.replace(/-/g, '/')}</dd></div>
      </dl>
    </section>
  </div>
</aside>
