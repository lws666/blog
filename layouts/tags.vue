<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's layouts/tags.vue.
 *
 * Butterfly 风格：去掉左右侧栏，标签云与按标签过滤的列表放进居中
 * 白卡片。脚本逻辑与主题一致。
 */
import { defineWebPage, useSchemaOrg } from '@unhead/schema-org/vue'
import { useFrontmatter, useInvisibleElement, usePostTitle, useSiteStore, useValaxyI18n } from 'valaxy'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useThemeConfig, useYunTags } from 'valaxy-theme-yun/client'

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
  }),
])

const route = useRoute()
const router = useRouter()

const themeConfig = useThemeConfig()

const { t } = useI18n()
const { $tTag } = useValaxyI18n()
const frontmatter = useFrontmatter()
const { tags, getTagStyle } = useYunTags({
  primary: themeConfig.value.colors?.primary,
})

const curTag = computed(() => route.query.tag as string || '')
const site = useSiteStore()

const posts = computed(() => {
  const list = site.postList.filter((post) => {
    if (post.tags) {
      if (typeof post.tags === 'string')
        return post.tags === curTag.value
      else
        return post.tags.includes(curTag.value)
    }
    return false
  })
  return list
})

const collapse = ref()
const { show } = useInvisibleElement(collapse)

function displayTag(tag: string) {
  router.push({
    query: {
      tag,
    },
  })

  show()
}

const title = usePostTitle(frontmatter)

const tagArr = computed(() => [...tags.value].sort())
</script>

<template>
  <YunLayoutWrapper>
    <div class="bf-container px-4 pt-24 pb-10">
      <RouterView v-slot="{ Component }">
        <component :is="Component">
          <template #main-header>
            <YunPageHeader
              :title="title || t('menu.tags')"
              :icon="frontmatter.icon || 'i-ri-tag-line'"
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
                <div class="yun-text-light" text="center" p="2">
                  {{ t('counter.tags', tagArr.length) }}
                </div>
              </Transition>

              <!-- use flex to fix `overflow-wrap: break-words;` not working in Safari -->
              <div class="justify-center items-end" flex="~ wrap" gap="1">
                <YunLayoutPostTag
                  v-for="([key, tag], i) in tagArr"
                  :key="key"
                  :i="i"
                  :title="key"
                  :count="tag.count"
                  :style="getTagStyle(tag.count)"
                  @click="displayTag(key.toString())"
                />
              </div>

              <RouterView />
            </div>
          </template>

          <template #main-nav-before>
            <div v-if="curTag" ref="collapse" class="bf-card mt-4 p-5 md:p-8">
              <YunPageHeader :title="$tTag(curTag)" icon="i-ri-hashtag" />
              <YunPostCollapse w="full" m="b-2" :posts="posts" />
            </div>
          </template>
        </component>
      </RouterView>
    </div>
  </YunLayoutWrapper>
</template>
