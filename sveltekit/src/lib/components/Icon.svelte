<script lang="ts">
  import { iconPath, type IconName } from '#lib/icons'

  let { name, size = 16 }: { name: IconName; size?: number } = $props()
</script>

<svg
  class="bf-icon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="currentColor"
  aria-hidden="true"
  focusable="false"
><path d={iconPath(name)} /></svg>
