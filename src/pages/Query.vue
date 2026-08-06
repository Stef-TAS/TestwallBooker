<script lang="ts" setup>
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
</script>
<template>
  <div :class="{ 'compact-page': settingsStore.compactView }">
    <div class="mb-4">
      <p class="text-2xl">Query</p>
      <p class="text-sm">
        Here you can query for specific Informations, like the state of a Testwall and so on
      </p>
    </div>
  </div>
</template>
