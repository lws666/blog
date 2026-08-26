<script setup lang="ts">
/**
 * Project-level App component.
 *
 * Valaxy renders this on every page via its `/@valaxyjs/UserAppVue`
 * virtual module (see ValaxyApp.vue -> <ValaxyUserApp />), which resolves
 * to this file at the project root. It sits alongside the theme's own
 * App.vue rather than replacing it, so nothing in valaxy-theme-yun is
 * overridden.
 *
 * Used here to mount the site-wide floating music player.
 */
import MusicPlayer from './components/MusicPlayer.vue'
import { useThemeConfig } from 'valaxy'

interface MusicConfig {
  enable?: boolean
  api?: string
  server?: string
  type?: string
  id?: string
  title?: string
}

const themeConfig = useThemeConfig<{ music?: MusicConfig }>()
const music = themeConfig.value.music
</script>

<template>
  <!-- Browser-only: APlayer needs window/document -->
  <ClientOnly>
    <MusicPlayer
      v-if="music?.enable !== false"
      :api="music?.api"
      :server="music?.server"
      :type="music?.type"
      :id="music?.id"
      :title="music?.title"
    />
  </ClientOnly>
</template>
