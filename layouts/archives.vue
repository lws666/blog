<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's layouts/archives.vue.
 *
 * Butterfly 风格：去掉左右侧栏，页面标题 + 归档时间轴放进居中白卡片。
 * 脚本逻辑与主题一致（WebPage schema、标题、归档列表）。
 */
import { defineWebPage, useSchemaOrg } from '@unhead/schema-org/vue'
import { useFrontmatter, usePostListWithCollections, usePostTitle } from 'valaxy'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const frontmatter = useFrontmatter()

const title = usePostTitle(frontmatter)
const postsWithCollections = usePostListWithCollections()

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
  }),
])

const pageIcon = computed(() => {
  if (!frontmatter.value.icon)
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    frontmatter.value.icon = 'i-ri-archive-line'
  return frontmatter.value.icon
})
</script>

<template>
  <YunLayoutWrapper>
    <div class="bf-container px-4 pt-24 pb-10">
      <RouterView v-slot="{ Component }">
        <component :is="Component">
          <template #main-header>
            <YunPageHeader
              :title="title || t('menu.archives')"
              :icon="pageIcon"
              :color="frontmatter.color"
              :page-title-class="frontmatter.pageTitleClass"
            />
          </template>
          <template #main-content>
            <div class="bf-card p-5 md:p-8 mt-4">
              <RouterView />
              <YunPostCollapse :posts="postsWithCollections" />
            </div>
          </template>
        </component>
      </RouterView>
    </div>
  </YunLayoutWrapper>
</template>
