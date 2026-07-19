<template>
  <YunPostList :posts="posts" />
</template>

<script setup lang="ts">
import { useDynamicPosts } from '../composables/useDynamicPosts'
import { computed } from 'vue'

const { posts: dynamicPosts, loading, error } = useDynamicPosts({ limit: 50 })
const posts = computed(() => dynamicPosts.value)
</script>

<route lang="yaml">
meta:
  layout: home
</route>
