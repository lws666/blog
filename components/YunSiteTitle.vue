<script setup lang="ts">
import { useSiteConfig, useValaxyI18n } from 'valaxy'

const siteConfig = useSiteConfig()
const { $t } = useValaxyI18n()
</script>

<template>
  <h1 class="site-name text-lg leading-loose">
    {{ $t(siteConfig.title) }}
  </h1>
</template>

<style>
.site-name {
  --title-padding: -15px;

  display: inline-flex;
  color: var(--va-c-text);
  position: relative;
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
}

.site-name::before,
.site-name::after {
  content: "";
  position: absolute;
  width: 10px;
  height: 10px;
  opacity: 0;
  border: 2px solid;
  transition: var(--va-transition-duration);
  transition-timing-function: cubic-bezier(0.17, 0.67, 0.05, 1.29);
}

.site-name::before {
  top: 0;
  left: var(--title-padding);
  border-width: 2px 0 0 2px;
  transform: translate3d(10px, 10px, 0);
}

.site-name::after {
  right: var(--title-padding);
  bottom: 0;
  border-width: 0 2px 2px 0;
  transform: translate3d(-10px, -10px, 0);
}

.site-name:hover::before,
.site-name:hover::after {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}
</style>
