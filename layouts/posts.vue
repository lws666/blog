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
    <YunPostList :posts="posts" />
  </YunLayoutWrapper>
</template>
