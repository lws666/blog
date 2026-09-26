<script lang="ts" setup>
/**
 * Project override of valaxy-theme-yun's layouts/post.vue.
 *
 * Identical template; only the theme's `useSchemaOrg(defineArticle(...))` call
 * is dropped.
 *
 * The theme builds the page's BlogPosting from the frontmatter once, during
 * layout setup. Dynamic (D1) posts receive their frontmatter only after the API
 * responds, which is later, so the emitted node carried:
 *   - datePublished / dateModified: "Invalid Date"  (dayjs('') at setup time)
 *   - author.url: https://valaxy.site               (siteConfig.author.link unset)
 *   - a page URL of the site root                   (canonical not set yet)
 *
 * The article node is defined in pages/posts/[slug].vue instead, inside the
 * reactive useHead payload where the real post data is available. Valaxy's own
 * Person / WebSite / WebPage nodes (client/composables/app/useValaxyApp.ts) are
 * left untouched and referenced by @id from there.
 */
</script>

<template>
  <YunLayoutWrapper>
    <YunLayoutLeft />

    <RouterView v-slot="{ Component }">
      <component :is="Component">
        <template #main-header-after>
          <YunMainHeaderAfter />
        </template>

        <template #main-content-after>
          <YunMainContentAfter />
        </template>

        <template #aside-custom>
          <slot name="aside-custom" />
        </template>
      </component>
    </RouterView>

    <YunLayoutRight />
  </YunLayoutWrapper>
</template>
