<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const statusClass = (ok: boolean | null) =>
    ok === true ? 'ck-ok' : ok === false ? 'ck-bad' : 'ck-warn'
</script>

<svelte:head>
  <title>收录检测 | 谢谢の博客</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="ck-wrap">
  <header class="ck-head">
    <h1 class="ck-title">收录检测</h1>
    <p class="ck-sub">
      检查 <code>{data.origin}</code> 的 SEO 基础设施，并给出 Google / Bing / 百度的收录查询入口。
    </p>
  </header>

  <!-- 总览 -->
  <section class="ck-card ck-overview">
    <div class="ck-score" class:ck-score--good={data.score >= 80} class:ck-score--mid={data.score >= 50 && data.score < 80} class:ck-score--bad={data.score < 50}>
      <span class="ck-score__num">{data.score}</span>
      <span class="ck-score__unit">分</span>
    </div>
    <div class="ck-overview__text">
      <p class="ck-overview__line">
        <strong>{data.passed} / {data.total}</strong> 项检查通过
      </p>
      <p class="ck-overview__hint">
        {#if data.score === 100}
          基础设施全部就绪。收录结果请用下方官方入口确认——搜索引擎的收录需要时间，通常新站 3 天到数周。
        {:else}
          有项目未通过，建议先修复再提交收录。
        {/if}
      </p>
    </div>
  </section>

  <!-- 检查项 -->
  <section class="ck-card">
    <h2 class="ck-h2">基础设施检查</h2>
    <ul class="ck-list">
      {#each data.checks as c (c.id)}
        <li class="ck-item">
          <span class="ck-dot {statusClass(c.ok)}" aria-hidden="true"></span>
          <div class="ck-item__body">
            <div class="ck-item__top">
              <span class="ck-item__label">{c.label}</span>
              <span class="ck-item__detail">{c.detail}</span>
            </div>
            {#if c.hint}
              <p class="ck-item__hint">{c.hint}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <!-- 收录查询 -->
  <section class="ck-card">
    <h2 class="ck-h2">收录查询</h2>
    <p class="ck-note">
      收录状态以搜索引擎官方为准。点击下面的 <code>site:</code> 链接可直接查看；
      站长工具里能提交 sitemap、请求编入索引。
    </p>

    <div class="ck-engines">
      {#each data.engines as e (e.name)}
        <div class="ck-engine">
          <div class="ck-engine__head">
            <span class="ck-engine__name">{e.name}</span>
          </div>
          <div class="ck-engine__links">
            <a class="ck-btn ck-btn--primary" href={e.siteQuery} target="_blank" rel="noopener">
              查 site:{data.origin.replace(/^https?:\/\//, '')} ↗
            </a>
            <a class="ck-btn" href={e.console} target="_blank" rel="noopener">站长工具 ↗</a>
          </div>
          <p class="ck-engine__tip">{e.tip}</p>
        </div>
      {/each}
    </div>
  </section>

  <p class="ck-foot">
    本页数据实时检测，每次刷新重新检查。页面本身已设置 <code>noindex</code>，不会被搜索引擎收录。
  </p>
</main>

<style>
  .ck-wrap {
    max-width: 860px;
    margin: 0 auto;
    padding: 96px 20px 60px;
    color: var(--font-color);
  }

  .ck-head {
    margin-bottom: 22px;
  }

  .ck-title {
    margin: 0 0 6px;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-highlight-color);
  }

  .ck-sub {
    margin: 0;
    font-size: 0.88rem;
    color: var(--card-meta);
    line-height: 1.7;
  }

  .ck-card {
    background: var(--card-bg);
    border-radius: var(--radius-card);
    box-shadow: var(--card-box-shadow);
    padding: 20px 24px;
    margin-bottom: 16px;
  }

  /* 总览 */
  .ck-overview {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .ck-score {
    flex: 0 0 auto;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 2px;
    background: rgba(73, 177, 245, 0.12);
    color: var(--btn-bg);
  }

  .ck-score--good {
    background: rgba(39, 201, 63, 0.12);
    color: #27c93f;
  }

  .ck-score--mid {
    background: rgba(255, 189, 46, 0.14);
    color: #d99400;
  }

  .ck-score--bad {
    background: rgba(255, 95, 86, 0.12);
    color: #e5484d;
  }

  .ck-score__num {
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1;
  }

  .ck-score__unit {
    font-size: 0.75rem;
  }

  .ck-overview__line {
    margin: 0 0 4px;
    font-size: 0.95rem;
  }

  .ck-overview__hint {
    margin: 0;
    font-size: 0.82rem;
    color: var(--card-meta);
    line-height: 1.65;
  }

  /* 检查列表 */
  .ck-h2 {
    margin: 0 0 14px;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-highlight-color);
  }

  .ck-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .ck-item {
    display: flex;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px dashed var(--light-grey);
  }

  .ck-item:last-child {
    border-bottom: 0;
  }

  .ck-dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 7px;
  }

  .ck-ok {
    background: #27c93f;
  }

  .ck-bad {
    background: #e5484d;
  }

  .ck-warn {
    background: #ffbd2e;
  }

  .ck-item__body {
    flex: 1 1 auto;
    min-width: 0;
  }

  .ck-item__top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 0.88rem;
  }

  .ck-item__label {
    font-weight: 600;
  }

  .ck-item__detail {
    color: var(--card-meta);
    font-size: 0.82rem;
    word-break: break-word;
  }

  .ck-item__hint {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--card-meta);
    line-height: 1.6;
  }

  /* 引擎 */
  .ck-note {
    margin: 0 0 16px;
    font-size: 0.82rem;
    color: var(--card-meta);
    line-height: 1.7;
  }

  .ck-engines {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }

  .ck-engine {
    border: 1px solid var(--light-grey);
    border-radius: 8px;
    padding: 14px;
  }

  .ck-engine__name {
    font-weight: 700;
    font-size: 0.92rem;
  }

  .ck-engine__links {
    display: flex;
    gap: 8px;
    margin: 10px 0 8px;
    flex-wrap: wrap;
  }

  .ck-btn {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--light-grey);
    font-size: 0.78rem;
    color: var(--font-color);
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }

  .ck-btn:hover {
    border-color: var(--btn-bg);
    color: var(--btn-bg);
  }

  .ck-btn--primary {
    background: var(--btn-bg);
    border-color: var(--btn-bg);
    color: #fff;
  }

  .ck-btn--primary:hover {
    background: var(--accent-active);
    border-color: var(--accent-active);
    color: #fff;
  }

  .ck-engine__tip {
    margin: 0;
    font-size: 0.76rem;
    color: var(--card-meta);
    line-height: 1.6;
  }

  .ck-foot {
    margin: 20px 0 0;
    font-size: 0.76rem;
    color: var(--card-meta);
    text-align: center;
  }

  code {
    background: var(--code-bg, rgba(127, 127, 127, 0.12));
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.88em;
  }

  @media (max-width: 640px) {
    .ck-wrap {
      padding: 84px 14px 40px;
    }

    .ck-card {
      padding: 16px;
    }

    .ck-overview {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .ck-score {
      width: 68px;
      height: 68px;
    }

    .ck-score__num {
      font-size: 1.5rem;
    }

    .ck-item__top {
      flex-direction: column;
      gap: 2px;
    }
  }
</style>
