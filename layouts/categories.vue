<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's layouts/categories.vue.
 *
 * Butterfly 风格：去掉左右侧栏，分类页放进居中白卡片。
 * 脚本逻辑与主题一致（分类树、按分类过滤的文章列表、schema）。
 */
import { defineWebPage, useSchemaOrg } from '@unhead/schema-org/vue'
import { useCategories, useFrontmatter, useSiteStore, useValaxyI18n } from 'valaxy'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const { t } = useI18n()

const site = useSiteStore()
const frontmatter = useFrontmatter()

const route = useRoute()
const curCategory = computed(() => (route.query.category as string || ''))
const categories = useCategories()

const pageIcon = computed(() => {
  if (!frontmatter.value.icon)
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    frontmatter.value.icon = 'i-ri-folder-2-line'
  return frontmatter.value.icon
})

const posts = computed(() => {
  const list = site.postList.filter((post) => {
    if (post.categories && curCategory.value !== 'Uncategorized') {
      if (typeof post.categories === 'string')
        return post.categories === curCategory.value
      else
        return post.categories.join('/').startsWith(curCategory.value) && post.categories[0] === curCategory.value.split('/')[0]
    }
    if (!post.categories && curCategory.value === 'Uncategorized')
      return post.categories === undefined
    return false
  })
  return list
})

const { $tO, $tCategory } = useValaxyI18n()

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
  }),
])
</script>

<template>
  <YunLayoutWrapper>
    <div class="bf-container px-4 pt-24 pb-10">
      <RouterView v-slot="{ Component }">
        <component :is="Component">
          <template #main-header>
            <YunPageHeader
              :title="$tO(frontmatter.title) || t('menu.categories')"
              :icon="pageIcon"
              :color="frontmatter.color"
              :page-title-class="frontmatter.pageTitleClass"
            />
          </template>
          <template #main-content>
            <div class="bf-card p-5 md:p-8 mt-4">
              <Transition
                enter-active-class="animate-fade-in animate-duration-400"
                appear
              >
                <div text="center" class="yun-text-light" p="2">
                  {{ t('counter.categories', Array.from(categories.children).length) }}
                </div>
              </Transition>
              <YunCategories :categories="categories.children" />
              <RouterView />
            </div>
          </template>

          <template #main-nav-before>
            <div v-if="curCategory" class="bf-card mt-4 p-5 md:p-8">
              <YunPageHeader
                m="t-2"
                :title="curCategory === 'Uncategorized' ? t('category.uncategorized') : curCategory.split('/').map($tCategory).join(' / ')"
                icon="i-ri-folder-open-line"
              />
              <YunPostCollapse w="full" m="b-2" :posts="posts" />
            </div>
          </template>
        </component>
      </RouterView>
    </div>
  </YunLayoutWrapper>
</template>
