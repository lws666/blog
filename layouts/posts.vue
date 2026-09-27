<script setup lang="ts">
import { useDynamicPosts } from '../composables/useDynamicPosts'
import { computed } from 'vue'

const {
  posts: dynamicPosts,
  loading,
  error,
  refresh,
} = useDynamicPosts({ limit: 50 })

// Ensure Post shape is compatible with YunPostList's Post type
const posts = computed(() => dynamicPosts.value)
</script>

<template>
  <YunLayoutWrapper>
    <div class="bf-container flex items-start gap-6 px-4 pt-24 pb-10">
      <main class="flex-1 min-w-0">
        <YunPostList :posts="posts" />
      </main>
      <BfSidebar />
    </div>
  </YunLayoutWrapper>
</template>
