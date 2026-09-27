<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's YunPostCard.
 *
 * Butterfly 风格首页文章卡片：横向卡片，封面占 45%，列表中偶数张
 * 封面在右（CSS nth-child 实现交替）；标题/摘要/元信息在另一侧。
 * 卡片标题用 div（避免列表页出现多个标题层级）。
 *
 * props 与主题原版一致（post: Post），数据流不变。
 */
import type { Post } from 'valaxy'
import { useValaxyI18n } from 'valaxy'
import { computed } from 'vue'

const props = defineProps<{
  post: Post
}>()

const { $tO } = useValaxyI18n()

const cover = computed(() => props.post.cover || '')

// 与主题一致：template 类型的摘要用动态组件渲染，其余按 HTML 处理
const excerptIsTemplate = computed(() => props.post.excerpt_type === 'template')
</script>

<template>
  <article class="bf-post-card bf-card my-4 relative">
    <!-- 覆盖整卡的链接 -->
    <AppLink
      class="absolute inset-0 z-1"
      :to="post.path || ''"
      :aria-label="$tO(post.title)"
      tabindex="0"
    />

    <div v-if="cover" class="bf-post-card-cover">
      <img
        :src="cover"
        :alt="$tO(post.title)"
        loading="lazy"
        width="640"
        height="360"
      >
    </div>

    <div class="bf-post-card-body">
      <div class="bf-post-card-title">
        {{ $tO(post.title) }}
      </div>

      <YunPostMeta :frontmatter="post" />

      <div v-if="post.excerpt" class="bf-post-card-excerpt">
        <ValaxyDynamicComponent
          v-if="excerptIsTemplate"
          :template-str="post.excerpt"
        />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else v-html="post.excerpt" />
      </div>
    </div>
  </article>
</template>
