---
title: 瞬间
layout: page
---

<script setup>
import { ref, onMounted } from 'vue'

const moments = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    // 实时抓取你的 Waline 评论数据
    const res = await fetch('https://Waline.lwsnb.dpdns.org/api/comment?path=/moments&pageSize=10')
    const data = await res.json()
    moments.value = data.data || []
  } catch (err) {
    console.error('加载失败', err)
  } finally {
    loading.value = false
  }
})
</script>

<div v-if="loading" style="text-align:center; padding: 2rem;">
  正在穿越时空抓取动态...
</div>

<div v-else class="moment-container">
  <div v-for="item in moments" :key="item.objectId" class="moment-card">
    <div class="moment-header">
      <img :src="item.avatar" class="avatar" />
      <span class="nick">{{ item.nick }}</span>
      <small class="time">{{ new Date(item.insertedAt).toLocaleString() }}</small>
    </div>
    <div class="moment-content" v-html="item.comment"></div>
  </div>
</div>

<style scoped>
.moment-card {
  background: rgba(125, 125, 125, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(125, 125, 125, 0.1);
}
.moment-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
.nick { font-weight: bold; }
.time { color: #888; margin-left: auto; }
</style>
